import crypto from "crypto";
import { getAdminClient } from "./supabase";
import { creditBalance, getBalance } from "./ledger";
import { creditHouse } from "./house";
import { payReferralFromHouseFee } from "./referral";
import {
  PVP_ROULETTE_COUNTDOWN_SEC,
  PVP_ROULETTE_SPIN_MS,
  PVP_ROULETTE_RESULT_MS,
  PVP_ROULETTE_MIN_BET,
  PVP_ROULETTE_MAX_BET,
  PVP_ROULETTE_MIN_PLAYERS,
  PVP_ROULETTE_MAX_PLAYERS,
  PVP_ROULETTE_HOUSE_EDGE,
  PVP_ROULETTE_BET_LOCK_MS,
  PVP_ROULETTE_PREP_MS,
  type PvpRouletteStatus,
} from "@/lib/pvpRouletteConstants";

export type PvpRoundRow = {
  id: string;
  status: PvpRouletteStatus;
  bet_ends_at: string | null;
  spin_ends_at: string | null;
  result_ends_at: string | null;
  total_bank: number;
  winner_telegram_id: number | null;
  winner_amount: number | null;
  house_fee: number | null;
  result_index: number | null;
  server_seed_hash: string;
  server_seed: string | null;
  created_at: string;
};

export type PvpBetRow = {
  id: string;
  round_id: string;
  telegram_id: number;
  username: string;
  avatar_url: string | null;
  amount: number;
  created_at: string;
};

function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function randomSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Presence (same idea as color roulette) */
const presenceMap = new Map<number, number>();
const PRESENCE_TTL_MS = 45_000;

export function touchPvpRoulettePresence(telegramId: number) {
  if (!telegramId) return;
  presenceMap.set(Number(telegramId), Date.now());
}

export function countPvpRouletteOnline(): number {
  const now = Date.now();
  let n = 0;
  for (const [id, t] of presenceMap) {
    if (now - t < PRESENCE_TTL_MS) n += 1;
    else presenceMap.delete(id);
  }
  return n;
}

/**
 * Deterministic winner index from commit-reveal seed.
 * Proportional to stake: walk cumulative amounts until point falls inside.
 */
export function pickWinnerIndex(
  serverSeed: string,
  roundId: string,
  bets: { telegram_id: number; amount: number }[]
): number {
  if (bets.length === 0) return 0;
  const sorted = [...bets].sort((a, b) => {
    if (a.telegram_id !== b.telegram_id) return a.telegram_id - b.telegram_id;
    return a.amount - b.amount;
  });
  const material =
    roundId +
    "|" +
    sorted.map((b) => `${b.telegram_id}:${Number(b.amount).toFixed(6)}`).join(",");
  const h = crypto.createHmac("sha256", serverSeed).update(material).digest();
  const total = sorted.reduce((s, b) => s + Number(b.amount), 0);
  if (total <= 0) return 0;
  // Use 52 bits of entropy for uniform [0, total)
  const n =
    (h.readUInt32BE(0) * 0x100000000 + (h.readUInt32BE(4) >>> 0)) /
    0x100000000000000;
  const point = n * total;
  let acc = 0;
  for (let i = 0; i < sorted.length; i++) {
    acc += Number(sorted[i].amount);
    if (point < acc) {
      // Map back to original order index by telegram_id + amount match
      const tid = sorted[i].telegram_id;
      const amt = Number(sorted[i].amount);
      const orig = bets.findIndex(
        (b) => b.telegram_id === tid && Number(b.amount) === amt
      );
      return orig >= 0 ? orig : i;
    }
  }
  return bets.length - 1;
}

async function getActiveRound(): Promise<PvpRoundRow | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("pvp_roulette_rounds")
    .select("*")
    .in("status", ["waiting", "betting", "spinning"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PvpRoundRow) || null;
}

async function getLatestRound(): Promise<PvpRoundRow | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("pvp_roulette_rounds")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PvpRoundRow) || null;
}

async function createWaitingRound(): Promise<PvpRoundRow> {
  const existing = await getActiveRound();
  if (existing) return existing;

  const db = getAdminClient();
  const seed = randomSeed();
  const { data, error } = await db
    .from("pvp_roulette_rounds")
    .insert({
      status: "waiting",
      bet_ends_at: null,
      spin_ends_at: null,
      result_ends_at: null,
      total_bank: 0,
      winner_telegram_id: null,
      winner_amount: null,
      house_fee: null,
      result_index: null,
      server_seed_hash: hashSeed(seed),
      server_seed: seed,
    })
    .select("*")
    .single();

  if (error || !data) {
    const again = await getActiveRound();
    if (again) return again;
    throw new Error(error?.message || "Failed to create pvp roulette round");
  }
  return data as PvpRoundRow;
}

async function loadBets(roundId: string): Promise<PvpBetRow[]> {
  const db = getAdminClient();
  const { data } = await db
    .from("pvp_roulette_bets")
    .select("*")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });
  return (data as PvpBetRow[]) || [];
}

function publicBets(bets: PvpBetRow[], totalBank: number) {
  const total = totalBank > 0 ? totalBank : bets.reduce((s, b) => s + Number(b.amount), 0);
  return bets.map((b) => {
    const amount = Number(b.amount);
    return {
      id: b.id,
      telegramId: Number(b.telegram_id),
      username: b.username || "Player",
      avatarUrl: b.avatar_url,
      amount,
      pct: total > 0 ? +((amount / total) * 100).toFixed(2) : 0,
    };
  });
}

function publicRound(r: PvpRoundRow) {
  return {
    id: r.id,
    status: r.status,
    betEndsAt: r.bet_ends_at,
    spinEndsAt: r.spin_ends_at,
    resultEndsAt: r.result_ends_at,
    totalBank: Number(r.total_bank) || 0,
    winnerTelegramId: r.winner_telegram_id != null ? Number(r.winner_telegram_id) : null,
    winnerAmount: r.winner_amount != null ? Number(r.winner_amount) : null,
    houseFee: r.house_fee != null ? Number(r.house_fee) : null,
    resultIndex: r.result_index,
    serverSeedHash: r.server_seed_hash,
    serverSeed:
      r.status === "finished" || r.status === "cancelled" ? r.server_seed : null,
    createdAt: r.created_at,
  };
}

export async function getPvpRouletteState(opts?: {
  telegramId?: number | null;
  presence?: boolean;
}) {
  if (opts?.presence && opts.telegramId) {
    touchPvpRoulettePresence(opts.telegramId);
  }

  let round = (await getActiveRound()) || (await getLatestRound());
  if (!round) {
    round = await createWaitingRound();
  }

  // Auto-advance on read so clients without cron still progress
  if (
    round.status === "betting" ||
    round.status === "spinning" ||
    (round.status === "finished" &&
      round.result_ends_at &&
      Date.now() >= new Date(round.result_ends_at).getTime())
  ) {
    round = await advancePvpRoulette();
  }

  const bets = await loadBets(round.id);
  const totalBank = Number(round.total_bank) || bets.reduce((s, b) => s + Number(b.amount), 0);
  let myBet = 0;
  if (opts?.telegramId) {
    const mine = bets.find((b) => Number(b.telegram_id) === Number(opts.telegramId));
    myBet = mine ? Number(mine.amount) : 0;
  }

  let balance: number | undefined;
  if (opts?.telegramId) {
    try {
      balance = await getBalance(opts.telegramId);
    } catch {
      /* */
    }
  }

  const history = await getRecentHistory(12);

  return {
    ok: true as const,
    round: publicRound(round),
    bets: publicBets(bets, totalBank),
    myBet,
    playerCount: bets.length,
    serverNow: new Date().toISOString(),
    serverMs: Date.now(),
    balance,
    online: countPvpRouletteOnline(),
    history,
  };
}

async function getRecentHistory(limit: number) {
  const db = getAdminClient();
  const { data: rounds } = await db
    .from("pvp_roulette_rounds")
    .select("id, winner_telegram_id, total_bank, winner_amount, created_at, status")
    .eq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!rounds?.length) return [];

  const winnerIds = [
    ...new Set(
      rounds
        .map((r) => r.winner_telegram_id)
        .filter((id): id is number => id != null)
    ),
  ];

  const nameMap = new Map<number, string>();
  const photoMap = new Map<number, string | null>();
  if (winnerIds.length) {
    const { data: profiles } = await db
      .from("profiles")
      .select("telegram_id, username, photo_url")
      .in("telegram_id", winnerIds);
    for (const p of profiles || []) {
      const tid = Number(p.telegram_id);
      nameMap.set(tid, p.username || "Player");
      photoMap.set(tid, (p as { photo_url?: string | null }).photo_url || null);
    }
  }

  return rounds.map((r) => {
    const tid =
      r.winner_telegram_id != null ? Number(r.winner_telegram_id) : null;
    return {
      id: r.id,
      winnerTelegramId: tid,
      winnerUsername: tid != null ? nameMap.get(tid) || "Player" : undefined,
      winnerAvatarUrl: tid != null ? photoMap.get(tid) ?? null : null,
      totalBank: Number(r.total_bank) || 0,
      winnerAmount: r.winner_amount != null ? Number(r.winner_amount) : null,
      createdAt: r.created_at,
    };
  });
}

export async function placePvpRouletteBet(params: {
  telegramId: number;
  username: string;
  avatarUrl?: string | null;
  amount: number;
}) {
  const { telegramId, username } = params;
  let amount = +Number(params.amount).toFixed(4);
  if (!Number.isFinite(amount) || amount < PVP_ROULETTE_MIN_BET) {
    throw new Error(`Min bet ${PVP_ROULETTE_MIN_BET} GRAM`);
  }
  if (amount > PVP_ROULETTE_MAX_BET) {
    throw new Error(`Max bet ${PVP_ROULETTE_MAX_BET} GRAM`);
  }

  let round = (await getActiveRound()) || (await createWaitingRound());

  if (round.status === "spinning" || round.status === "finished") {
    // Wait for result window or force advance
    if (
      round.status === "finished" &&
      round.result_ends_at &&
      Date.now() >= new Date(round.result_ends_at).getTime()
    ) {
      round = await advancePvpRoulette();
    } else if (round.status === "spinning") {
      throw new Error("Кручение уже идёт — дождитесь результата");
    } else {
      throw new Error("Раунд завершается — подождите");
    }
  }

  if (round.status === "cancelled") {
    round = await createWaitingRound();
  }

  // Lock window
  if (round.status === "betting" && round.bet_ends_at) {
    const ends = new Date(round.bet_ends_at).getTime();
    if (Date.now() >= ends - PVP_ROULETTE_BET_LOCK_MS) {
      throw new Error("Ставки закрыты");
    }
  }

  const db = getAdminClient();
  const existingBets = await loadBets(round.id);
  const myExisting = existingBets.find(
    (b) => Number(b.telegram_id) === Number(telegramId)
  );

  // New player — capacity check
  if (!myExisting && existingBets.length >= PVP_ROULETTE_MAX_PLAYERS) {
    throw new Error(`Максимум ${PVP_ROULETTE_MAX_PLAYERS} игроков за стол`);
  }

  // Debit only the delta if increasing stake
  const prev = myExisting ? Number(myExisting.amount) : 0;
  if (amount <= prev) {
    throw new Error(
      myExisting
        ? "Можно только увеличить ставку"
        : "Некорректная сумма"
    );
  }
  const delta = +(amount - prev).toFixed(4);

  // Debit from ledger (optimistic lock inside)
  const { balance } = await creditBalance(telegramId, -delta, "bet", {
    kind: "pvp_roulette_bet",
    round_id: round.id,
    amount: delta,
    username,
  });

  // Upsert bet
  if (myExisting) {
    const { error } = await db
      .from("pvp_roulette_bets")
      .update({
        amount,
        username: username || myExisting.username,
        avatar_url: params.avatarUrl ?? myExisting.avatar_url,
      })
      .eq("id", myExisting.id);
    if (error) {
      // refund
      try {
        await creditBalance(telegramId, delta, "refund", {
          kind: "pvp_roulette_bet_fail",
          round_id: round.id,
        });
      } catch {
        /* */
      }
      throw new Error(error.message || "Bet update failed");
    }
  } else {
    const { error } = await db.from("pvp_roulette_bets").insert({
      round_id: round.id,
      telegram_id: telegramId,
      username: username || "Player",
      avatar_url: params.avatarUrl || null,
      amount,
    });
    if (error) {
      try {
        await creditBalance(telegramId, delta, "refund", {
          kind: "pvp_roulette_bet_fail",
          round_id: round.id,
        });
      } catch {
        /* */
      }
      if (String(error.message || "").includes("unique") || error.code === "23505") {
        throw new Error("Уже есть ставка в этом раунде");
      }
      throw new Error(error.message || "Bet failed");
    }
  }

  // Recompute bank
  const betsAfter = await loadBets(round.id);
  const totalBank = betsAfter.reduce((s, b) => s + Number(b.amount), 0);

  const updates: Partial<PvpRoundRow> = {
    total_bank: totalBank,
  };

  // Start countdown when we reach min players
  if (
    (round.status === "waiting" || round.status === "betting") &&
    betsAfter.length >= PVP_ROULETTE_MIN_PLAYERS
  ) {
    if (round.status === "waiting" || !round.bet_ends_at) {
      updates.status = "betting";
      updates.bet_ends_at = new Date(
        Date.now() + PVP_ROULETTE_COUNTDOWN_SEC * 1000
      ).toISOString();
    }
  }

  const { data: updated } = await db
    .from("pvp_roulette_rounds")
    .update(updates)
    .eq("id", round.id)
    .select("*")
    .single();

  const finalRound = (updated as PvpRoundRow) || {
    ...round,
    ...updates,
  };

  const state = await getPvpRouletteState({ telegramId });
  return { ...state, balance };
}

async function refundAllBets(round: PvpRoundRow, bets: PvpBetRow[]) {
  for (const bet of bets) {
    const amt = Number(bet.amount) || 0;
    if (amt <= 0) continue;
    try {
      await creditBalance(Number(bet.telegram_id), amt, "refund", {
        kind: "pvp_roulette_cancel",
        round_id: round.id,
      });
    } catch (e) {
      console.error("[pvp-roulette] refund failed", bet.telegram_id, e);
    }
  }
}

async function settlePvpRound(round: PvpRoundRow): Promise<PvpRoundRow> {
  const db = getAdminClient();
  const bets = await loadBets(round.id);

  if (bets.length < PVP_ROULETTE_MIN_PLAYERS) {
    await refundAllBets(round, bets);
    const resultEnds = new Date(Date.now() + 2000).toISOString();
    const cancelSettle = await db
      .from("pvp_roulette_rounds")
      .update({
        status: "cancelled",
        server_seed: round.server_seed,
        result_ends_at: resultEnds,
        total_bank: 0,
      })
      .eq("id", round.id)
      .in("status", ["betting", "spinning"])
      .select("*")
      .maybeSingle();
    return (cancelSettle.data as PvpRoundRow | null) || round;
  }

  const seed = round.server_seed || randomSeed();
  // Use bets in creation order for visual strip index
  const ordered = [...bets];
  const idx = pickWinnerIndex(
    seed,
    round.id,
    ordered.map((b) => ({
      telegram_id: Number(b.telegram_id),
      amount: Number(b.amount),
    }))
  );
  const winner = ordered[idx];
  const totalBank = ordered.reduce((s, b) => s + Number(b.amount), 0);
  const houseFee = +(totalBank * PVP_ROULETTE_HOUSE_EDGE).toFixed(6);
  const winnerAmount = +(totalBank - houseFee).toFixed(6);

  // Credit winner
  try {
    await creditBalance(Number(winner.telegram_id), winnerAmount, "win", {
      kind: "pvp_roulette_win",
      round_id: round.id,
      amount: winnerAmount,
      bank: totalBank,
    });
  } catch (e) {
    console.error("[pvp-roulette] win credit failed", winner.telegram_id, e);
  }

  // House fee
  if (houseFee > 0) {
    try {
      await creditHouse(houseFee, "profit", "house_fee", {
        kind: "pvp_roulette",
        round_id: round.id,
      });
    } catch (e) {
      console.error("[pvp-roulette] house failed", e);
    }
    // Referral share proportional to each stake
    for (const bet of ordered) {
      const stake = Number(bet.amount) || 0;
      if (stake <= 0 || totalBank <= 0) continue;
      const slice = +((houseFee * stake) / totalBank).toFixed(6);
      if (slice < 0.0001) continue;
      try {
        await payReferralFromHouseFee(Number(bet.telegram_id), stake, slice);
      } catch {
        /* */
      }
    }
  }

  const resultEnds = new Date(Date.now() + PVP_ROULETTE_RESULT_MS).toISOString();
  const { data: done } = await db
    .from("pvp_roulette_rounds")
    .update({
      status: "finished",
      server_seed: seed,
      result_index: idx,
      winner_telegram_id: Number(winner.telegram_id),
      winner_amount: winnerAmount,
      house_fee: houseFee,
      total_bank: totalBank,
      result_ends_at: resultEnds,
    })
    .eq("id", round.id)
    .eq("status", "spinning")
    .select("*")
    .maybeSingle();

  return (done as PvpRoundRow) || (await getLatestRound()) || round;
}

/**
 * Advance global LIVE PvP roulette clock.
 * Safe to call from cron and from GET /state.
 */
export async function advancePvpRoulette(): Promise<PvpRoundRow> {
  let round = (await getActiveRound()) || (await getLatestRound());
  if (!round) return createWaitingRound();

  const db = getAdminClient();

  for (let step = 0; step < 8; step++) {
    const now = Date.now();
    const beforeStatus = round.status;
    const beforeId = round.id;

    if (round.status === "waiting") {
      // Stay until bets + min players (handled on bet)
      return round;
    }

    if (round.status === "betting") {
      if (!round.bet_ends_at || now < new Date(round.bet_ends_at).getTime()) {
        return round;
      }
      const bets = await loadBets(round.id);
      if (bets.length < PVP_ROULETTE_MIN_PLAYERS) {
        await refundAllBets(round, bets);
        const cancelRes = await db
          .from("pvp_roulette_rounds")
          .update({
            status: "cancelled",
            server_seed: round.server_seed,
            result_ends_at: new Date(now + 2000).toISOString(),
          })
          .eq("id", round.id)
          .eq("status", "betting")
          .select("*")
          .maybeSingle();
        const cancelData = cancelRes.data as PvpRoundRow | null;
        round = cancelData || round;
        continue;
      }

      // Prep + spin window — precompute winner index (seed stays hidden until settle)
      const seed = round.server_seed || randomSeed();
      const orderedBets = bets;
      const idx = pickWinnerIndex(
        seed,
        round.id,
        orderedBets.map((b) => ({
          telegram_id: Number(b.telegram_id),
          amount: Number(b.amount),
        }))
      );
      const spinEnds = new Date(
        now + PVP_ROULETTE_PREP_MS + PVP_ROULETTE_SPIN_MS
      ).toISOString();
      const spinRes = await db
        .from("pvp_roulette_rounds")
        .update({
          status: "spinning",
          spin_ends_at: spinEnds,
          result_index: idx,
        })
        .eq("id", round.id)
        .eq("status", "betting")
        .select("*")
        .maybeSingle();
      const spinData = spinRes.data as PvpRoundRow | null;
      if (spinData) round = spinData;
      else round = (await getActiveRound()) || round;
      continue;
    }

    if (round.status === "spinning") {
      if (round.spin_ends_at && now < new Date(round.spin_ends_at).getTime()) {
        return round;
      }
      round = await settlePvpRound(round);
      continue;
    }

    if (round.status === "finished" || round.status === "cancelled") {
      if (
        round.result_ends_at &&
        now < new Date(round.result_ends_at).getTime()
      ) {
        return round;
      }
      // Open next waiting round
      round = await createWaitingRound();
      return round;
    }

    if (round.id === beforeId && round.status === beforeStatus) break;
  }

  return round;
}

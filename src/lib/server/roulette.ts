import crypto from "crypto";
import { getAdminClient } from "./supabase";
import { creditBalance, getBalance } from "./ledger";
import { creditHouse } from "./house";
import { payReferralFromHouseFee } from "./referral";
import {
  ROULETTE_COUNTDOWN_SEC,
  ROULETTE_SPIN_MS,
  ROULETTE_RESULT_MS,
  ROULETTE_MIN_BET,
  ROULETTE_MAX_BET,
  ROULETTE_MAX_STAKE_PER_ROUND,
  ROULETTE_BET_LOCK_MS,
  ROULETTE_WHEEL,
  ROULETTE_SLOT_COUNT,
  ROULETTE_MULT,
  rouletteColorAt,
  type RouletteColor,
} from "@/lib/rouletteConstants";

export type RoundStatus = "betting" | "spinning" | "settled";

export type RouletteRoundRow = {
  id: string;
  status: RoundStatus;
  bet_ends_at: string;
  spin_ends_at: string | null;
  result_ends_at: string | null;
  server_seed_hash: string;
  server_seed: string | null;
  result_slot: number | null;
  result_color: RouletteColor | null;
  created_at: string;
};

export type RouletteBetRow = {
  id: string;
  round_id: string;
  telegram_id: number;
  username: string;
  color: RouletteColor;
  amount: number;
  payout: number | null;
  created_at: string;
};

function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function randomSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function slotFromSeed(serverSeed: string, roundId: string): number {
  const h = crypto.createHmac("sha256", serverSeed).update(roundId).digest();
  return h.readUInt32BE(0) % ROULETTE_SLOT_COUNT;
}

/** In-memory LIVE viewers (per serverless instance; good enough for Hobby) */
const presenceMap = new Map<number, number>();
const PRESENCE_TTL_MS = 45_000;

export function touchRoulettePresence(telegramId: number) {
  if (!telegramId) return;
  presenceMap.set(Number(telegramId), Date.now());
}

export function countRouletteOnline(): number {
  const now = Date.now();
  let n = 0;
  for (const [id, t] of presenceMap) {
    if (now - t < PRESENCE_TTL_MS) n += 1;
    else presenceMap.delete(id);
  }
  return n;
}

function isColor(c: unknown): c is RouletteColor {
  return c === "red" || c === "black" || c === "green";
}

/** Prefer an in-progress round so we never run two LIVE rounds at once */
async function getActiveRound(): Promise<RouletteRoundRow | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("roulette_rounds")
    .select("*")
    .in("status", ["betting", "spinning"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RouletteRoundRow) || null;
}

async function getLatestRound(): Promise<RouletteRoundRow | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("roulette_rounds")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RouletteRoundRow) || null;
}

async function createBettingRound(): Promise<RouletteRoundRow> {
  // Guard: if another request already opened a round, reuse it
  const existing = await getActiveRound();
  if (existing) return existing;

  const db = getAdminClient();
  const seed = randomSeed();
  const betEnds = new Date(
    Date.now() + ROULETTE_COUNTDOWN_SEC * 1000
  ).toISOString();

  const { data, error } = await db
    .from("roulette_rounds")
    .insert({
      status: "betting",
      bet_ends_at: betEnds,
      spin_ends_at: null,
      result_ends_at: null,
      server_seed_hash: hashSeed(seed),
      server_seed: seed,
      result_slot: null,
      result_color: null,
    })
    .select("*")
    .single();

  if (error || !data) {
    // concurrent insert race → return active
    const again = await getActiveRound();
    if (again) return again;
    throw new Error(error?.message || "Failed to create roulette round");
  }
  return data as RouletteRoundRow;
}

/**
 * Pay winners + house. Must only run once per round.
 * Sets status=settled AND result_ends_at in one write after payouts
 * so clients keep the result phase for RESULT_MS.
 */
async function settleRound(round: RouletteRoundRow): Promise<RouletteRoundRow> {
  const db = getAdminClient();

  // Lock: claim settlement (spinning → settling via status settled only after work)
  // Use result_slot already set during spin transition.
  const seed = round.server_seed || randomSeed();
  const slot =
    round.result_slot != null
      ? Number(round.result_slot)
      : slotFromSeed(seed, round.id);
  const color = rouletteColorAt(slot);

  // Mark in-progress settlement with result fields first while still spinning
  // then pay, then set settled+result_ends_at together.
  const { data: claimed } = await db
    .from("roulette_rounds")
    .update({
      server_seed: seed,
      result_slot: slot,
      result_color: color,
    })
    .eq("id", round.id)
    .eq("status", "spinning")
    .select("*")
    .maybeSingle();

  if (!claimed) {
    // already moved on
    return (await getLatestRound()) || round;
  }

  const { data: bets } = await db
    .from("roulette_bets")
    .select("*")
    .eq("round_id", round.id);

  const list = (bets || []) as RouletteBetRow[];
  let totalStakes = 0;
  let totalPayouts = 0;

  for (const bet of list) {
    // skip if already paid
    if (bet.payout != null) {
      totalStakes += Number(bet.amount) || 0;
      totalPayouts += Number(bet.payout) || 0;
      continue;
    }

    const stake = Number(bet.amount) || 0;
    totalStakes += stake;
    const won = bet.color === color;
    const payout = won ? +(stake * ROULETTE_MULT[bet.color]).toFixed(6) : 0;

    await db.from("roulette_bets").update({ payout }).eq("id", bet.id);

    if (payout > 0) {
      totalPayouts += payout;
      try {
        await creditBalance(bet.telegram_id, payout, "win", {
          kind: "roulette_win",
          round_id: round.id,
          color: bet.color,
          amount: stake,
          payout,
        });
      } catch (e) {
        console.error("[roulette] win credit failed", bet.telegram_id, e);
      }
    }
  }

  const houseNet = +(totalStakes - totalPayouts).toFixed(6);
  if (houseNet > 0) {
    try {
      await creditHouse(houseNet, "profit", "house_fee", {
        kind: "roulette",
        round_id: round.id,
      });
    } catch (e) {
      console.error("[roulette] house failed", e);
    }
    for (const bet of list) {
      const stake = Number(bet.amount) || 0;
      if (stake <= 0 || totalStakes <= 0) continue;
      const slice = +((houseNet * stake) / totalStakes).toFixed(6);
      if (slice < 0.0001) continue;
      try {
        await payReferralFromHouseFee(bet.telegram_id, stake, slice);
      } catch {
        /* */
      }
    }
  }

  const resultEnds = new Date(Date.now() + ROULETTE_RESULT_MS).toISOString();
  const { data: done } = await db
    .from("roulette_rounds")
    .update({
      status: "settled",
      server_seed: seed,
      result_slot: slot,
      result_color: color,
      result_ends_at: resultEnds,
    })
    .eq("id", round.id)
    .eq("status", "spinning")
    .select("*")
    .maybeSingle();

  return (done as RouletteRoundRow) || (await getLatestRound()) || round;
}

export async function advanceRoulette(): Promise<RouletteRoundRow> {
  // Always prefer active (betting/spinning) over a settled latest
  let round = (await getActiveRound()) || (await getLatestRound());
  if (!round) return createBettingRound();

  const now = Date.now();

  // betting → spinning
  if (round.status === "betting") {
    if (now >= new Date(round.bet_ends_at).getTime()) {
      const seed = round.server_seed || randomSeed();
      const slot = slotFromSeed(seed, round.id);
      const spinEnds = new Date(now + ROULETTE_SPIN_MS).toISOString();

      const { data } = await dbUpdateSpinning(round.id, {
        seed,
        slot,
        color: rouletteColorAt(slot),
        spinEnds,
      });

      round = data || (await getActiveRound()) || (await getLatestRound())!;
    }
    return round;
  }

  // spinning → settle (payouts + settled + result_ends_at)
  if (round.status === "spinning") {
    const spinEnds = round.spin_ends_at
      ? new Date(round.spin_ends_at).getTime()
      : 0;
    if (now >= spinEnds) {
      round = await settleRound(round);
    }
    return round;
  }

  // settled → wait RESULT_MS then new betting round
  if (round.status === "settled") {
    const resultEnds = round.result_ends_at
      ? new Date(round.result_ends_at).getTime()
      : 0;
    // If result_ends_at missing (legacy bug), give a short window then advance
    const ready =
      !round.result_ends_at || now >= resultEnds || resultEnds === 0;
    if (ready && round.result_ends_at && now >= resultEnds) {
      return createBettingRound();
    }
    if (!round.result_ends_at) {
      // heal legacy row
      const db = getAdminClient();
      const healed = new Date(now + ROULETTE_RESULT_MS).toISOString();
      await db
        .from("roulette_rounds")
        .update({ result_ends_at: healed })
        .eq("id", round.id)
        .is("result_ends_at", null);
      return (await getLatestRound()) || round;
    }
    return round;
  }

  return round;
}

async function dbUpdateSpinning(
  id: string,
  opts: { seed: string; slot: number; color: RouletteColor; spinEnds: string }
): Promise<{ data: RouletteRoundRow | null }> {
  const db = getAdminClient();
  const { data } = await db
    .from("roulette_rounds")
    .update({
      status: "spinning",
      server_seed: opts.seed,
      result_slot: opts.slot,
      result_color: opts.color,
      spin_ends_at: opts.spinEnds,
    })
    .eq("id", id)
    .eq("status", "betting")
    .select("*")
    .maybeSingle();
  return { data: (data as RouletteRoundRow) || null };
}


/** Sequential number starting at 0, counting all prior rounds (includes past games). */
async function getGameNo(round: RouletteRoundRow): Promise<number> {
  const db = getAdminClient();
  const { count } = await db
    .from("roulette_rounds")
    .select("id", { count: "exact", head: true })
    .lt("created_at", round.created_at);
  return count ?? 0;
}

export async function getRouletteState(
  telegramId?: number | null,
  opts?: { touchPresence?: boolean }
) {
  if (opts?.touchPresence && telegramId) touchRoulettePresence(telegramId);
  const round = await advanceRoulette();
  const db = getAdminClient();

  const { data: bets } = await db
    .from("roulette_bets")
    .select(
      "id, round_id, telegram_id, username, color, amount, payout, created_at"
    )
    .eq("round_id", round.id);

  const list = (bets || []) as RouletteBetRow[];
  const pools: Record<RouletteColor, number> = { red: 0, black: 0, green: 0 };
  const myBets: Record<RouletteColor, number> = { red: 0, black: 0, green: 0 };
  const seen = new Set<number>();

  // Aggregate stakes per user per color (for avatar strip under buttons)
  type Agg = {
    telegramId: number;
    username: string;
    amount: number;
  };
  const agg: Record<RouletteColor, Map<number, Agg>> = {
    red: new Map(),
    black: new Map(),
    green: new Map(),
  };

  for (const b of list) {
    const amt = Number(b.amount) || 0;
    pools[b.color] = +(pools[b.color] + amt).toFixed(6);
    seen.add(b.telegram_id);
    if (telegramId && b.telegram_id === telegramId) {
      myBets[b.color] = +(myBets[b.color] + amt).toFixed(6);
    }
    const m = agg[b.color];
    const prev = m.get(b.telegram_id);
    if (prev) {
      prev.amount = +(prev.amount + amt).toFixed(6);
    } else {
      m.set(b.telegram_id, {
        telegramId: b.telegram_id,
        username: b.username || "Player",
        amount: amt,
      });
    }
  }

  // Photos from profiles
  const allIds = Array.from(seen);
  const photoMap = new Map<number, string | null>();
  if (allIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("telegram_id, photo_url")
      .in("telegram_id", allIds);
    for (const pr of profiles || []) {
      photoMap.set(Number(pr.telegram_id), (pr.photo_url as string) || null);
    }
  }

  const betsByColor: Record<
    RouletteColor,
    Array<{
      telegramId: number;
      username: string;
      photoUrl: string | null;
      amount: number;
    }>
  > = { red: [], black: [], green: [] };

  for (const color of ["red", "black", "green"] as RouletteColor[]) {
    betsByColor[color] = Array.from(agg[color].values())
      .map((a) => ({
        telegramId: a.telegramId,
        username: a.username,
        photoUrl: photoMap.get(a.telegramId) ?? null,
        amount: a.amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12);
  }

  const reveal = round.status === "spinning" || round.status === "settled";

  const { data: hist } = await db
    .from("roulette_rounds")
    .select("id, result_color, result_slot, created_at")
    .eq("status", "settled")
    .not("result_color", "is", null)
    .order("created_at", { ascending: false })
    .limit(24);

  return {
    round: {
      id: round.id,
      status: round.status,
      betEndsAt: round.bet_ends_at,
      spinEndsAt: round.spin_ends_at,
      resultEndsAt: round.result_ends_at,
      serverSeedHash: round.server_seed_hash,
      serverSeed: round.status === "settled" ? round.server_seed : null,
      resultSlot: reveal ? round.result_slot : null,
      resultColor: reveal ? round.result_color : null,
      gameNo: await getGameNo(round),
      createdAt: round.created_at,
    },
    pools,
    myBets,
    myTotal: +(myBets.red + myBets.black + myBets.green).toFixed(6),
    bettors: seen.size,
    betsByColor,
    history: (hist || []).map((h) => ({
      id: h.id as string,
      color: h.result_color as RouletteColor,
      slot: h.result_slot as number,
    })),
    wheel: ROULETTE_WHEEL,
    mult: ROULETTE_MULT,
    serverNow: new Date().toISOString(),
    serverMs: Date.now(),
    balance:
      telegramId != null && telegramId > 0
        ? await getBalance(telegramId).catch(() => null)
        : null,
    // Real "playing": unique users with a stake on this open round
    online:
      round.status === "betting" || round.status === "spinning"
        ? seen.size
        : 0,
  };
}

/** Serialize bets per telegram user (prevents race over max stake) */
const betLockTail = new Map<number, Promise<unknown>>();

async function withRouletteBetLock<T>(
  telegramId: number,
  fn: () => Promise<T>
): Promise<T> {
  const prev = betLockTail.get(telegramId) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const tail = prev.then(() => gate);
  betLockTail.set(telegramId, tail);
  try {
    await prev.catch(() => {});
    return await fn();
  } finally {
    release();
  }
}

export async function placeRouletteBet(opts: {
  telegramId: number;
  username: string;
  color: RouletteColor;
  amount: number;
}) {
  const { telegramId, username, color, amount } = opts;
  if (!isColor(color)) throw new Error("Invalid color");
  if (!Number.isFinite(amount) || amount < ROULETTE_MIN_BET) {
    throw new Error(`Min bet ${ROULETTE_MIN_BET} GRAM`);
  }
  if (amount > ROULETTE_MAX_BET) {
    throw new Error(`Max bet ${ROULETTE_MAX_BET} GRAM`);
  }

  return withRouletteBetLock(telegramId, async () => {
    const round = await advanceRoulette();
    if (round.status !== "betting") throw new Error("Bets closed");

    const msLeft = new Date(round.bet_ends_at).getTime() - Date.now();
    if (msLeft < ROULETTE_BET_LOCK_MS) throw new Error("Bets closed");

    const db = getAdminClient();
    const { data: existing } = await db
      .from("roulette_bets")
      .select("id, amount")
      .eq("round_id", round.id)
      .eq("telegram_id", telegramId);

    const already = (existing || []).reduce(
      (s, r) => s + (Number(r.amount) || 0),
      0
    );
    if (already + amount > ROULETTE_MAX_STAKE_PER_ROUND + 1e-9) {
      throw new Error(
        `Max ${ROULETTE_MAX_STAKE_PER_ROUND} GRAM per round`
      );
    }

    // Debit with optimistic balance_version lock (prevents negative balance)
    const { balance } = await creditBalance(telegramId, -amount, "bet", {
      kind: "roulette_bet",
      round_id: round.id,
      color,
      amount,
      username,
    });

    // Re-check stake AFTER debit (multi-instance race on Vercel)
    const { data: existing2 } = await db
      .from("roulette_bets")
      .select("id, amount")
      .eq("round_id", round.id)
      .eq("telegram_id", telegramId);
    const already2 = (existing2 || []).reduce(
      (s, r) => s + (Number(r.amount) || 0),
      0
    );
    if (already2 + amount > ROULETTE_MAX_STAKE_PER_ROUND + 1e-9) {
      try {
        await creditBalance(telegramId, amount, "refund", {
          kind: "roulette_bet_over_cap_pre",
          round_id: round.id,
        });
      } catch {
        /* */
      }
      throw new Error(
        `Max ${ROULETTE_MAX_STAKE_PER_ROUND} GRAM per round`
      );
    }

    // Round may have flipped to spinning while we debited
    const roundNow = await getActiveRound();
    if (
      !roundNow ||
      roundNow.id !== round.id ||
      roundNow.status !== "betting"
    ) {
      try {
        await creditBalance(telegramId, amount, "refund", {
          kind: "roulette_bet_closed",
          round_id: round.id,
        });
      } catch {
        /* */
      }
      throw new Error("Bets closed");
    }

    const { data: inserted, error } = await db
      .from("roulette_bets")
      .insert({
        round_id: round.id,
        telegram_id: telegramId,
        username: String(username || "Player").slice(0, 64),
        color,
        amount,
        payout: null,
      })
      .select("id, amount")
      .single();

    if (error || !inserted) {
      try {
        await creditBalance(telegramId, amount, "refund", {
          kind: "roulette_bet_fail",
          round_id: round.id,
        });
      } catch {
        /* */
      }
      throw new Error(error?.message || "Bet failed");
    }

    // Hard cap: re-sum after insert (safety vs multi-instance races)
    const { data: after } = await db
      .from("roulette_bets")
      .select("id, amount")
      .eq("round_id", round.id)
      .eq("telegram_id", telegramId);

    const total = (after || []).reduce(
      (s, r) => s + (Number(r.amount) || 0),
      0
    );
    if (total > ROULETTE_MAX_STAKE_PER_ROUND + 1e-9) {
      await db.from("roulette_bets").delete().eq("id", inserted.id);
      try {
        await creditBalance(telegramId, amount, "refund", {
          kind: "roulette_bet_over_cap",
          round_id: round.id,
        });
      } catch {
        /* */
      }
      throw new Error(
        `Max ${ROULETTE_MAX_STAKE_PER_ROUND} GRAM per round`
      );
    }

    const state = await getRouletteState(telegramId);
    let bal2 = balance;
    try {
      bal2 = await getBalance(telegramId);
    } catch {
      /* keep ledger result */
    }
    return { balance: bal2, state };
  });
}

export async function getRouletteHistory(limit = 40) {
  const db = getAdminClient();
  const { data } = await db
    .from("roulette_rounds")
    .select(
      "id, result_color, result_slot, server_seed, server_seed_hash, created_at"
    )
    .eq("status", "settled")
    .not("result_color", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { history: data || [] };
}

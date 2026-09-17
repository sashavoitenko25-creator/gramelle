import crypto from "crypto";
import { getAdminClient } from "./supabase";
import { creditBalance } from "./ledger";
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

/** Provably-fair slot in [0, SLOT_COUNT) */
export function slotFromSeed(serverSeed: string, roundId: string): number {
  const h = crypto.createHmac("sha256", serverSeed).update(roundId).digest();
  return h.readUInt32BE(0) % ROULETTE_SLOT_COUNT;
}

function isColor(c: unknown): c is RouletteColor {
  return c === "red" || c === "black" || c === "green";
}

async function createBettingRound(): Promise<RouletteRoundRow> {
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
    throw new Error(error?.message || "Failed to create roulette round");
  }
  return data as RouletteRoundRow;
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

async function settleRound(round: RouletteRoundRow): Promise<void> {
  const db = getAdminClient();

  // Idempotent: only settle from spinning
  const { data: locked } = await db
    .from("roulette_rounds")
    .update({ status: "settled" })
    .eq("id", round.id)
    .eq("status", "spinning")
    .select("*")
    .maybeSingle();

  if (!locked) return; // already settled or race lost

  const seed = (locked as RouletteRoundRow).server_seed || randomSeed();
  const slot =
    (locked as RouletteRoundRow).result_slot != null
      ? Number((locked as RouletteRoundRow).result_slot)
      : slotFromSeed(seed, round.id);
  const color = rouletteColorAt(slot);

  const { data: bets } = await db
    .from("roulette_bets")
    .select("*")
    .eq("round_id", round.id);

  const list = (bets || []) as RouletteBetRow[];
  let totalStakes = 0;
  let totalPayouts = 0;

  for (const bet of list) {
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
      console.error("[roulette] house credit failed", e);
    }
    for (const bet of list) {
      const stake = Number(bet.amount) || 0;
      if (stake <= 0 || totalStakes <= 0) continue;
      const slice = +((houseNet * stake) / totalStakes).toFixed(6);
      if (slice < 0.0001) continue;
      try {
        await payReferralFromHouseFee(bet.telegram_id, stake, slice);
      } catch {
        /* ignore referral errors */
      }
    }
  }

  const resultEnds = new Date(Date.now() + ROULETTE_RESULT_MS).toISOString();
  await db
    .from("roulette_rounds")
    .update({
      server_seed: seed,
      result_slot: slot,
      result_color: color,
      result_ends_at: resultEnds,
    })
    .eq("id", round.id);
}

/**
 * Advance the single global round based on server time.
 * Called on every state poll — must be safe under concurrency.
 */
export async function advanceRoulette(): Promise<RouletteRoundRow> {
  const db = getAdminClient();
  let round = await getLatestRound();
  if (!round) return createBettingRound();

  const now = Date.now();

  if (round.status === "betting" && now >= new Date(round.bet_ends_at).getTime()) {
    const seed = round.server_seed || randomSeed();
    const slot = slotFromSeed(seed, round.id);
    const spinEnds = new Date(now + ROULETTE_SPIN_MS).toISOString();

    const { data } = await db
      .from("roulette_rounds")
      .update({
        status: "spinning",
        server_seed: seed,
        result_slot: slot,
        result_color: rouletteColorAt(slot),
        spin_ends_at: spinEnds,
      })
      .eq("id", round.id)
      .eq("status", "betting")
      .select("*")
      .maybeSingle();

    round = (data as RouletteRoundRow) || (await getLatestRound())!;
  }

  if (round.status === "spinning") {
    const spinEnds = round.spin_ends_at
      ? new Date(round.spin_ends_at).getTime()
      : 0;
    if (now >= spinEnds) {
      await settleRound(round);
      round = (await getLatestRound())!;
    }
  }

  if (round.status === "settled") {
    const resultEnds = round.result_ends_at
      ? new Date(round.result_ends_at).getTime()
      : 0;
    if (!round.result_ends_at || now >= resultEnds) {
      const latest = await getLatestRound();
      if (latest && latest.id === round.id && latest.status === "settled") {
        return createBettingRound();
      }
      return latest!;
    }
  }

  return round;
}

export async function getRouletteState(telegramId?: number | null) {
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
  let bettors = 0;
  const seen = new Set<number>();

  for (const b of list) {
    const amt = Number(b.amount) || 0;
    pools[b.color] = +(pools[b.color] + amt).toFixed(6);
    if (!seen.has(b.telegram_id)) {
      seen.add(b.telegram_id);
      bettors += 1;
    }
    if (telegramId && b.telegram_id === telegramId) {
      myBets[b.color] = +(myBets[b.color] + amt).toFixed(6);
    }
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
      serverSeed: reveal ? round.server_seed : null,
      resultSlot: reveal ? round.result_slot : null,
      resultColor: reveal ? round.result_color : null,
      createdAt: round.created_at,
    },
    pools,
    myBets,
    myTotal: +(myBets.red + myBets.black + myBets.green).toFixed(6),
    bettors,
    history: (hist || []).map((h) => ({
      id: h.id as string,
      color: h.result_color as RouletteColor,
      slot: h.result_slot as number,
    })),
    wheel: ROULETTE_WHEEL,
    mult: ROULETTE_MULT,
    serverNow: new Date().toISOString(),
    serverMs: Date.now(),
  };
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

  const round = await advanceRoulette();
  if (round.status !== "betting") throw new Error("Bets closed");

  const msLeft = new Date(round.bet_ends_at).getTime() - Date.now();
  if (msLeft < ROULETTE_BET_LOCK_MS) throw new Error("Bets closed");

  const db = getAdminClient();
  const { data: existing } = await db
    .from("roulette_bets")
    .select("amount")
    .eq("round_id", round.id)
    .eq("telegram_id", telegramId);

  const already = (existing || []).reduce(
    (s, r) => s + (Number(r.amount) || 0),
    0
  );
  if (already + amount > ROULETTE_MAX_STAKE_PER_ROUND + 1e-9) {
    throw new Error(`Max ${ROULETTE_MAX_STAKE_PER_ROUND} GRAM per round`);
  }

  const { balance } = await creditBalance(telegramId, -amount, "bet", {
    kind: "roulette_bet",
    round_id: round.id,
    color,
    amount,
    username,
  });

  const { error } = await db.from("roulette_bets").insert({
    round_id: round.id,
    telegram_id: telegramId,
    username: String(username || "Player").slice(0, 64),
    color,
    amount,
    payout: null,
  });

  if (error) {
    try {
      await creditBalance(telegramId, amount, "refund", {
        kind: "roulette_bet_fail",
        round_id: round.id,
      });
    } catch {
      /* */
    }
    throw new Error(error.message || "Bet failed");
  }

  const state = await getRouletteState(telegramId);
  return { balance, state };
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

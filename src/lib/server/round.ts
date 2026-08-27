import crypto from "crypto";
import { getAdminClient } from "./supabase";
import { creditBalance, recordWinStats } from "./ledger";
import {
  ROOMS,
  DEFAULT_ROOM,
  type RoomMode,
  type RoomConfig,
} from "@/lib/constants";

export interface RoundBet {
  telegram_id: number;
  username: string;
  amount: number;
  color: string;
}

export interface RoundRow {
  id: string;
  roll_id: number;
  mode: RoomMode;
  status: "open" | "countdown" | "spinning" | "finished";
  server_seed_hash: string;
  server_seed?: string | null;
  client_seed?: string | null;
  winner_telegram_id?: number | null;
  total_bank: number;
  house_fee?: number | null;
  pot_after_fee?: number | null;
  spin_degrees?: number | null;
  countdown_ends_at?: string | null;
  version: number;
  created_at: string;
}

function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function randomSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Deterministic 0..1 from seeds — same inputs → same result on every server */
export function seededRandom(
  serverSeed: string,
  clientSeed: string,
  rollId: number
): number {
  const h = crypto
    .createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${rollId}`)
    .digest("hex");
  return parseInt(h.slice(0, 13), 16) / 0x1fffffffffffff;
}

export function getRoomConfig(mode: RoomMode): RoomConfig {
  return ROOMS[mode] || ROOMS[DEFAULT_ROOM];
}

export async function getOpenRound(
  mode: RoomMode = DEFAULT_ROOM
): Promise<RoundRow | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("rounds")
    .select("*")
    .eq("mode", mode)
    .in("status", ["open", "countdown", "spinning"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RoundRow) || null;
}

export async function ensureOpenRound(
  mode: RoomMode = DEFAULT_ROOM
): Promise<RoundRow> {
  const existing = await getOpenRound(mode);
  if (existing) return existing;

  const db = getAdminClient();
  const serverSeed = randomSeed();
  const serverSeedHash = hashSeed(serverSeed);

  const { data: last } = await db
    .from("rounds")
    .select("roll_id")
    .order("roll_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rollId = (last?.roll_id || 600000) + 1;

  const { data, error } = await db
    .from("rounds")
    .insert({
      roll_id: rollId,
      mode,
      status: "open",
      server_seed_hash: serverSeedHash,
      server_seed: serverSeed,
      total_bank: 0,
      version: 0,
    })
    .select("*")
    .single();

  if (error) {
    // race: another process created it
    const again = await getOpenRound(mode);
    if (again) return again;
    throw error;
  }
  return data as RoundRow;
}

export async function placeBet(opts: {
  telegramId: number;
  username: string;
  amount: number;
  color: string;
  mode?: RoomMode;
}): Promise<{ round: RoundRow; bets: RoundBet[]; balance: number }> {
  const mode = opts.mode || DEFAULT_ROOM;
  const room = getRoomConfig(mode);
  const { telegramId, username, amount, color } = opts;

  if (amount < room.minBet) {
    throw new Error(`Min bet ${room.minBet} GRAM`);
  }
  if (amount > room.maxBet) {
    throw new Error(`Max bet ${room.maxBet} GRAM`);
  }

  let round = await ensureOpenRound(mode);

  if (round.status === "spinning" || round.status === "finished") {
    throw new Error("Round is closed — wait for next");
  }
  // Late bets during last 1s of countdown blocked
  if (
    round.status === "countdown" &&
    round.countdown_ends_at &&
    new Date(round.countdown_ends_at).getTime() - Date.now() < 1000
  ) {
    throw new Error("Betting closed");
  }

  const db = getAdminClient();

  const { data: existingBets } = await db
    .from("round_bets")
    .select("*")
    .eq("round_id", round.id);

  const bets = (existingBets || []) as RoundBet[];
  const unique = new Set(bets.map((b) => b.telegram_id));

  if (!unique.has(telegramId) && unique.size >= room.maxPlayers) {
    throw new Error("Round is full");
  }

  // Debit first (atomic enough via ledger)
  const { balance } = await creditBalance(telegramId, -amount, "bet", {
    round_id: round.id,
    roll_id: round.roll_id,
    mode,
  });

  const mine = bets.find((b) => b.telegram_id === telegramId);
  if (mine) {
    // raise — still one row per player (anti-double seat)
    await db
      .from("round_bets")
      .update({ amount: +(Number(mine.amount) + amount).toFixed(4) })
      .eq("round_id", round.id)
      .eq("telegram_id", telegramId);
  } else {
    await db.from("round_bets").insert({
      round_id: round.id,
      telegram_id: telegramId,
      username,
      amount,
      color,
    });
  }

  const newBank = +(Number(round.total_bank) + amount).toFixed(4);
  await db.from("rounds").update({ total_bank: newBank }).eq("id", round.id);

  const { data: allBets } = await db
    .from("round_bets")
    .select("telegram_id, username, amount, color")
    .eq("round_id", round.id);

  const list = (allBets || []) as RoundBet[];

  // Start countdown at 2+ unique players
  if (list.length >= 2 && round.status === "open") {
    const ends = new Date(
      Date.now() + room.countdownSec * 1000
    ).toISOString();
    const { data: updated } = await db
      .from("rounds")
      .update({
        status: "countdown",
        countdown_ends_at: ends,
        version: (round.version || 0) + 1,
      })
      .eq("id", round.id)
      .eq("status", "open")
      .select("*")
      .maybeSingle();

    if (updated) {
      round = updated as RoundRow;
    } else {
      round.status = "countdown";
      round.countdown_ends_at = ends;
    }
  }

  round.total_bank = newBank;
  return { round, bets: list, balance };
}

/**
 * Authority spin — only one winner of the race via status open/countdown → spinning.
 * Safe to call from many clients / cron; only first succeeds.
 */
export async function spinRound(
  roundId?: string,
  mode: RoomMode = DEFAULT_ROOM
): Promise<{
  round: RoundRow;
  winner: RoundBet;
  spinDegrees: number;
  mult: number;
  houseFee: number;
  potAfterFee: number;
  bets: RoundBet[];
}> {
  const db = getAdminClient();
  let round: RoundRow | null = null;

  if (roundId) {
    const { data } = await db
      .from("rounds")
      .select("*")
      .eq("id", roundId)
      .maybeSingle();
    round = data as RoundRow;
  } else {
    round = await getOpenRound(mode);
  }

  if (!round) throw new Error("No active round");
  if (round.status === "finished") throw new Error("Already finished");
  if (round.status === "spinning") throw new Error("Already spinning");

  const room = getRoomConfig((round.mode as RoomMode) || mode);

  // Claim authority: only one transition to spinning
  const { data: claimed, error: claimErr } = await db
    .from("rounds")
    .update({
      status: "spinning",
      version: (round.version || 0) + 1,
    })
    .eq("id", round.id)
    .in("status", ["open", "countdown"])
    .select("*")
    .maybeSingle();

  if (claimErr || !claimed) {
    throw new Error("Spin already claimed");
  }
  round = claimed as RoundRow;

  const { data: betsData } = await db
    .from("round_bets")
    .select("telegram_id, username, amount, color")
    .eq("round_id", round.id);

  const bets = (betsData || []) as RoundBet[];
  if (bets.length < 2) {
    // rollback to open
    await db
      .from("rounds")
      .update({ status: "open", countdown_ends_at: null })
      .eq("id", round.id);
    throw new Error("Need at least 2 players");
  }

  const serverSeed = round.server_seed || randomSeed();
  const clientSeed = round.client_seed || "gramelle";
  const roll = seededRandom(serverSeed, clientSeed, round.roll_id);

  const total = bets.reduce((s, b) => s + Number(b.amount), 0);
  const houseFee = +(total * room.houseEdge).toFixed(4);
  const potAfterFee = +(total - houseFee).toFixed(4);

  let cursor = roll * total;
  let winner = bets[0];
  for (const b of bets) {
    cursor -= Number(b.amount);
    if (cursor <= 0) {
      winner = b;
      break;
    }
  }

  // Animation degrees — deterministic from seed so all clients match
  let acc = 0;
  let winnerStart = 0;
  let winnerSize = 0;
  for (const b of bets) {
    const size = (Number(b.amount) / total) * 360;
    if (b.telegram_id === winner.telegram_id) {
      winnerStart = acc;
      winnerSize = size;
      break;
    }
    acc += size;
  }
  const mid = winnerStart + winnerSize / 2;
  const extraSpins =
    5 + Math.floor(seededRandom(serverSeed, "spin-extra", round.roll_id) * 3);
  const jitter = seededRandom(serverSeed, "spin-jitter", round.roll_id) * 6 - 3;
  const spinDegrees = +(extraSpins * 360 + (360 - mid) + jitter).toFixed(3);

  const mult = +(potAfterFee / Number(winner.amount)).toFixed(4);

  await creditBalance(winner.telegram_id, potAfterFee, "win", {
    round_id: round.id,
    roll_id: round.roll_id,
    mult,
    house_fee: houseFee,
  });

  await db
    .from("rounds")
    .update({
      status: "finished",
      server_seed: serverSeed,
      winner_telegram_id: winner.telegram_id,
      spin_degrees: spinDegrees,
      total_bank: total,
      house_fee: houseFee,
      pot_after_fee: potAfterFee,
      version: (round.version || 0) + 1,
    })
    .eq("id", round.id);

  for (const b of bets) {
    await db.from("game_history").insert({
      roll_id: round.roll_id,
      winner: winner.username,
      chance: +((Number(winner.amount) / total) * 100).toFixed(2),
      win_amount: potAfterFee,
      mult,
      bet: b.amount,
      is_me: b.telegram_id === winner.telegram_id,
      telegram_id: b.telegram_id,
    });
  }

  for (const b of bets) {
    try {
      await recordWinStats(
        b.telegram_id,
        potAfterFee,
        b.telegram_id === winner.telegram_id
      );
    } catch {}
  }

  return {
    round: {
      ...round,
      status: "finished",
      server_seed: serverSeed,
      winner_telegram_id: winner.telegram_id,
      spin_degrees: spinDegrees,
      total_bank: total,
      house_fee: houseFee,
      pot_after_fee: potAfterFee,
    },
    winner,
    spinDegrees,
    mult,
    houseFee,
    potAfterFee,
    bets,
  };
}

/**
 * Tick: if countdown expired → spin. Call from clients or cron.
 */
export async function tickRoom(mode: RoomMode = DEFAULT_ROOM): Promise<{
  action: "none" | "spun" | "waiting";
  round: RoundRow | null;
  bets: RoundBet[];
  spin?: Awaited<ReturnType<typeof spinRound>>;
}> {
  const round = await getOpenRound(mode);
  if (!round) {
    return { action: "none", round: null, bets: [] };
  }

  const db = getAdminClient();
  const { data: betsData } = await db
    .from("round_bets")
    .select("telegram_id, username, amount, color")
    .eq("round_id", round.id);
  const bets = (betsData || []) as RoundBet[];

  if (
    round.status === "countdown" &&
    round.countdown_ends_at &&
    new Date(round.countdown_ends_at).getTime() <= Date.now()
  ) {
    try {
      const spin = await spinRound(round.id, mode);
      return { action: "spun", round: spin.round, bets: spin.bets, spin };
    } catch {
      // another authority won the race
      const fresh = await getOpenRound(mode);
      return { action: "waiting", round: fresh, bets };
    }
  }

  return { action: "waiting", round, bets };
}

export async function getRoundState(mode: RoomMode = DEFAULT_ROOM) {
  return tickRoom(mode);
}

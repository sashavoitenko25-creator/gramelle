/**
 * Showcase-only roulette bots (no real GRAM).
 * Appear as normal players in pools / avatar strips — not labeled in the app.
 *
 * telegram_id range: 9100000001 … 9100000010
 */
import crypto from "crypto";
import { getAdminClient } from "./supabase";
import {
  ROULETTE_COUNTDOWN_SEC,
  ROULETTE_MIN_BET,
  type RouletteColor,
} from "@/lib/rouletteConstants";

export const ROULETTE_BOT_ID_MIN = 9_100_000_001;
export const ROULETTE_BOT_ID_MAX = 9_100_000_010;

export function isRouletteShowcaseBot(telegramId: number): boolean {
  const id = Number(telegramId);
  return id >= ROULETTE_BOT_ID_MIN && id <= ROULETTE_BOT_ID_MAX;
}

/** Human-looking nicknames (no "bot" in the name) */
const BOT_NAMES = [
  "Alex",
  "Mira",
  "Denis",
  "Katya",
  "Ivan",
  "Sofia",
  "Max",
  "Lena",
  "Artem",
  "Nina",
  "Oleg",
  "Vera",
  "Kirill",
  "Anya",
  "Roma",
  "Dasha",
  "Timur",
  "Yulia",
  "Pavel",
  "Alina",
  "Nikita",
  "Polina",
  "Sergey",
  "Irina",
  "Vlad",
];

function hashBytes(seed: string): Buffer {
  return crypto.createHash("sha256").update(seed).digest();
}

function pickColor(b: number): RouletteColor {
  // ~46% red, ~46% black, ~8% green — close to wheel without being obvious
  const x = b % 100;
  if (x < 46) return "red";
  if (x < 92) return "black";
  return "green";
}

function pickAmount(b: number): number {
  // Mostly small stakes, occasional larger
  const table = [0.25, 0.25, 0.5, 0.5, 0.5, 1, 1, 1.5, 2, 3, 5];
  return table[b % table.length];
}

type RoundLite = {
  id: string;
  status: string;
  bet_ends_at: string;
};

/**
 * Insert 1–5 showcase bets during the betting window.
 * Deterministic per round; staggered so they don't all appear at once.
 * No ledger debit / credit.
 */
export async function ensureRouletteShowcaseBots(
  round: RoundLite
): Promise<void> {
  if (round.status !== "betting") return;

  const now = Date.now();
  const betEnds = new Date(round.bet_ends_at).getTime();
  if (!Number.isFinite(betEnds) || now >= betEnds - 400) return; // near lock

  const betStart = betEnds - ROULETTE_COUNTDOWN_SEC * 1000;
  const elapsed = Math.max(0, now - betStart);

  const h = hashBytes(`${round.id}:showcase-bots`);
  // 1..5 bots this round
  const count = 1 + (h[0] % 5);

  const db = getAdminClient();

  // Who already placed (bots only)
  const { data: existing } = await db
    .from("roulette_bets")
    .select("telegram_id")
    .eq("round_id", round.id)
    .gte("telegram_id", ROULETTE_BOT_ID_MIN)
    .lte("telegram_id", ROULETTE_BOT_ID_MAX);

  const already = new Set(
    (existing || []).map((r) => Number(r.telegram_id))
  );

  const rows: Array<{
    round_id: string;
    telegram_id: number;
    username: string;
    color: RouletteColor;
    amount: number;
    payout: null;
  }> = [];

  for (let i = 0; i < count; i++) {
    const botId = ROULETTE_BOT_ID_MIN + i;
    if (already.has(botId)) continue;

    // Join after 0.8–9s into the countdown (staggered)
    const joinMs = 800 + ((h[1 + i] || 0) % 8200);
    if (elapsed < joinMs) continue;

    const color = pickColor(h[8 + i] ?? 0);
    const amount = Math.max(ROULETTE_MIN_BET, pickAmount(h[16 + i] ?? 0));
    const name =
      BOT_NAMES[(h[24 + i] + i * 7) % BOT_NAMES.length] || "Player";

    rows.push({
      round_id: round.id,
      telegram_id: botId,
      username: name,
      color,
      amount,
      payout: null,
    });
  }

  if (rows.length === 0) return;

  const { error } = await db.from("roulette_bets").insert(rows);
  if (error) {
    // ignore unique/race — next poll will retry remaining
    console.warn("[roulette-bots] insert", error.message);
  }
}

/**
 * Showcase-only LIVE roulette bots (no real GRAM).
 * Five fixed people with stable names + avatars.
 * Each can go AFK for 1–3 hours, then return — always ≥1 online.
 */
import crypto from "crypto";
import { getAdminClient } from "./supabase";
import {
  ROULETTE_COUNTDOWN_SEC,
  ROULETTE_MIN_BET,
  type RouletteColor,
} from "@/lib/rouletteConstants";

export const ROULETTE_BOT_ID_MIN = 9_100_000_001;
export const ROULETTE_BOT_ID_MAX = 9_100_000_005;

export function isRouletteShowcaseBot(telegramId: number): boolean {
  const id = Number(telegramId);
  return id >= ROULETTE_BOT_ID_MIN && id <= ROULETTE_BOT_ID_MAX;
}

/** Fixed cast — TG-style names, stable avatars */
export const ROULETTE_BOTS = [
  {
    id: 9_100_000_001,
    username: "🔥 Alex",
    photoUrl:
      "https://i.pravatar.cc/150?u=gramelle-alex-01",
  },
  {
    id: 9_100_000_002,
    username: "katya.m",
    photoUrl:
      "https://i.pravatar.cc/150?u=gramelle-katya-02",
  },
  {
    id: 9_100_000_003,
    username: "Денчик",
    photoUrl:
      "https://i.pravatar.cc/150?u=gramelle-denchik-03",
  },
  {
    id: 9_100_000_004,
    username: "max_ton",
    photoUrl:
      "https://i.pravatar.cc/150?u=gramelle-max-04",
  },
  {
    id: 9_100_000_005,
    username: "• Sofia",
    photoUrl:
      "https://i.pravatar.cc/150?u=gramelle-sofia-05",
  },
] as const;

export function botPhotoUrl(telegramId: number): string | null {
  const b = ROULETTE_BOTS.find((x) => x.id === Number(telegramId));
  return b?.photoUrl ?? null;
}

function hashBytes(seed: string): Buffer {
  return crypto.createHash("sha256").update(seed).digest();
}

function pickAmount(b: number): number {
  const table = [
    0.25, 0.25, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1.5, 2, 2, 3, 5,
  ];
  return Math.max(ROULETTE_MIN_BET, table[b % table.length]);
}

function pickColor(b: number): RouletteColor {
  const x = b % 100;
  if (x < 47) return "red";
  if (x < 94) return "black";
  return "green";
}

/**
 * Presence schedule per bot, in ~4h cycles (wall-clock based).
 * Online for a stretch, then AFK 1h or 3h, then back.
 * Always force at least one bot online.
 */
export function getOnlineBotIndices(nowMs: number = Date.now()): number[] {
  const HOUR = 3_600_000;
  const online: number[] = [];

  for (let i = 0; i < ROULETTE_BOTS.length; i++) {
    const bot = ROULETTE_BOTS[i];
    // Independent phase per bot so they don't all leave together
    const h = hashBytes(`presence:${bot.id}`);
    const phaseMs = ((h[0] << 16) | (h[1] << 8) | h[2]) % (12 * HOUR);
    const t = (nowMs + phaseMs) % (12 * HOUR);

    // Pattern over 12h window (offset per bot):
    // 0–3h online, 3–4h AFK (1h), 4–7h online, 7–10h AFK (3h), 10–12h online
    const afk1h = t >= 3 * HOUR && t < 4 * HOUR;
    const afk3h = t >= 7 * HOUR && t < 10 * HOUR;
    if (!afk1h && !afk3h) online.push(i);
  }

  // Guarantee ≥1 bot online
  if (online.length === 0) {
    // Pick the one whose AFK ends soonest — deterministic: bot 0 rotated by hour
    const fallback = Math.floor(nowMs / HOUR) % ROULETTE_BOTS.length;
    online.push(fallback);
  }

  return online;
}

type RoundLite = {
  id: string;
  status: string;
  bet_ends_at: string;
};

/**
 * During betting: online bots may place one staggered bet.
 * Natural rhythm — often skip whole rounds; usually 0–2 bets, rarely more.
 */
export async function ensureRouletteShowcaseBots(
  round: RoundLite
): Promise<void> {
  if (round.status !== "betting") return;

  const now = Date.now();
  const betEnds = new Date(round.bet_ends_at).getTime();
  if (!Number.isFinite(betEnds) || now >= betEnds - 600) return;

  const betStart = betEnds - ROULETTE_COUNTDOWN_SEC * 1000;
  const elapsed = Math.max(0, now - betStart);
  const windowMs = Math.max(1000, betEnds - betStart - 800);

  const present = getOnlineBotIndices(now);
  if (present.length === 0) return;

  const h = hashBytes(`${round.id}:bots-v4`);

  // Round activity: often empty, sometimes 1–2, rarely 3+
  // 0: 40% | 1: 30% | 2: 20% | 3: 8% | 4–5: 2%
  const roll = h[0] % 100;
  let activeCount = 0;
  if (roll < 40) activeCount = 0;
  else if (roll < 70) activeCount = 1;
  else if (roll < 90) activeCount = 2;
  else if (roll < 98) activeCount = 3;
  else activeCount = Math.min(4, present.length);

  activeCount = Math.min(activeCount, present.length);
  if (activeCount <= 0) return;

  // Shuffle present order by hash, take activeCount
  const shuffled = [...present].sort(
    (a, b) => (h[1 + a] || 0) - (h[1 + b] || 0) || a - b
  );
  const activeIdx = shuffled.slice(0, activeCount).sort((a, b) => a - b);

  // Staggered join times — min 1.2s gap
  const rawTimes = activeIdx.map((idx, i) => {
    const base = 700 + i * 1400;
    const jitter = (h[10 + idx] || 0) % 900;
    return Math.min(windowMs - 200, base + jitter);
  });
  const joinMs: number[] = [];
  for (let i = 0; i < rawTimes.length; i++) {
    const minNext = i === 0 ? rawTimes[0] : joinMs[i - 1] + 1200;
    joinMs.push(Math.max(rawTimes[i], minNext));
  }

  const db = getAdminClient();

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

  for (let i = 0; i < activeIdx.length; i++) {
    const idx = activeIdx[i];
    const bot = ROULETTE_BOTS[idx];
    if (already.has(bot.id)) continue;
    if (elapsed < joinMs[i]) continue;

    rows.push({
      round_id: round.id,
      telegram_id: bot.id,
      username: bot.username,
      color: pickColor(h[20 + idx] ?? 0),
      amount: pickAmount(h[30 + idx] ?? 0),
      payout: null,
    });
  }

  if (rows.length === 0) return;

  for (const row of rows) {
    const { error } = await db.from("roulette_bets").insert(row);
    if (error) {
      console.warn("[roulette-bots] insert", row.username, error.message);
    }
  }
}

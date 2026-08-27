export const COLORS = [
  "#a78bfa",
  "#22d3ee",
  "#f5c542",
  "#f87171",
  "#34d399",
  "#f472b6",
  "#60a5fa",
  "#fb923c",
  "#c084fc",
  "#2dd4bf",
  "#e879f9",
  "#4ade80",
];

export const MIN_BET = 0.25;
export const START_BALANCE = 10;
export const SPIN_DURATION_MS = 4200;
export const SPIN_FINISH_DELAY_MS = 4500;
export const MAX_PLAYERS = 10;
export const BOT_USERNAME = "Gramelle_bot";

/** Seconds after 2+ players before server spin */
export const ROUND_COUNTDOWN_SEC = 8;

/**
 * Rates
 * - TON ↔ GRAM = 1:1 (same unit in-game)
 * - Stars: ~market value vs TON. 1 Star ≈ $0.02, 1 TON ≈ $5–7 → ~0.003–0.004 TON/star.
 *   We use 0.01 GRAM per Star as a clean playable rate (100 Stars = 1 GRAM).
 *   Override with NEXT_PUBLIC_GRAM_PER_STAR.
 */
export const GRAM_PER_STAR =
  Number(process.env.NEXT_PUBLIC_GRAM_PER_STAR) || 0.01;
export const GRAM_PER_TON =
  Number(process.env.NEXT_PUBLIC_GRAM_PER_TON) || 1;

/** Deposit limits */
export const MIN_DEPOSIT_STARS = 50;
export const MAX_DEPOSIT_STARS = 100_000;
export const MIN_DEPOSIT_TON = 0.1;
export const MAX_DEPOSIT_TON = 500;

/** Withdraw limits (TON only) */
export const MIN_WITHDRAW_TON = 1;
export const MAX_WITHDRAW_TON = 200;
export const WITHDRAW_FEE_PCT = 0;

/** Referral: % of referred user's deposit */
export const REFERRAL_DEPOSIT_PCT = 0.05; // 5%
/** One-time bonus when friend joins via link */
export const REFERRAL_JOIN_BONUS = 0.25;

/** Star packages — gram derived from GRAM_PER_STAR (+ small bonus on large packs) */
export const STAR_PACKAGES = [
  { stars: 50, gram: 0.5, label: "50" },
  { stars: 100, gram: 1, label: "100", popular: true },
  { stars: 250, gram: 2.75, label: "250", bonus: "+0.25" },
  { stars: 500, gram: 6, label: "500", bonus: "+1" },
] as const;

/** TON packages — 1 TON = 1 GRAM (+ bonuses) */
export const TON_PACKAGES = [
  { ton: 1, gram: 1, label: "1" },
  { ton: 5, gram: 5, label: "5", popular: true },
  { ton: 10, gram: 10.5, label: "10", bonus: "+0.5" },
  { ton: 25, gram: 27, label: "25", bonus: "+2" },
] as const;

export const TON_DEPOSIT_ADDRESS =
  process.env.NEXT_PUBLIC_TON_WALLET ||
  "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ";

export type RoomMode = "classic" | "high";

export interface RoomConfig {
  id: RoomMode;
  name: string;
  description: string;
  minBet: number;
  maxBet: number;
  houseEdge: number;
  maxPlayers: number;
  countdownSec: number;
}

export const ROOMS: Record<RoomMode, RoomConfig> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Standard stakes",
    minBet: 0.25,
    maxBet: 500,
    houseEdge: 0.02,
    maxPlayers: 10,
    countdownSec: 8,
  },
  high: {
    id: "high",
    name: "High",
    description: "Higher stakes",
    minBet: 10,
    maxBet: 5000,
    houseEdge: 0.02,
    maxPlayers: 8,
    countdownSec: 10,
  },
};

export const DEFAULT_ROOM: RoomMode = "classic";

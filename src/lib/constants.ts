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

export const MIN_BET = 0.1;
export const START_BALANCE = 25;
export const SPIN_DURATION_MS = 4200;
export const SPIN_FINISH_DELAY_MS = 4500;
export const MAX_PLAYERS = 10;
export const BOT_USERNAME = "Gramelle_bot";

/** Seconds after 2+ players before server spin */
export const ROUND_COUNTDOWN_SEC = 8;

/**
 * Rates — GRAM is 1:1 with TON (same coin unit in-game).
 * Stars stay configurable via env.
 */
export const GRAM_PER_STAR = Number(process.env.NEXT_PUBLIC_GRAM_PER_STAR) || 1;
export const GRAM_PER_TON = Number(process.env.NEXT_PUBLIC_GRAM_PER_TON) || 1;

/** Deposit limits */
export const MIN_DEPOSIT_STARS = 10;
export const MAX_DEPOSIT_STARS = 100_000;
export const MIN_DEPOSIT_TON = 0.1;
export const MAX_DEPOSIT_TON = 500;

/** Withdraw limits (TON only — Stars cannot be paid out by bots) */
export const MIN_WITHDRAW_TON = 1;
export const MAX_WITHDRAW_TON = 200;
export const WITHDRAW_FEE_PCT = 0;

/** Referral: % of referred user's deposit credited to referrer */
export const REFERRAL_DEPOSIT_PCT = 0.05; // 5%
/** One-time bonus when friend joins via link */
export const REFERRAL_JOIN_BONUS = 1;

export const STAR_PACKAGES = [
  { stars: 50, gram: 50, label: "50" },
  { stars: 100, gram: 100, label: "100", popular: true },
  { stars: 250, gram: 260, label: "250", bonus: "+10" },
  { stars: 500, gram: 550, label: "500", bonus: "+50" },
] as const;

/** TON packages — 1 TON = 1 GRAM (plus small bonuses on larger packs) */
export const TON_PACKAGES = [
  { ton: 1, gram: 1, label: "1" },
  { ton: 5, gram: 5, label: "5", popular: true },
  { ton: 10, gram: 10.5, label: "10", bonus: "+0.5" },
  { ton: 25, gram: 27, label: "25", bonus: "+2" },
] as const;

export const TON_DEPOSIT_ADDRESS =
  process.env.NEXT_PUBLIC_TON_WALLET ||
  "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ";

/** Phase 2 — room modes */
export type RoomMode = "classic" | "high";

export interface RoomConfig {
  id: RoomMode;
  name: string;
  description: string;
  minBet: number;
  maxBet: number;
  /** House edge 0..1 (e.g. 0.02 = 2%) taken from bank before payout */
  houseEdge: number;
  maxPlayers: number;
  countdownSec: number;
}

export const ROOMS: Record<RoomMode, RoomConfig> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Standard stakes",
    minBet: 0.1,
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

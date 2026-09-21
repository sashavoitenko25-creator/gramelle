/** LIVE Roulette — synchronized global rounds (Gramelle) */

export const ROULETTE_COUNTDOWN_SEC = 15;
export const ROULETTE_SPIN_MS = 5200;
/** Hold result long enough that next spin never overlaps previous animation. */
export const ROULETTE_RESULT_MS = 8500;
export const ROULETTE_MIN_BET = 0.25;
export const ROULETTE_MAX_BET = 500;
export const ROULETTE_MAX_STAKE_PER_ROUND = 1000;
/** Lock bets this many ms before bet_ends_at */
export const ROULETTE_BET_LOCK_MS = 400;

export type RouletteColor = "red" | "black" | "green";

export const ROULETTE_MULT: Record<RouletteColor, number> = {
  red: 2,
  black: 2,
  green: 14,
};

/**
 * 15 slots — 7 red, 7 black, 1 green.
 * P(red)=7/15, payout 2x → RTP ≈ 93.3%.
 */
export const ROULETTE_WHEEL: RouletteColor[] = [
  "red",
  "black",
  "red",
  "black",
  "red",
  "black",
  "red",
  "green",
  "black",
  "red",
  "black",
  "red",
  "black",
  "red",
  "black",
];

export const ROULETTE_SLOT_COUNT = ROULETTE_WHEEL.length;

export function rouletteColorAt(slot: number): RouletteColor {
  const n = ROULETTE_SLOT_COUNT;
  const i = ((slot % n) + n) % n;
  return ROULETTE_WHEEL[i];
}

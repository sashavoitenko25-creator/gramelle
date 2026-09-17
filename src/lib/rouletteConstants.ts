/** LIVE Roulette — global synchronized rounds */

export const ROULETTE_COUNTDOWN_SEC = 15;
export const ROULETTE_SPIN_MS = 4200;
export const ROULETTE_RESULT_MS = 2800;
export const ROULETTE_MIN_BET = 0.25;
export const ROULETTE_MAX_BET = 500;
/** Max total stake per player per round (all colors) */
export const ROULETTE_MAX_STAKE_PER_ROUND = 1000;

export type RouletteColor = "red" | "black" | "green";

export const ROULETTE_MULT: Record<RouletteColor, number> = {
  red: 2,
  black: 2,
  green: 14,
};

/**
 * 15 slots: 7 red, 7 black, 1 green.
 * EV red ≈ 7/15 * 2 ≈ 0.933 → ~6.7% house (close to 5% feel).
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

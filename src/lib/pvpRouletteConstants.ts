import { MIN_BET, HOUSE_EDGE } from "@/lib/constants";

/** LIVE PvP Avatar Roulette — players' avatars form the wheel */

export const PVP_ROULETTE_MIN_BET = MIN_BET;
export const PVP_ROULETTE_MAX_BET = 500;
export const PVP_ROULETTE_MIN_PLAYERS = 2;
export const PVP_ROULETTE_MAX_PLAYERS = 16;
/** House fee from total bank */
export const PVP_ROULETTE_HOUSE_EDGE = HOUSE_EDGE; // 0.05
/** Seconds after 2nd player joins until bets close */
export const PVP_ROULETTE_COUNTDOWN_SEC = 18;
/** Spin animation duration (ms) — 5s shorter */
export const PVP_ROULETTE_SPIN_MS = 20000;
/** Hold finished on server before next waiting round (match client result 5s) */
export const PVP_ROULETTE_RESULT_MS = 5500;
/** Reject bets this many ms before bet_ends_at */
export const PVP_ROULETTE_BET_LOCK_MS = 500;
/** Brief pause after lock before spin starts (ms) */
export const PVP_ROULETTE_PREP_MS = 1200;

export type PvpRouletteStatus =
  | "waiting"
  | "betting"
  | "spinning"
  | "finished"
  | "cancelled";

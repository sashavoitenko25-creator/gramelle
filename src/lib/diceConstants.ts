import { MIN_BET } from "@/lib/constants";

export const DICE_MIN_BET = MIN_BET;
export const DICE_MAX_BET = 1_000_000;
export const DICE_MIN_PLAYERS = 2;
export const DICE_MAX_PLAYERS = 6;
/** House fee from total pot (same spirit as RPS) */
export const DICE_HOUSE_EDGE = 0.05;
/** Turn timeout — AFK auto-roll via cron */
export const DICE_TURN_SEC = 60;
/** Hint for UI countdown (same as turn) */
export const DICE_TURN_HINT_SEC = DICE_TURN_SEC;
/** Cancel open tables with no start after this many minutes */
export const DICE_OPEN_STALE_MIN = 30;

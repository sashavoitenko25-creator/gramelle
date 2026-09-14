import { MIN_BET } from "@/lib/constants";

export const DICE_MIN_BET = MIN_BET;
export const DICE_MAX_BET = 1_000_000;
export const DICE_MIN_PLAYERS = 2;
export const DICE_MAX_PLAYERS = 6;
/** House fee from total pot (same spirit as RPS) */
export const DICE_HOUSE_EDGE = 0.05;
/** Turn timeout seconds — auto-skip not implemented; client polls */
export const DICE_TURN_HINT_SEC = 60;

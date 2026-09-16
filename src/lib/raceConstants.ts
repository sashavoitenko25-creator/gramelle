/** Race (Live) — GRAM stakes */
export const RACE_MIN_BALL = 0.25;
export const RACE_MAX_BALLS_PER_PLAYER = 20;
export const RACE_MAX_BALLS_TOTAL = 60;
export const RACE_HOUSE_EDGE = 0.05;
export const RACE_COUNTDOWN_SEC = 60;
export const RACE_BUY_LOCK_SEC = 5;
export const RACE_MIN_PLAYERS = 2;
export const RACE_OPEN_STALE_MIN = 30;
export const RACE_ANIM_MS = 14000;

/** Obstacle map templates (client renders; server picks by seed) */
export const RACE_MAPS = [
  {
    id: "gates",
    name: { en: "Neon Gates", ru: "Неоновые врата" },
    pegs: "staggered",
  },
  {
    id: "zigzag",
    name: { en: "Zigzag Canyon", ru: "Зигзаг-каньон" },
    pegs: "zigzag",
  },
  {
    id: "funnel",
    name: { en: "Gravity Funnel", ru: "Гравиворонка" },
    pegs: "funnel",
  },
  {
    id: "pins",
    name: { en: "Pin Storm", ru: "Шторм пинов" },
    pegs: "dense",
  },
  {
    id: "lanes",
    name: { en: "Split Lanes", ru: "Раздельные полосы" },
    pegs: "lanes",
  },
] as const;

export type RaceMapId = (typeof RACE_MAPS)[number]["id"];

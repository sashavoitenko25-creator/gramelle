/** Race Live — Balls-style shared pot race (circle start + track) */
export const RACE_MIN_BALL = 0.25;
export const RACE_MAX_BALLS_PER_PLAYER = 20;
export const RACE_MAX_BALLS_TOTAL = 60;
export const RACE_HOUSE_EDGE = 0.05;
export const RACE_COUNTDOWN_SEC = 60;
export const RACE_BUY_LOCK_SEC = 5;
export const RACE_MIN_PLAYERS = 2;
export const RACE_OPEN_STALE_MIN = 30;
export const RACE_ANIM_MS = 18000;

/**
 * Map = chain of segments (inspired by @myballs).
 * Server picks map by seed; client renders track.
 * Start is always inside a physics circle that opens at the bottom.
 */
export type RaceSegmentKind =
  | "funnel"
  | "pegs"
  | "bumpers"
  | "lanes"
  | "zigzag"
  | "tunnel"
  | "ramps"
  | "sieve"
  | "cross"
  | "dots"
  | "arcs"
  | "bomb"
  | "antigrav"
  | "platforms";

export type RaceMapDef = {
  id: string;
  name: { en: string; ru: string };
  /** accent color for track glow */
  accent: string;
  segments: RaceSegmentKind[];
};

export const RACE_MAPS: RaceMapDef[] = [
  {
    id: "neon_run",
    name: { en: "Neon Run", ru: "Неоновый спуск" },
    accent: "#22d3ee",
    segments: ["platforms", "cross", "dots", "arcs", "funnel"],
  },
  {
    id: "canyon",
    name: { en: "Zigzag Canyon", ru: "Зигзаг-каньон" },
    accent: "#a78bfa",
    segments: ["zigzag", "lanes", "pegs", "funnel"],
  },
  {
    id: "pinball",
    name: { en: "Pin Storm", ru: "Шторм пинов" },
    accent: "#f472b6",
    segments: ["pegs", "bumpers", "cross", "sieve"],
  },
  {
    id: "pipes",
    name: { en: "Pipe Maze", ru: "Лабиринт труб" },
    accent: "#34d399",
    segments: ["tunnel", "ramps", "arcs", "funnel"],
  },
  {
    id: "highway",
    name: { en: "Split Highway", ru: "Раздельная трасса" },
    accent: "#fbbf24",
    segments: ["lanes", "platforms", "zigzag", "sieve"],
  },
  {
    id: "vortex",
    name: { en: "Gravity Vortex", ru: "Гравиворонка" },
    accent: "#60a5fa",
    segments: ["funnel", "antigrav", "arcs", "bomb", "funnel"],
  },
  {
    id: "phase",
    name: { en: "Phase Drop", ru: "Phase Drop" },
    accent: "#38bdf8",
    segments: ["platforms", "cross", "dots", "bomb", "arcs", "funnel"],
  },
];

export type RaceMapId = (typeof RACE_MAPS)[number]["id"];

/** Race Live — Balls-style shared pot race */
export const RACE_MIN_BALL = 0.25;
export const RACE_MAX_BALLS_PER_PLAYER = 20;
export const RACE_MAX_BALLS_TOTAL = 60;
export const RACE_HOUSE_EDGE = 0.05;
export const RACE_COUNTDOWN_SEC = 60;
export const RACE_BUY_LOCK_SEC = 5;
export const RACE_MIN_PLAYERS = 2;
export const RACE_OPEN_STALE_MIN = 30;
export const RACE_ANIM_MS = 16000;

/**
 * Map = chain of segments (like Balls TG).
 * Server picks map by seed; client renders track.
 */
export type RaceSegmentKind =
  | "funnel"
  | "pegs"
  | "bumpers"
  | "lanes"
  | "zigzag"
  | "tunnel"
  | "ramps"
  | "sieve";

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
    segments: ["funnel", "pegs", "bumpers", "sieve"],
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
    segments: ["pegs", "pegs", "bumpers", "sieve"],
  },
  {
    id: "pipes",
    name: { en: "Pipe Maze", ru: "Лабиринт труб" },
    accent: "#34d399",
    segments: ["tunnel", "ramps", "lanes", "funnel"],
  },
  {
    id: "highway",
    name: { en: "Split Highway", ru: "Раздельная трасса" },
    accent: "#fbbf24",
    segments: ["lanes", "ramps", "zigzag", "sieve"],
  },
  {
    id: "vortex",
    name: { en: "Gravity Vortex", ru: "Гравиворонка" },
    accent: "#60a5fa",
    segments: ["funnel", "tunnel", "pegs", "bumpers"],
  },
];

export type RaceMapId = (typeof RACE_MAPS)[number]["id"];

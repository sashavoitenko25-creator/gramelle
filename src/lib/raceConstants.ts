/** Race Live — free-fall balls, soft obstacles, circle start */
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
 * Segments = sparse soft obstacles (slow, don't stop).
 * Heavy walls/mazes intentionally avoided.
 */
export type RaceSegmentKind =
  | "pegs"
  | "bumpers"
  | "dots"
  | "cross"
  | "arcs"
  | "bomb"
  | "antigrav"
  | "scatter"
  | "funnel";

export type RaceMapDef = {
  id: string;
  name: { en: string; ru: string };
  accent: string;
  segments: RaceSegmentKind[];
};

export const RACE_MAPS: RaceMapDef[] = [
  {
    id: "neon_run",
    name: { en: "Neon Run", ru: "Неоновый спуск" },
    accent: "#22d3ee",
    segments: ["scatter", "pegs", "dots", "bumpers", "funnel"],
  },
  {
    id: "pinball",
    name: { en: "Pin Storm", ru: "Шторм пинов" },
    accent: "#38bdf8",
    segments: ["pegs", "pegs", "cross", "dots", "funnel"],
  },
  {
    id: "vortex",
    name: { en: "Gravity Vortex", ru: "Гравиворонка" },
    accent: "#a78bfa",
    segments: ["scatter", "antigrav", "arcs", "bumpers", "funnel"],
  },
  {
    id: "phase",
    name: { en: "Phase Drop", ru: "Phase Drop" },
    accent: "#60a5fa",
    segments: ["dots", "cross", "bomb", "pegs", "funnel"],
  },
  {
    id: "highway",
    name: { en: "Open Drop", ru: "Открытый спуск" },
    accent: "#34d399",
    segments: ["scatter", "dots", "pegs", "arcs", "funnel"],
  },
  {
    id: "chaos",
    name: { en: "Soft Chaos", ru: "Мягкий хаос" },
    accent: "#f472b6",
    segments: ["bumpers", "scatter", "cross", "dots", "funnel"],
  },
];

export type RaceMapId = (typeof RACE_MAPS)[number]["id"];

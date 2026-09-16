/** Race Live — open free-fall maps, soft obstacles */
export const RACE_MIN_BALL = 0.25;
export const RACE_MAX_BALLS_PER_PLAYER = 20;
export const RACE_MAX_BALLS_TOTAL = 60;
export const RACE_HOUSE_EDGE = 0.05;
export const RACE_COUNTDOWN_SEC = 60;
export const RACE_BUY_LOCK_SEC = 5;
export const RACE_MIN_PLAYERS = 2;
export const RACE_OPEN_STALE_MIN = 30;
export const RACE_ANIM_MS = 22000;

/**
 * Segment kinds (server + client share ids).
 * Layouts are open free-fall, not maze corridors.
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
  accent: string;
  segments: RaceSegmentKind[];
};

export const RACE_MAPS: RaceMapDef[] = [
  {
    id: "neon_run",
    name: { en: "Neon Run", ru: "Неоновый спуск" },
    accent: "#4FC3F7",
    segments: ["lanes", "pegs", "bumpers", "tunnel", "funnel"],
  },
  {
    id: "canyon",
    name: { en: "Zigzag Canyon", ru: "Зигзаг-каньон" },
    accent: "#29B6F6",
    segments: ["lanes", "zigzag", "pegs", "bumpers", "funnel"],
  },
  {
    id: "pinball",
    name: { en: "Pin Storm", ru: "Шторм пинов" },
    accent: "#4FC3F7",
    segments: ["pegs", "sieve", "bumpers", "ramps", "funnel"],
  },
  {
    id: "pipes",
    name: { en: "Pipe Maze", ru: "Трубы" },
    accent: "#60a5fa",
    segments: ["lanes", "tunnel", "pegs", "bumpers", "funnel"],
  },
  {
    id: "highway",
    name: { en: "Split Highway", ru: "Раздельная трасса" },
    accent: "#29B6F6",
    segments: ["lanes", "pegs", "zigzag", "sieve", "funnel"],
  },
  {
    id: "vortex",
    name: { en: "Gravity Vortex", ru: "Гравиворонка" },
    accent: "#a78bfa",
    segments: ["lanes", "bumpers", "tunnel", "pegs", "funnel"],
  },
];

export type RaceMapId = (typeof RACE_MAPS)[number]["id"];

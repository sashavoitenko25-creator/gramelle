/** Race Live — MyBalls-style free-fall, long course */
export const RACE_MIN_BALL = 0.25;
export const RACE_MAX_BALLS_PER_PLAYER = 20;
export const RACE_MAX_BALLS_TOTAL = 60;
export const RACE_HOUSE_EDGE = 0.05;
export const RACE_COUNTDOWN_SEC = 60;
export const RACE_BUY_LOCK_SEC = 5;
export const RACE_MIN_PLAYERS = 2;
export const RACE_OPEN_STALE_MIN = 30;
export const RACE_ANIM_MS = 22000;

export type RaceSegmentKind =
  | "platforms"
  | "crosses"
  | "dots"
  | "arcs"
  | "bomb"
  | "antigrav"
  | "funnel";

export type RaceMapDef = {
  id: string;
  name: { en: string; ru: string };
  accent: string;
  segments: RaceSegmentKind[];
};

/** Longer courses ≈ MyBalls replay length */
export const RACE_MAPS: RaceMapDef[] = [
  {
    id: "classic",
    name: { en: "Classic Drop", ru: "Классический спуск" },
    accent: "#38bdf8",
    segments: [
      "platforms",
      "crosses",
      "dots",
      "arcs",
      "bomb",
      "platforms",
      "funnel",
    ],
  },
  {
    id: "chaos",
    name: { en: "Chaos Run", ru: "Хаос" },
    accent: "#60a5fa",
    segments: [
      "platforms",
      "dots",
      "crosses",
      "arcs",
      "bomb",
      "crosses",
      "funnel",
    ],
  },
  {
    id: "gravity",
    name: { en: "Anti Gravity", ru: "Антигравитация" },
    accent: "#a78bfa",
    segments: [
      "platforms",
      "crosses",
      "arcs",
      "antigrav",
      "dots",
      "platforms",
      "funnel",
    ],
  },
  {
    id: "phase",
    name: { en: "Phase Drop", ru: "Phase Drop" },
    accent: "#22d3ee",
    segments: [
      "dots",
      "platforms",
      "crosses",
      "dots",
      "arcs",
      "bomb",
      "funnel",
    ],
  },
  {
    id: "storm",
    name: { en: "Pin Storm", ru: "Шторм" },
    accent: "#34d399",
    segments: [
      "platforms",
      "dots",
      "dots",
      "crosses",
      "arcs",
      "platforms",
      "funnel",
    ],
  },
  {
    id: "vortex",
    name: { en: "Vortex", ru: "Воронка" },
    accent: "#f472b6",
    segments: [
      "arcs",
      "platforms",
      "crosses",
      "antigrav",
      "arcs",
      "bomb",
      "funnel",
    ],
  },
];

export type RaceMapId = (typeof RACE_MAPS)[number]["id"];

/** Race Live — MyBalls-faithful free-fall course */
export const RACE_MIN_BALL = 0.25;
export const RACE_MAX_BALLS_PER_PLAYER = 20;
export const RACE_MAX_BALLS_TOTAL = 60;
export const RACE_HOUSE_EDGE = 0.05;
export const RACE_COUNTDOWN_SEC = 60;
export const RACE_BUY_LOCK_SEC = 5;
export const RACE_MIN_PLAYERS = 2;
export const RACE_OPEN_STALE_MIN = 30;
/** Client fall animation length (ms) */
export const RACE_ANIM_MS = 28000;

export type RaceSegmentKind =
  | "start"
  | "platforms"
  | "crosses"
  | "dots"
  | "arcs"
  | "bombs"
  | "antigrav"
  | "funnel";

export type RaceMapDef = {
  id: string;
  name: { en: string; ru: string };
  accent: string;
  segments: RaceSegmentKind[];
};

/** Fixed section order matching reference replay */
export const RACE_MAPS: RaceMapDef[] = [
  {
    id: "classic",
    name: { en: "Classic Drop", ru: "Классический спуск" },
    accent: "#4FC3F7",
    segments: [
      "start",
      "platforms",
      "crosses",
      "dots",
      "arcs",
      "bombs",
      "antigrav",
      "funnel",
    ],
  },
  {
    id: "chaos",
    name: { en: "Chaos Run", ru: "Хаос" },
    accent: "#29B6F6",
    segments: [
      "start",
      "platforms",
      "dots",
      "crosses",
      "arcs",
      "bombs",
      "antigrav",
      "funnel",
    ],
  },
  {
    id: "storm",
    name: { en: "Pin Storm", ru: "Шторм" },
    accent: "#4FC3F7",
    segments: [
      "start",
      "platforms",
      "crosses",
      "dots",
      "dots",
      "arcs",
      "bombs",
      "funnel",
    ],
  },
  {
    id: "phase",
    name: { en: "Phase Drop", ru: "Phase Drop" },
    accent: "#29B6F6",
    segments: [
      "start",
      "platforms",
      "crosses",
      "arcs",
      "bombs",
      "antigrav",
      "dots",
      "funnel",
    ],
  },
  {
    id: "vortex",
    name: { en: "Vortex", ru: "Воронка" },
    accent: "#4FC3F7",
    segments: [
      "start",
      "platforms",
      "crosses",
      "dots",
      "arcs",
      "antigrav",
      "bombs",
      "funnel",
    ],
  },
  {
    id: "gravity",
    name: { en: "Anti Gravity", ru: "Антигравитация" },
    accent: "#7C4DFF",
    segments: [
      "start",
      "platforms",
      "crosses",
      "dots",
      "arcs",
      "antigrav",
      "bombs",
      "funnel",
    ],
  },
];

export type RaceMapId = (typeof RACE_MAPS)[number]["id"];

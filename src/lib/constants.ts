export const COLORS = [
  "#a78bfa",
  "#22d3ee",
  "#f5c542",
  "#f87171",
  "#34d399",
  "#f472b6",
  "#60a5fa",
  "#fb923c",
  "#c084fc",
  "#2dd4bf",
  "#e879f9",
  "#4ade80",
];

/** Set NEXT_PUBLIC_MAINTENANCE=1 on Vercel to show maintenance screen for all users */
export const MAINTENANCE_MODE =
  process.env.NEXT_PUBLIC_MAINTENANCE === "1" ||
  process.env.NEXT_PUBLIC_MAINTENANCE === "true";

/** Telegram IDs that can use the app during maintenance (testers / owners) */
export const MAINTENANCE_ALLOW_IDS: number[] = [
  6859689857,
  943731047,
];

export function isMaintenanceBypass(telegramId: number | null | undefined): boolean {
  if (telegramId == null) return false;
  return MAINTENANCE_ALLOW_IDS.includes(Number(telegramId));
}

export const START_BALANCE = 0;
export const MIN_BET = 0.25;
export const HOUSE_EDGE = 0.05;

/** Kept for webhook compile; Stars deposits disabled (no stars-invoice route) */
export const GRAM_PER_STAR = (() => {
  const env = Number(process.env.NEXT_PUBLIC_GRAM_PER_STAR);
  if (Number.isFinite(env) && env > 0 && env < 0.1) return env;
  return 4.25 / 500;
})();

export const BOT_USERNAME =
  process.env.NEXT_PUBLIC_BOT_USERNAME || "Gramelle_bot";

/**
 * Economy
 * - 1 TON = 1 GRAM
 * - Internal fee applied server-side where applicable
 */
export const GRAM_PER_TON = (() => {
  const env = Number(process.env.NEXT_PUBLIC_GRAM_PER_TON);
  if (Number.isFinite(env) && env > 0) return env;
  return 1;
})();

export const MIN_DEPOSIT_GRAM = 0.5;
export const MIN_DEPOSIT_TON = 0.5;
/** No practical deposit cap */
export const MAX_DEPOSIT_TON = 1_000_000;
export const TON_PENDING_TTL_SEC = 10 * 60;

export const MIN_WITHDRAW_TON = 2;
/** No practical per-request withdraw cap */
export const MAX_WITHDRAW_TON = 1_000_000;
export const WITHDRAW_FEE_GRAM = 0;

/** Support / community (Telegram) */
export const SUPPORT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_URL || "https://t.me/GramellePlay";
export const SUPPORT_LABEL =
  process.env.NEXT_PUBLIC_SUPPORT_LABEL || "@GramellePlay";
/** @deprecated join bonus disabled — only % of house fee */
export const REFERRAL_JOIN_BONUS = 0;
export const REFERRAL_MIN_WITHDRAW = 0.25;

/**
 * Referral = fixed share of house fee from games that charge commission.
 * Like @rollsgame_bot: up to 10% of the platform commission of the referral.
 * LIVE / SOLO do not participate (no referral from those modes).
 */
export const REFERRAL_SHARE_OF_HOUSE_FEE = 0.1; // 10%

export type ReferralTierId = "none" | "standard";

export interface ReferralTier {
  id: ReferralTierId;
  name: string;
  minActive: number;
  maxActive: number | null;
  minTurnover: number;
  /** Share of house fee credited to referrer savings (ref_earned) */
  shareOfHouseFee: number;
  color: string;
  emoji: string;
}

/** Single tier — 10% of house fee (RPS / DICE / XO / Race). No special/individual. */
export const REFERRAL_TIERS: ReferralTier[] = [
  {
    id: "standard",
    name: "Standard",
    minActive: 1,
    maxActive: null,
    minTurnover: 0,
    shareOfHouseFee: REFERRAL_SHARE_OF_HOUSE_FEE,
    color: "#22d3ee",
    emoji: "🔗",
  },
];

export function getReferralTier(
  activeRefs: number,
  _turnover?: number,
  _telegramId?: number | null
): ReferralTier | null {
  if (activeRefs < 1) return null;
  return REFERRAL_TIERS[0];
}

export type TonPackage = { ton: number; gram: number; label: string; popular?: boolean; bonus?: string };
export const TON_PACKAGES: TonPackage[] = [
  { ton: 0.5, gram: 0.5, label: "0.5" },
  { ton: 1, gram: 1, label: "1" },
  { ton: 5, gram: 5, label: "5", popular: true },
  { ton: 10, gram: 10, label: "10" },
  { ton: 25, gram: 25, label: "25" },
  { ton: 50, gram: 50, label: "50" },
];
export const TON_DEPOSIT_ADDRESS =
  process.env.NEXT_PUBLIC_TON_WALLET ||
  "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ";
export const TON_RESERVE_WALLET =
  process.env.NEXT_PUBLIC_TON_RESERVE_WALLET || TON_DEPOSIT_ADDRESS;
export const TON_PROFIT_WALLET =
  process.env.NEXT_PUBLIC_TON_PROFIT_WALLET || TON_DEPOSIT_ADDRESS;

export const MAX_PENDING_WITHDRAWALS = 3;
/** No practical daily withdraw cap */
export const DAILY_WITHDRAW_LIMIT_TON = 1_000_000;

/** One-time channel subscribe tasks (bot must be admin in these channels) */
export type TaskId = "channel_project" | "channel_friend";

export interface TaskDef {
  id: TaskId;
  title: string;
  description: string;
  /** @username OR numeric chat id (private: -100... / -18...) */
  channel: string;
  /** Open button link (public t.me/name or private invite t.me/+) */
  inviteLink: string;
  rewardGram: number;
}

export const TASKS: TaskDef[] = [
  {
    id: "channel_project",
    title: "Подписаться на канал проекта",
    description: "Вступите в официальный канал Gramelle",
    channel: process.env.NEXT_PUBLIC_TASK_CHANNEL_PROJECT || "GramellePlay",
    inviteLink:
      process.env.NEXT_PUBLIC_TASK_CHANNEL_PROJECT_LINK ||
      "https://t.me/GramellePlay",
    rewardGram: 0.1,
  },
  {
    id: "channel_friend",
    title: "Подписаться на партнёрский канал",
    description: "Вступите в партнёрский канал",
    channel: process.env.NEXT_PUBLIC_TASK_CHANNEL_FRIEND || "-1001858402844",
    inviteLink:
      process.env.NEXT_PUBLIC_TASK_CHANNEL_FRIEND_LINK ||
      "https://t.me/+GHAd4K5SauZhMTcy",
    rewardGram: 0.1,
  },
];

export function taskChannelLink(task: TaskDef): string {
  if (task.inviteLink) return task.inviteLink;
  const ch = task.channel.replace(/^@/, "");
  if (/^-?\d+$/.test(ch)) return task.inviteLink || "";
  return `https://t.me/${ch}`;
}

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

export const MIN_WITHDRAW_TON = 5;
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

export type ReferralTierId =
  | "none"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "individual";

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
  /** Optional: only these Telegram IDs see / use this tier */
  restrictedToTelegramIds?: readonly number[];
}

/** Owner + partner — only they see Individual tier */
export const INDIVIDUAL_REF_TELEGRAM_IDS = [6859689857, 8960001633] as const;

export function isIndividualRefViewer(telegramId: number | null | undefined): boolean {
  if (telegramId == null) return false;
  return (INDIVIDUAL_REF_TELEGRAM_IDS as readonly number[]).includes(Number(telegramId));
}

/** Special partner tier: 4% of house fee → referrer, rest of fee stays with the app */
export const INDIVIDUAL_TIER: ReferralTier = {
  id: "individual",
  name: "Individual",
  minActive: 1,
  maxActive: null,
  minTurnover: 0,
  shareOfHouseFee: 0.04,
  color: "#f0abfc",
  emoji: "✦",
  restrictedToTelegramIds: INDIVIDUAL_REF_TELEGRAM_IDS,
};

export const REFERRAL_TIERS: ReferralTier[] = [
  { id: "bronze", name: "Bronze", minActive: 0, maxActive: 4, minTurnover: 0, shareOfHouseFee: 0.1, color: "#cd7f32", emoji: "🥉" },
  { id: "silver", name: "Silver", minActive: 5, maxActive: 14, minTurnover: 300, shareOfHouseFee: 0.15, color: "#c0c0c0", emoji: "🥈" },
  { id: "gold", name: "Gold", minActive: 15, maxActive: 44, minTurnover: 1500, shareOfHouseFee: 0.2, color: "#f5c542", emoji: "🥇" },
  { id: "platinum", name: "Platinum", minActive: 45, maxActive: null, minTurnover: 4000, shareOfHouseFee: 0.3, color: "#a78bfa", emoji: "💎" },
];

export function getReferralTier(
  activeRefs: number,
  turnover: number,
  telegramId?: number | null
): ReferralTier | null {
  if (activeRefs < 1) return null;

  // Individual: fixed 4% of house fee for allow-listed partners (from 1 invite)
  if (
    telegramId != null &&
    isIndividualRefViewer(telegramId) &&
    activeRefs >= INDIVIDUAL_TIER.minActive
  ) {
    return INDIVIDUAL_TIER;
  }

  for (const t of [...REFERRAL_TIERS].reverse()) {
    if (activeRefs >= t.minActive && turnover >= t.minTurnover) return t;
  }
  return null;
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

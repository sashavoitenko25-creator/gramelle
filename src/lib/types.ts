export interface Player {
  id: number | string;
  name: string;
  amount: number;
  color: string;
  chance?: number;
  isMe: boolean;
}

export interface HistoryItem {
  id: number;
  winner: string;
  chance: number;
  win: number;
  mult: number;
  bet: number;
  time: Date;
  type: string;
  isMe: boolean;
}

export interface Profile {
  id: string;
  username: string;
  balance: number;
  referral_code: string;
  ref_earned: number;
  ref_count: number;
  telegram_id?: number | null;
}

export type Screen = "pvp" | "history" | "profile" | "referrals";

export type HistoryFilter = "all" | "wins" | "my";

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
  photo_url?: string | null;
  biggest_win?: number;
  wins?: number;
  games?: number;
  ref_active?: number;
  ref_turnover?: number;
  wager_remaining?: number;
}

export type Screen =
  | "games"
  | "rps"
  | "history"
  | "profile"
  | "referrals"
  | "transactions"
  | "tasks";

export type HistoryFilter = "all" | "lucky" | "top" | "wins" | "my";
export type DepositMethod = "ton";

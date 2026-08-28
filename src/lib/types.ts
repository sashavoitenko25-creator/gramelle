import type { RoomMode } from "./constants";

export interface Player {
  id: number | string;
  name: string;
  amount: number;
  color: string;
  chance?: number;
  isMe: boolean;
  telegramId?: number | null;
  photoUrl?: string | null;
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
  photo_url?: string | null;
  biggest_win?: number;
  wins?: number;
  games?: number;
}

export type Screen = "pvp" | "history" | "profile" | "referrals" | "transactions";
export type HistoryFilter = "all" | "lucky" | "top" | "wins" | "my";
export type DepositMethod = "stars" | "ton";

export type RoundStatus = "open" | "countdown" | "spinning" | "finished";

export interface RoundPublic {
  id: string;
  rollId: number;
  mode: RoomMode;
  status: RoundStatus;
  totalBank: number;
  countdownEndsAt?: string | null;
  serverSeedHash?: string;
  /** Revealed only after spin */
  serverSeed?: string | null;
  spinDegrees?: number | null;
  winnerTelegramId?: number | null;
  houseFee?: number;
  potAfterFee?: number;
}

export interface SpinResultPublic {
  rollId: number;
  spinDegrees: number;
  winnerTelegramId: number;
  winnerUsername: string;
  mult: number;
  total: number;
  potAfterFee: number;
  houseFee: number;
  serverSeed: string;
  serverSeedHash: string;
}

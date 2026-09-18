import { apiFetch } from "@/lib/api";
import type { PvpRouletteStatus } from "@/lib/pvpRouletteConstants";

export type PvpRouletteBetPublic = {
  id: string;
  telegramId: number;
  username: string;
  avatarUrl: string | null;
  amount: number;
  pct: number;
};

export type PvpRouletteRoundPublic = {
  id: string;
  status: PvpRouletteStatus;
  betEndsAt: string | null;
  spinEndsAt: string | null;
  resultEndsAt: string | null;
  totalBank: number;
  winnerTelegramId: number | null;
  winnerAmount: number | null;
  houseFee: number | null;
  resultIndex: number | null;
  serverSeedHash: string;
  serverSeed: string | null;
  createdAt: string;
};

export type PvpRouletteStateResponse = {
  ok: boolean;
  round: PvpRouletteRoundPublic;
  bets: PvpRouletteBetPublic[];
  myBet: number;
  playerCount: number;
  serverNow: string;
  serverMs?: number;
  balance?: number;
  online?: number;
  history?: {
    id: string;
    winnerTelegramId: number | null;
    winnerUsername?: string;
    winnerAvatarUrl?: string | null;
    totalBank: number;
    winnerAmount: number | null;
    houseFee?: number | null;
    serverSeed?: string | null;
    serverSeedHash?: string | null;
    players?: {
      telegramId: number;
      username: string;
      avatarUrl: string | null;
      amount: number;
    }[];
    createdAt: string;
  }[];
};

export function fetchPvpRouletteState(opts?: { presence?: boolean }) {
  const q = opts?.presence ? "?presence=1" : "";
  return apiFetch<PvpRouletteStateResponse>(`/api/pvp-roulette/state${q}`, {
    cache: "no-store",
  } as RequestInit);
}

export function placePvpRouletteBetApi(amount: number) {
  return apiFetch<PvpRouletteStateResponse & { balance: number }>(
    "/api/pvp-roulette/bet",
    {
      method: "POST",
      body: JSON.stringify({ amount }),
    }
  );
}

export function fetchPvpRouletteHistory(limit = 20) {
  return apiFetch<{
    ok: boolean;
    history: PvpRouletteStateResponse["history"];
  }>(`/api/pvp-roulette/history?limit=${limit}`, {
    cache: "no-store",
  } as RequestInit);
}

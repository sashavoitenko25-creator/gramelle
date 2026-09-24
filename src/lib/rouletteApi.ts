import { apiFetch } from "@/lib/api";
import type { RouletteColor } from "@/lib/rouletteConstants";

export type RouletteBettor = {
  telegramId: number;
  username: string;
  photoUrl: string | null;
  amount: number;
};

export type RouletteStateResponse = {
  ok: boolean;
  round: {
    id: string;
    status: "betting" | "spinning" | "settled";
    betEndsAt: string;
    spinEndsAt: string | null;
    resultEndsAt: string | null;
    serverSeedHash: string;
    serverSeed: string | null;
    resultSlot: number | null;
    resultColor: RouletteColor | null;
    createdAt: string;
    gameNo?: number;
  };
  pools: Record<RouletteColor, number>;
  myBets: Record<RouletteColor, number>;
  myTotal: number;
  bettors?: number;
  betsByColor?: Record<RouletteColor, RouletteBettor[]>;
  history: { id: string; color: RouletteColor; slot: number }[];
  wheel: RouletteColor[];
  mult: Record<RouletteColor, number>;
  paravoz?: {
    streak: number;
    target: number;
    colors: RouletteColor[];
    bonusGram: number;
  };
  paravozWinners?: Array<{
    id: string;
    telegramId: number;
    username: string;
    streak: number;
    bonusGram: number;
    colors: RouletteColor[];
    at: string;
  }>;
  paravozParticipants?: Array<{
    telegramId: number;
    username: string;
    photoUrl: string | null;
    streak: number;
    colors: RouletteColor[];
  }>;
  serverNow: string;
  serverMs?: number;
  balance?: number;
  online?: number;
  state?: RouletteStateResponse;
};

export function fetchRouletteState(opts?: { presence?: boolean }) {
  const q = opts?.presence ? "?presence=1" : "";
  return apiFetch<RouletteStateResponse>(`/api/roulette/state${q}`, {
    cache: "no-store",
  } as RequestInit);
}

export function placeRouletteBetApi(color: RouletteColor, amount: number, couponId?: string) {
  return apiFetch<RouletteStateResponse & { balance: number }>(
    "/api/roulette/bet",
    {
      method: "POST",
      body: JSON.stringify({ color, amount, couponId }),
    }
  );
}

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
  serverNow: string;
  serverMs?: number;
  balance?: number;
  state?: RouletteStateResponse;
};

export function fetchRouletteState() {
  return apiFetch<RouletteStateResponse>("/api/roulette/state", {
    cache: "no-store",
  } as RequestInit);
}

export function placeRouletteBetApi(color: RouletteColor, amount: number) {
  return apiFetch<RouletteStateResponse & { balance: number }>(
    "/api/roulette/bet",
    {
      method: "POST",
      body: JSON.stringify({ color, amount }),
    }
  );
}

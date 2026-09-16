import { apiFetch } from "@/lib/api";

export interface RaceBallPublic {
  id: string;
  telegramId: number;
  username: string;
  photoUrl: string | null;
  color: string;
  seat: number;
  finishRank: number | null;
  isMine: boolean;
}

export interface RaceRoomPublic {
  id: string;
  status: "open" | "countdown" | "racing" | "finished" | "cancelled";
  hostTelegramId: number;
  ballPrice: number;
  pot: number;
  serverSeedHash: string;
  serverSeed: string | null;
  countdownEndsAt: string | null;
  secsLeft: number | null;
  buyLocked: boolean;
  canBuy: boolean;
  winnerTelegramId: number | null;
  winnerBallId: string | null;
  houseFee: number | null;
  finishOrder: string[] | null;
  gameNo: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  uniquePlayers: number;
  ballCount: number;
  balls: RaceBallPublic[];
  myBallCount: number;
  isHost: boolean;
}

export async function raceList() {
  return apiFetch<{
    ok?: boolean;
    rooms: RaceRoomPublic[];
    recent: RaceRoomPublic[];
    mine: RaceRoomPublic | null;
  }>("/api/race/list");
}

export async function raceCreate(ballPrice?: number) {
  return apiFetch<{ ok: boolean; room: RaceRoomPublic; balance: number }>(
    "/api/race/create",
    { method: "POST", body: JSON.stringify({ ballPrice }) }
  );
}

export async function raceBuy(roomId: string, count = 1) {
  return apiFetch<{ ok: boolean; room: RaceRoomPublic; balance: number }>(
    "/api/race/buy",
    { method: "POST", body: JSON.stringify({ roomId, count }) }
  );
}

export async function raceState(roomId: string) {
  return apiFetch<{ ok: boolean; room: RaceRoomPublic }>(
    `/api/race/state?roomId=${encodeURIComponent(roomId)}`
  );
}

export async function raceProcess(roomId?: string) {
  return apiFetch<{ ok: boolean; room?: RaceRoomPublic }>("/api/race/process", {
    method: "POST",
    body: JSON.stringify(roomId ? { roomId } : {}),
  });
}

export async function raceCancel(roomId: string) {
  return apiFetch<{ ok: boolean; room: RaceRoomPublic }>("/api/race/cancel", {
    method: "POST",
    body: JSON.stringify({ roomId }),
  });
}

export async function raceHistory(limit = 40) {
  return apiFetch<{
    ok?: boolean;
    items: Array<{
      roomId: string;
      gameNo: number | null;
      status: string;
      ballPrice: number;
      myBalls: number;
      pot: number;
      won: boolean;
      payout: number;
      spent: number;
      serverSeedHash: string;
      serverSeed: string | null;
      finishedAt: string | null;
      result: string;
    }>;
  }>(`/api/race/history?limit=${limit}`);
}

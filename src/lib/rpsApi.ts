import { apiFetch } from "@/lib/api";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/clientCache";

export type RpsChoice = "rock" | "paper" | "scissors";

export interface RpsPublicRoom {
  id: string;
  status: "open" | "playing" | "finished" | "cancelled";
  amount: number;
  creatorUsername: string;
  creatorPhotoUrl: string | null;
  creatorTelegramId: number;
  joinerUsername: string | null;
  joinerPhotoUrl: string | null;
  joinerTelegramId: number | null;
  creatorChoiceHash: string;
  serverSeedHash: string;
  creatorChoice: RpsChoice | null;
  creatorChoiceNonce: string | null;
  joinerChoice: RpsChoice | null;
  serverSeed: string | null;
  houseFee: number | null;
  potAfterFee: number | null;
  winnerTelegramId: number | null;
  createdAt: string;
  joinedAt: string | null;
  finishedAt: string | null;
  revealAt: string | null;
  isMine: boolean;
  isCreator: boolean;
  gameNo?: number | null;
}

export async function rpsList(opts?: { fresh?: boolean }) {
  const key = "rps:list";
  if (!opts?.fresh) {
    const hit = cacheGet<{
      ok?: boolean;
      demo?: boolean;
      rooms: RpsPublicRoom[];
      recent: RpsPublicRoom[];
      mine: RpsPublicRoom | null;
    }>(key);
    if (hit) return hit;
  }
  const data = await apiFetch<{
    ok?: boolean;
    demo?: boolean;
    rooms: RpsPublicRoom[];
    recent: RpsPublicRoom[];
    mine: RpsPublicRoom | null;
  }>("/api/rps/list");
  cacheSet(key, data, 3500);
  return data;
}

export async function rpsCreate(choice: RpsChoice, amount: number, couponId?: string) {
  cacheInvalidate("rps");
  return apiFetch<{
    ok: boolean;
    room: RpsPublicRoom;
    balance: number;
  }>("/api/rps/create", {
    method: "POST",
    body: JSON.stringify({ choice, amount, couponId }),
  });
}

export async function rpsCancel(roomId: string) {
  cacheInvalidate("rps");
  return apiFetch<{
    ok: boolean;
    room: RpsPublicRoom;
    balance: number;
  }>("/api/rps/cancel", {
    method: "POST",
    body: JSON.stringify({ roomId }),
  });
}

export async function rpsJoin(roomId: string, choice: RpsChoice) {
  cacheInvalidate("rps");
  return apiFetch<{
    ok: boolean;
    room: RpsPublicRoom;
    balance: number;
  }>("/api/rps/join", {
    method: "POST",
    body: JSON.stringify({ roomId, choice }),
  });
}

export async function rpsState(roomId: string) {
  return apiFetch<{
    ok: boolean;
    room: RpsPublicRoom;
  }>(`/api/rps/state?id=${encodeURIComponent(roomId)}`);
}

export async function rpsHistory(limit = 30) {
  return apiFetch<{
    ok?: boolean;
    items: Array<{
      id: string;
      room_id: string;
      opponent: string;
      my_choice: RpsChoice;
      opponent_choice: RpsChoice;
      amount: number;
      result: "win" | "lose" | "draw";
      payout: number;
      server_seed?: string;
      server_seed_hash?: string;
      creator_choice_hash?: string;
      created_at: string;
    }>;
  }>(`/api/rps/history?limit=${limit}`);
}

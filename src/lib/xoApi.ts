import { apiFetch } from "@/lib/api";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/clientCache";

export type XoSymbol = "X" | "O";
export type XoCell = XoSymbol | null;

export interface XoPublicRoom {
  id: string;
  status: "open" | "playing" | "finished" | "cancelled";
  amount: number;
  creatorUsername: string;
  creatorPhotoUrl: string | null;
  creatorTelegramId: number;
  creatorSymbol: XoSymbol;
  joinerUsername: string | null;
  joinerPhotoUrl: string | null;
  joinerTelegramId: number | null;
  board: XoCell[];
  turnSymbol: XoSymbol;
  turnDeadline: string | null;
  moveLog: { n: number; symbol: XoSymbol; cell: number; telegramId: number; at: string }[];
  houseFee: number | null;
  potAfterFee: number | null;
  winnerTelegramId: number | null;
  finishReason: string | null;
  gameNo: number | null;
  createdAt: string;
  joinedAt: string | null;
  finishedAt: string | null;
  isMine: boolean;
  isCreator: boolean;
  mySymbol: XoSymbol | null;
  isMyTurn: boolean;
}

export interface XoHistoryItem {
  id: string;
  room_id: string;
  telegram_id: number;
  opponent: string;
  my_symbol: XoSymbol;
  amount: number;
  result: "win" | "lose" | "draw";
  payout: number;
  game_no?: number | null;
  board?: XoCell[] | null;
  move_log?: unknown;
  finish_reason?: string | null;
  created_at: string;
}

export async function xoList(opts?: { fresh?: boolean }) {
  const key = "xo:list";
  if (!opts?.fresh) {
    const hit = cacheGet<{
      ok?: boolean;
      rooms: XoPublicRoom[];
      recent: XoPublicRoom[];
      mine: XoPublicRoom | null;
    }>(key);
    if (hit) return hit;
  }
  const data = await apiFetch<{
    ok?: boolean;
    rooms: XoPublicRoom[];
    recent: XoPublicRoom[];
    mine: XoPublicRoom | null;
  }>("/api/xo/list");
  cacheSet(key, data, 2500);
  return data;
}

export async function xoCreate(amount: number, symbol: XoSymbol = "X", couponId?: string) {
  cacheInvalidate("xo");
  return apiFetch<{ ok: boolean; room: XoPublicRoom; balance: number }>(
    "/api/xo/create",
    { method: "POST", body: JSON.stringify({ amount, symbol, couponId }) }
  );
}

export async function xoCancel(roomId: string) {
  cacheInvalidate("xo");
  return apiFetch<{ ok: boolean; room: XoPublicRoom; balance: number }>(
    "/api/xo/cancel",
    { method: "POST", body: JSON.stringify({ roomId }) }
  );
}

export async function xoJoin(roomId: string) {
  cacheInvalidate("xo");
  return apiFetch<{ ok: boolean; room: XoPublicRoom; balance: number }>(
    "/api/xo/join",
    { method: "POST", body: JSON.stringify({ roomId }) }
  );
}

export async function xoMove(roomId: string, cell: number) {
  cacheInvalidate("xo");
  return apiFetch<{ ok: boolean; room: XoPublicRoom; balance?: number }>(
    "/api/xo/move",
    { method: "POST", body: JSON.stringify({ roomId, cell }) }
  );
}

export async function xoState(roomId: string) {
  return apiFetch<{ ok?: boolean; room: XoPublicRoom }>(
    `/api/xo/state?id=${encodeURIComponent(roomId)}`
  );
}

export async function xoHistory(limit = 30) {
  return apiFetch<{ ok?: boolean; items: XoHistoryItem[] }>(
    `/api/xo/history?limit=${limit}`
  );
}

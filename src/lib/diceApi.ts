import { apiFetch } from "@/lib/api";

export interface DicePlayerPublic {
  seat: number;
  telegramId: number;
  username: string;
  photoUrl: string | null;
  active: boolean;
  die1: number | null;
  die2: number | null;
  sum: number | null;
  hasRolled: boolean;
}

export interface DiceRoomPublic {
  id: string;
  status: "open" | "playing" | "finished" | "cancelled";
  phase: "lobby" | "rolling" | "finished";
  amount: number;
  maxPlayers: number;
  hostTelegramId: number;
  round: number;
  turnSeat: number | null;
  turnDeadline: string | null;
  serverSeedHash: string;
  serverSeed: string | null;
  pot: number | null;
  houseFee: number | null;
  winnerTelegramId: number | null;
  players: DicePlayerPublic[];
  playerCount: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  isHost: boolean;
  isSeated: boolean;
  mySeat: number | null;
  isMyTurn: boolean;
  gameNo?: number | null;
}

export async function diceList() {
  return apiFetch<{
    ok?: boolean;
    rooms: DiceRoomPublic[];
    recent: DiceRoomPublic[];
    mine: DiceRoomPublic | null;
  }>("/api/dice/list");
}

export async function diceCreate(amount: number, maxPlayers: number, couponId?: string) {
  return apiFetch<{ ok: boolean; room: DiceRoomPublic; balance: number }>(
    "/api/dice/create",
    { method: "POST", body: JSON.stringify({ amount, maxPlayers, couponId }) }
  );
}

export async function diceJoin(roomId: string) {
  return apiFetch<{ ok: boolean; room: DiceRoomPublic; balance: number }>(
    "/api/dice/join",
    { method: "POST", body: JSON.stringify({ roomId }) }
  );
}

export async function diceLeave(roomId: string) {
  return apiFetch<{ ok: boolean; room: DiceRoomPublic | null; balance: number }>(
    "/api/dice/leave",
    { method: "POST", body: JSON.stringify({ roomId }) }
  );
}

export async function diceStart(roomId: string) {
  return apiFetch<{ ok: boolean; room: DiceRoomPublic }>(
    "/api/dice/start",
    { method: "POST", body: JSON.stringify({ roomId }) }
  );
}

export async function diceRoll(roomId: string) {
  return apiFetch<{
    ok: boolean;
    room: DiceRoomPublic;
    roll?: { die1: number; die2: number; sum: number };
  }>("/api/dice/roll", {
    method: "POST",
    body: JSON.stringify({ roomId }),
  });
}

export async function diceCancel(roomId: string) {
  return apiFetch<{ ok: boolean; room: DiceRoomPublic; balance: number }>(
    "/api/dice/cancel",
    { method: "POST", body: JSON.stringify({ roomId }) }
  );
}

export async function diceState(roomId: string) {
  return apiFetch<{ ok: boolean; room: DiceRoomPublic }>(
    `/api/dice/state?id=${encodeURIComponent(roomId)}`
  );
}

export interface DiceHistoryItem {
  id: string;
  room_id: string;
  telegram_id: number;
  username: string;
  amount: number;
  pot: number;
  house_fee: number;
  payout: number;
  result: "win" | "lose";
  server_seed: string | null;
  server_seed_hash: string | null;
  winner_telegram_id: number | null;
  player_count: number;
  die1: number | null;
  die2: number | null;
  sum: number | null;
  created_at: string;
  game_no?: number | null;
  players?: DicePlayerPublic[];
  winnerUsername?: string | null;
}

export async function diceHistory(limit = 30) {
  return apiFetch<{ ok?: boolean; items: DiceHistoryItem[] }>(
    `/api/dice/history?limit=${limit}`
  );
}

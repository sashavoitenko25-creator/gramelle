import { getAdminClient } from "./supabase";
import { creditBalance, recordWinStats } from "./ledger";
import { creditHouse } from "./house";
import { payReferralFromHouseFee } from "./referral";
import { HOUSE_EDGE, MIN_BET } from "@/lib/constants";
import { XO_MAX_BET, XO_TURN_SEC } from "@/lib/xoConstants";

export type XoSymbol = "X" | "O";
export type XoCell = XoSymbol | null;
export type XoStatus = "open" | "playing" | "finished" | "cancelled";

export interface XoMove {
  n: number;
  symbol: XoSymbol;
  cell: number;
  telegramId: number;
  at: string;
}

export interface XoRoomRow {
  id: string;
  status: XoStatus;
  amount: number;
  creator_telegram_id: number;
  creator_username: string;
  creator_photo_url?: string | null;
  creator_symbol: XoSymbol;
  joiner_telegram_id?: number | null;
  joiner_username?: string | null;
  joiner_photo_url?: string | null;
  board: XoCell[];
  turn_symbol: XoSymbol;
  turn_deadline?: string | null;
  move_log: XoMove[];
  house_fee?: number | null;
  pot_after_fee?: number | null;
  winner_telegram_id?: number | null;
  finish_reason?: string | null;
  game_no?: number | null;
  created_at: string;
  joined_at?: string | null;
  finished_at?: string | null;
}

export const XO_MIN_BET = MIN_BET;

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function emptyBoard(): XoCell[] {
  return [null, null, null, null, null, null, null, null, null];
}

export function checkWinner(board: XoCell[]): XoSymbol | null {
  for (const [a, b, c] of WIN_LINES) {
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return v;
  }
  return null;
}

export function isDraw(board: XoCell[]): boolean {
  return board.every((c) => c != null) && !checkWinner(board);
}

export function isValidSymbol(s: unknown): s is XoSymbol {
  return s === "X" || s === "O";
}

function parseBoard(raw: unknown): XoCell[] {
  if (Array.isArray(raw) && raw.length === 9) {
    return raw.map((c) => (c === "X" || c === "O" ? c : null));
  }
  return emptyBoard();
}

function parseLog(raw: unknown): XoMove[] {
  if (!Array.isArray(raw)) return [];
  return raw as XoMove[];
}

function normalize(row: XoRoomRow): XoRoomRow {
  return {
    ...row,
    board: parseBoard(row.board),
    move_log: parseLog(row.move_log),
    amount: Number(row.amount),
  };
}

function turnDeadlineIso(from = new Date()): string {
  return new Date(from.getTime() + XO_TURN_SEC * 1000).toISOString();
}

export function publicRoom(room: XoRoomRow, viewerTelegramId?: number | null) {
  const r = normalize(room);
  const isCreator = viewerTelegramId === r.creator_telegram_id;
  const isJoiner = viewerTelegramId === r.joiner_telegram_id;
  const mySymbol: XoSymbol | null = isCreator
    ? r.creator_symbol
    : isJoiner
      ? r.creator_symbol === "X"
        ? "O"
        : "X"
      : null;
  const isMyTurn =
    r.status === "playing" &&
    mySymbol != null &&
    r.turn_symbol === mySymbol;

  return {
    id: r.id,
    status: r.status,
    amount: r.amount,
    creatorUsername: r.creator_username,
    creatorPhotoUrl: r.creator_photo_url || null,
    creatorTelegramId: r.creator_telegram_id,
    creatorSymbol: r.creator_symbol,
    joinerUsername: r.joiner_username || null,
    joinerPhotoUrl: r.joiner_photo_url || null,
    joinerTelegramId: r.joiner_telegram_id ?? null,
    board: r.board,
    turnSymbol: r.turn_symbol,
    turnDeadline: r.turn_deadline || null,
    moveLog: r.move_log,
    houseFee: r.house_fee != null ? Number(r.house_fee) : null,
    potAfterFee: r.pot_after_fee != null ? Number(r.pot_after_fee) : null,
    winnerTelegramId: r.winner_telegram_id ?? null,
    finishReason: r.finish_reason || null,
    gameNo: r.game_no != null ? Number(r.game_no) : null,
    createdAt: r.created_at,
    joinedAt: r.joined_at || null,
    finishedAt: r.finished_at || null,
    isMine: isCreator || isJoiner,
    isCreator,
    mySymbol,
    isMyTurn,
  };
}

async function assertNotInActiveXo(db: ReturnType<typeof getAdminClient>, telegramId: number) {
  const { data: open } = await db
    .from("xo_rooms")
    .select("id")
    .eq("creator_telegram_id", telegramId)
    .eq("status", "open")
    .maybeSingle();
  if (open) throw new Error("You already have an open room — cancel it first");

  const { data: playingC } = await db
    .from("xo_rooms")
    .select("id")
    .eq("creator_telegram_id", telegramId)
    .eq("status", "playing")
    .maybeSingle();
  if (playingC) throw new Error("Finish your current game first");

  const { data: playingJ } = await db
    .from("xo_rooms")
    .select("id")
    .eq("joiner_telegram_id", telegramId)
    .eq("status", "playing")
    .maybeSingle();
  if (playingJ) throw new Error("Finish your current game first");
}

export async function listOpenRooms(viewerTelegramId?: number | null) {
  const db = getAdminClient();
  const { data, error } = await db
    .from("xo_rooms")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return ((data || []) as XoRoomRow[]).map((r) => publicRoom(r, viewerTelegramId));
}

export async function listRecentFinished(limit = 20) {
  const db = getAdminClient();
  const { data, error } = await db
    .from("xo_rooms")
    .select("*")
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as XoRoomRow[]).map((r) => publicRoom(r, null));
}

export async function listMine(viewerTelegramId: number) {
  const db = getAdminClient();
  const { data } = await db
    .from("xo_rooms")
    .select("*")
    .or(
      `and(creator_telegram_id.eq.${viewerTelegramId},status.in.(open,playing)),and(joiner_telegram_id.eq.${viewerTelegramId},status.eq.playing)`
    )
    .order("created_at", { ascending: false })
    .limit(5);
  const rows = (data || []) as XoRoomRow[];
  if (!rows.length) return null;
  return publicRoom(rows[0], viewerTelegramId);
}

export async function listBundle(viewerTelegramId?: number | null) {
  const [rooms, recent] = await Promise.all([
    listOpenRooms(viewerTelegramId),
    listRecentFinished(20),
  ]);
  let mine = null;
  if (viewerTelegramId) {
    try {
      mine = await listMine(viewerTelegramId);
    } catch {
      mine = null;
    }
  }
  return { rooms, recent, mine };
}

export async function createRoom(opts: {
  telegramId: number;
  username: string;
  photoUrl?: string | null;
  amount: number;
  symbol: XoSymbol;
}) {
  const { telegramId, username, photoUrl, amount, symbol } = opts;
  if (!isValidSymbol(symbol)) throw new Error("Invalid symbol");
  if (!Number.isFinite(amount) || amount < XO_MIN_BET) {
    throw new Error(`Min bet ${XO_MIN_BET} GRAM`);
  }
  if (amount > XO_MAX_BET) throw new Error(`Max bet ${XO_MAX_BET} GRAM`);

  const db = getAdminClient();
  await assertNotInActiveXo(db, telegramId);

  const { balance } = await creditBalance(telegramId, -amount, "bet", {
    game: "xo",
    action: "create",
  });

  const { data, error } = await db
    .from("xo_rooms")
    .insert({
      status: "open",
      amount,
      creator_telegram_id: telegramId,
      creator_username: username,
      creator_photo_url: photoUrl || null,
      creator_symbol: symbol,
      board: emptyBoard(),
      turn_symbol: "X",
      move_log: [],
      game_no: null,
    })
    .select("*")
    .single();

  if (error) {
    try {
      await creditBalance(telegramId, amount, "refund", {
        game: "xo",
        reason: "create_failed",
      });
    } catch {}
    throw error;
  }

  return { room: publicRoom(data as XoRoomRow, telegramId), balance };
}

export async function cancelRoom(opts: { telegramId: number; roomId: string }) {
  const { telegramId, roomId } = opts;
  const db = getAdminClient();
  const { data: room, error } = await db
    .from("xo_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error || !room) throw new Error("Room not found");
  const r = room as XoRoomRow;
  if (r.creator_telegram_id !== telegramId) throw new Error("Not your room");
  if (r.status !== "open") throw new Error("Can only cancel open rooms");

  const { data: claimed, error: cErr } = await db
    .from("xo_rooms")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();
  if (cErr || !claimed) throw new Error("Already taken or cancelled");

  const amount = Number(r.amount);
  const { balance } = await creditBalance(telegramId, amount, "refund", {
    game: "xo",
    room_id: roomId,
    action: "cancel",
  });
  return { room: publicRoom(claimed as XoRoomRow, telegramId), balance };
}

export async function joinRoom(opts: {
  telegramId: number;
  username: string;
  photoUrl?: string | null;
  roomId: string;
}) {
  const { telegramId, username, photoUrl, roomId } = opts;
  const db = getAdminClient();
  await assertNotInActiveXo(db, telegramId);

  const { data: room, error } = await db
    .from("xo_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error || !room) throw new Error("Room not found");
  const r = room as XoRoomRow;
  if (r.status !== "open") throw new Error("Room is not open");
  if (r.creator_telegram_id === telegramId) throw new Error("Cannot join your own room");

  const amount = Number(r.amount);
  const { balance } = await creditBalance(telegramId, -amount, "bet", {
    game: "xo",
    action: "join",
    room_id: roomId,
  });

  const now = new Date().toISOString();
  const { data: claimed, error: jErr } = await db
    .from("xo_rooms")
    .update({
      status: "playing",
      joiner_telegram_id: telegramId,
      joiner_username: username,
      joiner_photo_url: photoUrl || null,
      joined_at: now,
      turn_symbol: "X",
      turn_deadline: turnDeadlineIso(),
      board: emptyBoard(),
      move_log: [],
    })
    .eq("id", roomId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (jErr || !claimed) {
    try {
      await creditBalance(telegramId, amount, "refund", {
        game: "xo",
        reason: "join_failed",
        room_id: roomId,
      });
    } catch {}
    throw new Error("Room already taken");
  }

  return { room: publicRoom(claimed as XoRoomRow, telegramId), balance };
}

async function settleFinished(room: XoRoomRow): Promise<XoRoomRow> {
  const roomId = room.id;
  const amount = Number(room.amount);
  const bank = amount * 2;
  const houseFee = +(bank * HOUSE_EDGE).toFixed(6);
  const potAfterFee = +(bank - houseFee).toFixed(6);
  const creatorId = room.creator_telegram_id;
  const joinerId = room.joiner_telegram_id!;
  const winnerId = room.winner_telegram_id ?? null;
  const finishReason = room.finish_reason || (winnerId == null ? "draw" : "win");

  // Permanent number only for finished games (cancelled rooms no longer consume seq)
  let gameNoAssign: number | null =
    room.game_no != null ? Number(room.game_no) : null;
  if (gameNoAssign == null) {
    try {
      const { data: seq } = await getAdminClient().rpc("xo_next_game_no");
      if (seq != null) gameNoAssign = Number(seq);
    } catch {
      try {
        const { data: seqRows } = await getAdminClient().rpc("xo_next_game_no");
        if (seqRows != null) gameNoAssign = Number(seqRows);
      } catch {}
    }
  }
  if (gameNoAssign == null) {
    // fallback: max+1
    try {
      const { data: mx } = await getAdminClient()
        .from("xo_rooms")
        .select("game_no")
        .not("game_no", "is", null)
        .order("game_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      gameNoAssign = mx?.game_no != null ? Number(mx.game_no) + 1 : 1;
    } catch {
      gameNoAssign = 1;
    }
  }

  const { data: claimed, error } = await getAdminClient()
    .from("xo_rooms")
    .update({
      status: "finished",
      house_fee: winnerId == null ? 0 : houseFee,
      pot_after_fee: winnerId == null ? amount : potAfterFee,
      finished_at: new Date().toISOString(),
      finish_reason: finishReason,
      turn_deadline: null,
      game_no: gameNoAssign,
    })
    .eq("id", roomId)
    .eq("status", "playing")
    .select("*")
    .maybeSingle();

  if (error || !claimed) {
    const { data: again } = await getAdminClient()
      .from("xo_rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();
    return normalize((again || room) as XoRoomRow);
  }

  const finished = normalize(claimed as XoRoomRow);

  if (winnerId == null) {
    await creditBalance(creatorId, amount, "refund", {
      game: "xo",
      room_id: roomId,
      result: "draw",
    });
    await creditBalance(joinerId, amount, "refund", {
      game: "xo",
      room_id: roomId,
      result: "draw",
    });
  } else {
    await creditBalance(winnerId, potAfterFee, "win", {
      game: "xo",
      room_id: roomId,
      house_fee: houseFee,
    });
    try {
      await creditHouse(houseFee, "profit", "house_fee", {
        game: "xo",
        room_id: roomId,
      });
    } catch {}
    if (houseFee > 0) {
      const slice = +(houseFee / 2).toFixed(6);
      try {
        await payReferralFromHouseFee(creatorId, amount, slice);
      } catch {}
      try {
        await payReferralFromHouseFee(joinerId, amount, slice);
      } catch {}
    }
  }

  const creatorSymbol = finished.creator_symbol;
  const joinerSymbol: XoSymbol = creatorSymbol === "X" ? "O" : "X";
  const gameNo = finished.game_no != null ? Number(finished.game_no) : null;
  const board = finished.board;
  const moveLog = finished.move_log;

  const rows = [
    {
      room_id: roomId,
      telegram_id: creatorId,
      opponent: finished.joiner_username || "Opponent",
      my_symbol: creatorSymbol,
      amount,
      result:
        winnerId == null ? "draw" : winnerId === creatorId ? "win" : "lose",
      payout:
        winnerId == null
          ? amount
          : winnerId === creatorId
            ? potAfterFee
            : 0,
      game_no: gameNo,
      board,
      move_log: moveLog,
      finish_reason: finishReason,
    },
    {
      room_id: roomId,
      telegram_id: joinerId,
      opponent: finished.creator_username,
      my_symbol: joinerSymbol,
      amount,
      result:
        winnerId == null ? "draw" : winnerId === joinerId ? "win" : "lose",
      payout:
        winnerId == null
          ? amount
          : winnerId === joinerId
            ? potAfterFee
            : 0,
      game_no: gameNo,
      board,
      move_log: moveLog,
      finish_reason: finishReason,
    },
  ];

  try {
    await getAdminClient().from("xo_history").insert(rows);
  } catch {}

  try {
    await recordWinStats(creatorId, potAfterFee, winnerId === creatorId);
    await recordWinStats(joinerId, potAfterFee, winnerId === joinerId);
  } catch {}

  return finished;
}

function symbolOwner(room: XoRoomRow, symbol: XoSymbol): number {
  if (room.creator_symbol === symbol) return room.creator_telegram_id;
  return room.joiner_telegram_id!;
}

export async function makeMove(opts: {
  telegramId: number;
  roomId: string;
  cell: number;
}) {
  const { telegramId, roomId, cell } = opts;
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
    throw new Error("Invalid cell");
  }

  const db = getAdminClient();
  const { data: roomData, error } = await db
    .from("xo_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error || !roomData) throw new Error("Room not found");
  let room = normalize(roomData as XoRoomRow);

  if (room.status !== "playing") throw new Error("Game is not active");
  if (!room.joiner_telegram_id) throw new Error("No opponent");

  const mySymbol: XoSymbol | null =
    telegramId === room.creator_telegram_id
      ? room.creator_symbol
      : telegramId === room.joiner_telegram_id
        ? room.creator_symbol === "X"
          ? "O"
          : "X"
        : null;
  if (!mySymbol) throw new Error("Not a player");
  if (room.turn_symbol !== mySymbol) throw new Error("Not your turn");
  if (room.board[cell] != null) throw new Error("Cell occupied");

  const board = [...room.board];
  board[cell] = mySymbol;
  const moveLog = [
    ...room.move_log,
    {
      n: room.move_log.length + 1,
      symbol: mySymbol,
      cell,
      telegramId,
      at: new Date().toISOString(),
    },
  ];

  const winnerSym = checkWinner(board);
  const draw = isDraw(board);

  if (winnerSym || draw) {
    const winnerId = winnerSym ? symbolOwner(room, winnerSym) : null;
    const { data: updated, error: uErr } = await db
      .from("xo_rooms")
      .update({
        board,
        move_log: moveLog,
        winner_telegram_id: winnerId,
        finish_reason: winnerSym ? "win" : "draw",
      })
      .eq("id", roomId)
      .eq("status", "playing")
      .select("*")
      .maybeSingle();
    if (uErr || !updated) throw new Error("Move failed");
    const settled = await settleFinished(normalize(updated as XoRoomRow));
    return { room: publicRoom(settled, telegramId) };
  }

  const next: XoSymbol = mySymbol === "X" ? "O" : "X";
  const { data: updated, error: uErr } = await db
    .from("xo_rooms")
    .update({
      board,
      move_log: moveLog,
      turn_symbol: next,
      turn_deadline: turnDeadlineIso(),
    })
    .eq("id", roomId)
    .eq("status", "playing")
    .select("*")
    .maybeSingle();
  if (uErr || !updated) throw new Error("Move failed");
  return { room: publicRoom(normalize(updated as XoRoomRow), telegramId) };
}

async function timeoutOneRoom(room: XoRoomRow): Promise<XoRoomRow | null> {
  if (room.status !== "playing" || !room.joiner_telegram_id) return null;
  if (!room.turn_deadline) return null;
  if (new Date(room.turn_deadline).getTime() > Date.now()) return null;

  const db = getAdminClient();
  const loserSym = room.turn_symbol;
  const winnerSym: XoSymbol = loserSym === "X" ? "O" : "X";
  const winnerId = symbolOwner(room, winnerSym);

  const { data: updated, error } = await db
    .from("xo_rooms")
    .update({
      winner_telegram_id: winnerId,
      finish_reason: "timeout",
    })
    .eq("id", room.id)
    .eq("status", "playing")
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return settleFinished(normalize(updated as XoRoomRow));
}

export async function getRoomState(
  roomId: string,
  viewerTelegramId?: number | null
) {
  const db = getAdminClient();
  const { data } = await db
    .from("xo_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (!data) return null;
  let room = normalize(data as XoRoomRow);
  if (
    room.status === "playing" &&
    room.turn_deadline &&
    new Date(room.turn_deadline).getTime() <= Date.now()
  ) {
    try {
      const settled = await timeoutOneRoom(room);
      if (settled) room = settled;
    } catch {
      /* ignore */
    }
  }
  return publicRoom(room, viewerTelegramId);
}

export async function getXoHistory(telegramId: number, limit = 30) {
  const db = getAdminClient();
  try {
    const { data, error } = await db
      .from("xo_history")
      .select("*")
      .eq("telegram_id", telegramId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

/** Timeout: current turn player forfeits */
export async function processXoTimeouts(limit = 30): Promise<{
  finished: string[];
  checked: number;
}> {
  const db = getAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("xo_rooms")
    .select("*")
    .eq("status", "playing")
    .lte("turn_deadline", nowIso)
    .order("turn_deadline", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const rows = (data || []) as XoRoomRow[];
  const finished: string[] = [];

  for (const raw of rows) {
    try {
      const settled = await timeoutOneRoom(normalize(raw));
      if (settled) finished.push(settled.id);
    } catch {
      /* continue */
    }
  }

  return { finished, checked: rows.length };
}

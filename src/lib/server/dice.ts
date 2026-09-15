import crypto from "crypto";
import { getAdminClient } from "./supabase";
import { creditBalance, recordWinStats } from "./ledger";
import { creditHouse } from "./house";
import { payReferralFromHouseFee } from "./referral";
import {
  DICE_HOUSE_EDGE,
  DICE_MAX_BET,
  DICE_MAX_PLAYERS,
  DICE_MIN_BET,
  DICE_MIN_PLAYERS,
  DICE_OPEN_STALE_MIN,
  DICE_TURN_SEC,
} from "@/lib/diceConstants";

export type DiceRoomRow = {
  id: string;
  status: "open" | "playing" | "finished" | "cancelled";
  host_telegram_id: number;
  amount: number;
  max_players: number;
  phase: "lobby" | "rolling" | "finished";
  round: number;
  turn_seat: number | null;
  turn_deadline?: string | null;
  server_seed: string;
  server_seed_hash: string;
  pot: number | null;
  house_fee: number | null;
  winner_telegram_id: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  game_no?: number | null;
};

export type DicePlayerRow = {
  id: string;
  room_id: string;
  seat: number;
  telegram_id: number;
  username: string;
  photo_url: string | null;
  active: boolean;
  die1: number | null;
  die2: number | null;
  sum: number | null;
  has_rolled: boolean;
  joined_at: string;
};

function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function randomSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Deterministic 1..6 from HMAC */
function dieFromMaterial(material: string, index: number): number {
  const h = crypto
    .createHmac("sha256", material)
    .update(String(index))
    .digest();
  return (h[0] % 6) + 1;
}

function rollPair(
  serverSeed: string,
  roomId: string,
  round: number,
  seat: number,
  telegramId: number
): { die1: number; die2: number; sum: number } {
  const material = `${serverSeed}:${roomId}:${round}:${seat}:${telegramId}`;
  const die1 = dieFromMaterial(material, 1);
  const die2 = dieFromMaterial(material, 2);
  return { die1, die2, sum: die1 + die2 };
}

export function publicRoom(
  room: DiceRoomRow,
  players: DicePlayerRow[],
  viewerTelegramId?: number | null
) {
  const revealed = room.status === "finished";
  const isHost = viewerTelegramId === room.host_telegram_id;
  const me = players.find((p) => p.telegram_id === viewerTelegramId);
  const isSeated = Boolean(me);
  const mySeat = me ? me.seat : null;
  const isMyTurn =
    room.status === "playing" &&
    room.phase === "rolling" &&
    me != null &&
    me.active &&
    !me.has_rolled &&
    room.turn_seat === me.seat;

  const sorted = [...players].sort((a, b) => a.seat - b.seat);

  return {
    id: room.id,
    status: room.status,
    phase: room.phase,
    amount: Number(room.amount),
    maxPlayers: room.max_players,
    hostTelegramId: room.host_telegram_id,
    round: room.round,
    turnSeat: room.turn_seat,
    turnDeadline: room.turn_deadline || null,
    serverSeedHash: room.server_seed_hash,
    serverSeed: revealed ? room.server_seed : null,
    pot: room.pot != null ? Number(room.pot) : null,
    houseFee: room.house_fee != null ? Number(room.house_fee) : null,
    winnerTelegramId: room.winner_telegram_id,
    players: sorted.map((p) => ({
      seat: p.seat,
      telegramId: p.telegram_id,
      username: p.username,
      photoUrl: p.photo_url,
      active: p.active,
      die1: p.die1,
      die2: p.die2,
      sum: p.sum,
      hasRolled: p.has_rolled,
    })),
    playerCount: players.length,
    createdAt: room.created_at,
    startedAt: room.started_at,
    finishedAt: room.finished_at,
    isHost,
    isSeated,
    mySeat,
    isMyTurn,
    gameNo: room.game_no != null ? Number(room.game_no) : null,
  };
}

async function loadPlayers(roomId: string): Promise<DicePlayerRow[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("dice_players")
    .select("*")
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  if (error) throw error;
  return (data || []) as DicePlayerRow[];
}

async function loadRoom(roomId: string): Promise<DiceRoomRow> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("dice_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error || !data) throw new Error("Table not found");
  return data as DiceRoomRow;
}


function turnDeadlineIso(from = new Date()): string {
  return new Date(from.getTime() + DICE_TURN_SEC * 1000).toISOString();
}

async function writeDiceHistory(
  room: DiceRoomRow,
  players: DicePlayerRow[],
  winnerTelegramId: number,
  pot: number,
  fee: number,
  payout: number
) {
  const db = getAdminClient();
  const rows = players.map((pl) => {
    const won = pl.telegram_id === winnerTelegramId;
    return {
      room_id: room.id,
      telegram_id: pl.telegram_id,
      username: pl.username,
      amount: Number(room.amount),
      pot,
      house_fee: fee,
      payout: won ? payout : 0,
      result: won ? "win" : "lose",
      server_seed: room.server_seed,
      server_seed_hash: room.server_seed_hash,
      winner_telegram_id: winnerTelegramId,
      player_count: players.length,
      die1: pl.die1,
      die2: pl.die2,
      sum: pl.sum,
      game_no: room.game_no != null ? Number(room.game_no) : null,
    };
  });
  try {
    await db.from("dice_history").insert(rows);
  } catch {
    /* table may not exist yet — non-fatal */
  }
}


export async function listRooms(viewerTelegramId?: number | null) {
  const db = getAdminClient();
  // Parallel room queries
  const [openRes, recentRes] = await Promise.all([
    db
      .from("dice_rooms")
      .select("*")
      .in("status", ["open", "playing"])
      .order("created_at", { ascending: false })
      .limit(25),
    db
      .from("dice_rooms")
      .select("*")
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(12),
  ]);

  const open = (openRes.data || []) as DiceRoomRow[];
  const recent = (recentRes.data || []) as DiceRoomRow[];
  const allIds = [...open, ...recent].map((r) => r.id);

  // One query for all players (no N+1)
  let playersByRoom = new Map<string, DicePlayerRow[]>();
  if (allIds.length) {
    const { data: allPlayers } = await db
      .from("dice_players")
      .select("*")
      .in("room_id", allIds)
      .order("seat", { ascending: true });
    for (const pl of (allPlayers || []) as DicePlayerRow[]) {
      const list = playersByRoom.get(pl.room_id) || [];
      list.push(pl);
      playersByRoom.set(pl.room_id, list);
    }
  }

  const rooms: ReturnType<typeof publicRoom>[] = [];
  let mine: ReturnType<typeof publicRoom> | null = null;

  for (const row of open) {
    const players = playersByRoom.get(row.id) || [];
    const pub = publicRoom(row, players, viewerTelegramId);
    rooms.push(pub);
    if (
      viewerTelegramId &&
      players.some((p) => p.telegram_id === viewerTelegramId)
    ) {
      mine = pub;
    }
  }

  const recentPub = recent.map((row) =>
    publicRoom(row, playersByRoom.get(row.id) || [], viewerTelegramId)
  );

  return { rooms, recent: recentPub, mine };
}

export async function createTable(opts: {
  telegramId: number;
  username: string;
  photoUrl?: string | null;
  amount: number;
  maxPlayers: number;
}) {
  const { telegramId, username, photoUrl, amount, maxPlayers } = opts;
  if (!Number.isFinite(amount) || amount < DICE_MIN_BET) {
    throw new Error(`Min bet ${DICE_MIN_BET} GRAM`);
  }
  if (amount > DICE_MAX_BET) {
    throw new Error(`Max bet ${DICE_MAX_BET} GRAM`);
  }
  const maxP = Math.floor(Number(maxPlayers) || 2);
  if (maxP < DICE_MIN_PLAYERS || maxP > DICE_MAX_PLAYERS) {
    throw new Error(`Players ${DICE_MIN_PLAYERS}–${DICE_MAX_PLAYERS}`);
  }

  const db = getAdminClient();

  // Already in an open/playing table?
  const { data: mySeats } = await db
    .from("dice_players")
    .select("room_id")
    .eq("telegram_id", telegramId)
    .limit(30);
  const roomIds = (mySeats || []).map((s: { room_id: string }) => s.room_id);
  if (roomIds.length) {
    const { data: live } = await db
      .from("dice_rooms")
      .select("id, status")
      .in("id", roomIds)
      .in("status", ["open", "playing"]);
    if (live && live.length) {
      throw new Error("Finish or leave your current Dice table first");
    }
  }

  const { balance } = await creditBalance(telegramId, -amount, "bet", {
    game: "dice",
    action: "create",
  });

  const serverSeed = randomSeed();
  const { data: room, error } = await db
    .from("dice_rooms")
    .insert({
      status: "open",
      phase: "lobby",
      host_telegram_id: telegramId,
      amount,
      max_players: maxP,
      server_seed: serverSeed,
      server_seed_hash: hashSeed(serverSeed),
      round: 0,
    })
    .select("*")
    .single();

  if (error || !room) {
    try {
      await creditBalance(telegramId, amount, "refund", {
        game: "dice",
        reason: "create_failed",
      });
    } catch {
      /* */
    }
    throw error || new Error("Create failed");
  }

  const { error: pErr } = await db.from("dice_players").insert({
    room_id: room.id,
    seat: 0,
    telegram_id: telegramId,
    username,
    photo_url: photoUrl || null,
    active: true,
  });

  if (pErr) {
    await db.from("dice_rooms").delete().eq("id", room.id);
    try {
      await creditBalance(telegramId, amount, "refund", {
        game: "dice",
        reason: "seat_failed",
      });
    } catch {
      /* */
    }
    throw pErr;
  }

  const players = await loadPlayers(room.id);
  return {
    balance,
    room: publicRoom(room as DiceRoomRow, players, telegramId),
  };
}

export async function joinTable(opts: {
  telegramId: number;
  username: string;
  photoUrl?: string | null;
  roomId: string;
}) {
  const { telegramId, username, photoUrl, roomId } = opts;
  const db = getAdminClient();
  const room = await loadRoom(roomId);

  if (room.status !== "open" || room.phase !== "lobby") {
    throw new Error("Table is not open for join");
  }

  const players = await loadPlayers(roomId);
  if (players.some((p) => p.telegram_id === telegramId)) {
    throw new Error("Already seated");
  }
  if (players.length >= room.max_players) {
    throw new Error("Table is full");
  }

  // free seat
  const used = new Set(players.map((p) => p.seat));
  let seat = -1;
  for (let i = 0; i < room.max_players; i++) {
    if (!used.has(i)) {
      seat = i;
      break;
    }
  }
  if (seat < 0) throw new Error("No free seat");

  const amount = Number(room.amount);
  const { balance } = await creditBalance(telegramId, -amount, "bet", {
    game: "dice",
    action: "join",
    room_id: roomId,
  });

  const { error } = await db.from("dice_players").insert({
    room_id: roomId,
    seat,
    telegram_id: telegramId,
    username,
    photo_url: photoUrl || null,
    active: true,
  });

  if (error) {
    try {
      await creditBalance(telegramId, amount, "refund", {
        game: "dice",
        reason: "join_failed",
        room_id: roomId,
      });
    } catch {
      /* */
    }
    throw error;
  }

  const updated = await loadPlayers(roomId);
  return {
    balance,
    room: publicRoom(room, updated, telegramId),
  };
}

export async function leaveTable(opts: {
  telegramId: number;
  roomId: string;
}) {
  const { telegramId, roomId } = opts;
  const db = getAdminClient();
  const room = await loadRoom(roomId);

  if (room.status !== "open") {
    throw new Error("Cannot leave after start");
  }

  const players = await loadPlayers(roomId);
  const me = players.find((p) => p.telegram_id === telegramId);
  if (!me) throw new Error("Not seated");

  if (room.host_telegram_id === telegramId) {
    // host leave = cancel table, refund all
    return cancelTable({ telegramId, roomId });
  }

  await db
    .from("dice_players")
    .delete()
    .eq("room_id", roomId)
    .eq("telegram_id", telegramId);

  const { balance } = await creditBalance(
    telegramId,
    Number(room.amount),
    "refund",
    { game: "dice", action: "leave", room_id: roomId }
  );

  const updated = await loadPlayers(roomId);
  return {
    balance,
    room: publicRoom(room, updated, telegramId),
  };
}

export async function cancelTable(opts: {
  telegramId: number;
  roomId: string;
}) {
  const { telegramId, roomId } = opts;
  const db = getAdminClient();
  const room = await loadRoom(roomId);

  if (room.host_telegram_id !== telegramId) {
    throw new Error("Only host can cancel");
  }
  if (room.status !== "open") {
    throw new Error("Cannot cancel now");
  }

  const { data: claimed, error } = await db
    .from("dice_rooms")
    .update({
      status: "cancelled",
      phase: "finished",
      finished_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (error || !claimed) throw new Error("Already started or cancelled");

  const players = await loadPlayers(roomId);
  let balance = 0;
  for (const p of players) {
    const res = await creditBalance(
      p.telegram_id,
      Number(room.amount),
      "refund",
      { game: "dice", action: "cancel", room_id: roomId }
    );
    if (p.telegram_id === telegramId) balance = res.balance;
  }

  return {
    balance,
    room: publicRoom(claimed as DiceRoomRow, players, telegramId),
  };
}

export async function startTable(opts: {
  telegramId: number;
  roomId: string;
}) {
  const { telegramId, roomId } = opts;
  const db = getAdminClient();
  const room = await loadRoom(roomId);

  if (room.host_telegram_id !== telegramId) {
    throw new Error("Only host can start");
  }
  if (room.status !== "open") throw new Error("Already started");

  const players = await loadPlayers(roomId);
  if (players.length < DICE_MIN_PLAYERS) {
    throw new Error(`Need at least ${DICE_MIN_PLAYERS} players`);
  }

  const pot = +(Number(room.amount) * players.length).toFixed(4);
  const houseFee = +(pot * DICE_HOUSE_EDGE).toFixed(4);

  // lowest seat starts
  const seats = players.map((p) => p.seat).sort((a, b) => a - b);
  const turnSeat = seats[0];

  // clear rolls
  await db
    .from("dice_players")
    .update({
      active: true,
      die1: null,
      die2: null,
      sum: null,
      has_rolled: false,
    })
    .eq("room_id", roomId);

  const { data: updated, error } = await db
    .from("dice_rooms")
    .update({
      status: "playing",
      phase: "rolling",
      round: 1,
      turn_seat: turnSeat,
      turn_deadline: turnDeadlineIso(),
      pot,
      house_fee: houseFee,
      started_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (error || !updated) throw new Error("Could not start");

  const pl = await loadPlayers(roomId);
  return { room: publicRoom(updated as DiceRoomRow, pl, telegramId) };
}

async function advanceAfterRoll(
  room: DiceRoomRow,
  players: DicePlayerRow[]
): Promise<DiceRoomRow> {
  const db = getAdminClient();
  const active = players.filter((p) => p.active);
  const allRolled = active.every((p) => p.has_rolled);

  if (!allRolled) {
    // next seat among active who hasn't rolled
    const seats = active
      .filter((p) => !p.has_rolled)
      .map((p) => p.seat)
      .sort((a, b) => a - b);
    const next = seats[0] ?? room.turn_seat;
    const { data } = await db
      .from("dice_rooms")
      .update({ turn_seat: next, turn_deadline: turnDeadlineIso() })
      .eq("id", room.id)
      .select("*")
      .single();
    return data as DiceRoomRow;
  }

  // resolve round
  const maxSum = Math.max(...active.map((p) => p.sum || 0));
  const leaders = active.filter((p) => (p.sum || 0) === maxSum);

  if (leaders.length === 1) {
    // single winner
    const winner = leaders[0];
    const pot = Number(room.pot || 0);
    const fee = Number(room.house_fee || 0);
    const payout = +(pot - fee).toFixed(4);

    await creditBalance(winner.telegram_id, payout, "win", {
      game: "dice",
      room_id: room.id,
      pot,
      fee,
    });

    try {
      if (fee > 0) {
        await creditHouse(fee, "profit", "house_fee", {
          game: "dice",
          room_id: room.id,
        });
        const stake = Number(room.amount);
        const contributors = players.length || 1;
        const slice = +(fee / contributors).toFixed(6);
        for (const pl of players) {
          try {
            await payReferralFromHouseFee(pl.telegram_id, stake, slice);
          } catch {}
        }
      }
    } catch {}

    try {
      for (const pl of players) {
        await recordWinStats(
          pl.telegram_id,
          payout,
          pl.telegram_id === winner.telegram_id
        );
      }
    } catch {}

    await writeDiceHistory(
      room,
      players,
      winner.telegram_id,
      pot,
      fee,
      payout
    );

    let gameNoAssign: number | null =
      room.game_no != null ? Number(room.game_no) : null;
    if (gameNoAssign == null) {
      try {
        const { data: seq } = await db.rpc("dice_next_game_no");
        if (seq != null) gameNoAssign = Number(seq);
      } catch {
        try {
          const { data: mx } = await db
            .from("dice_rooms")
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
    }

    const { data } = await db
      .from("dice_rooms")
      .update({
        status: "finished",
        phase: "finished",
        winner_telegram_id: winner.telegram_id,
        turn_seat: null,
        turn_deadline: null,
        finished_at: new Date().toISOString(),
        game_no: gameNoAssign,
      })
      .eq("id", room.id)
      .select("*")
      .single();
    // writeDiceHistory already used room.game_no — refresh
    if (data && gameNoAssign != null) {
      try {
        await db
          .from("dice_history")
          .update({ game_no: gameNoAssign })
          .eq("room_id", room.id);
      } catch {}
    }
    return data as DiceRoomRow;
  }

  // tie-break: only leaders stay active, rest eliminated
  const leaderIds = new Set(leaders.map((p) => p.telegram_id));
  for (const p of players) {
    const stay = leaderIds.has(p.telegram_id);
    await db
      .from("dice_players")
      .update({
        active: stay,
        die1: null,
        die2: null,
        sum: null,
        has_rolled: false,
      })
      .eq("id", p.id);
  }

  const nextSeats = leaders.map((p) => p.seat).sort((a, b) => a - b);
  const { data } = await db
    .from("dice_rooms")
    .update({
      round: room.round + 1,
      turn_seat: nextSeats[0],
      turn_deadline: turnDeadlineIso(),
      phase: "rolling",
    })
    .eq("id", room.id)
    .select("*")
    .single();

  return data as DiceRoomRow;
}

export async function rollDice(opts: {
  telegramId: number;
  roomId: string;
}) {
  const { telegramId, roomId } = opts;
  const db = getAdminClient();
  const room = await loadRoom(roomId);

  if (room.status !== "playing" || room.phase !== "rolling") {
    throw new Error("Not in rolling phase");
  }

  const players = await loadPlayers(roomId);
  const me = players.find((p) => p.telegram_id === telegramId);
  if (!me || !me.active) throw new Error("You are not active at this table");
  if (me.has_rolled) throw new Error("Already rolled this round");
  if (room.turn_seat !== me.seat) throw new Error("Not your turn");

  const pair = rollPair(
    room.server_seed,
    room.id,
    room.round,
    me.seat,
    telegramId
  );

  const { error } = await db
    .from("dice_players")
    .update({
      die1: pair.die1,
      die2: pair.die2,
      sum: pair.sum,
      has_rolled: true,
    })
    .eq("id", me.id)
    .eq("has_rolled", false);

  if (error) throw error;

  const afterPlayers = await loadPlayers(roomId);
  const updatedRoom = await advanceAfterRoll(room, afterPlayers);
  const finalPlayers = await loadPlayers(roomId);

  return {
    roll: pair,
    room: publicRoom(updatedRoom, finalPlayers, telegramId),
  };
}

export async function getState(
  roomId: string,
  viewerTelegramId?: number | null
) {
  const room = await loadRoom(roomId);
  const players = await loadPlayers(roomId);
  return { room: publicRoom(room, players, viewerTelegramId) };
}


/** Personal history rows (+ players for UI parity with All tab) */
export async function getDiceHistory(telegramId: number, limit = 30) {
  const db = getAdminClient();
  try {
    const { data, error } = await db
      .from("dice_history")
      .select("*")
      .eq("telegram_id", telegramId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) return [];

    const roomIds = [...new Set(rows.map((r: { room_id: string }) => r.room_id))];
    const { data: allPlayers } = await db
      .from("dice_players")
      .select("*")
      .in("room_id", roomIds)
      .order("seat", { ascending: true });

    const byRoom = new Map<string, DicePlayerRow[]>();
    for (const pl of (allPlayers || []) as DicePlayerRow[]) {
      const list = byRoom.get(pl.room_id) || [];
      list.push(pl);
      byRoom.set(pl.room_id, list);
    }

    return rows.map((h: Record<string, unknown>) => {
      const players = byRoom.get(String(h.room_id)) || [];
      const winnerId = h.winner_telegram_id as number | null;
      const winner = players.find((p) => p.telegram_id === winnerId);
      return {
        ...h,
        players: players.map((p) => ({
          seat: p.seat,
          telegramId: p.telegram_id,
          username: p.username,
          photoUrl: p.photo_url,
          active: p.active,
          die1: p.die1,
          die2: p.die2,
          sum: p.sum,
          hasRolled: p.has_rolled,
        })),
        winnerUsername: winner?.username || null,
      };
    });
  } catch {
    return [];
  }
}

/** Server auto-roll for AFK player on turn_seat */
async function autoRollForTurn(roomId: string): Promise<boolean> {
  const db = getAdminClient();
  const room = await loadRoom(roomId);
  if (room.status !== "playing" || room.phase !== "rolling") return false;
  if (room.turn_seat == null) return false;

  const players = await loadPlayers(roomId);
  const me = players.find((p) => p.seat === room.turn_seat && p.active);
  if (!me || me.has_rolled) return false;

  const pair = rollPair(
    room.server_seed,
    room.id,
    room.round,
    me.seat,
    me.telegram_id
  );

  const { error } = await db
    .from("dice_players")
    .update({
      die1: pair.die1,
      die2: pair.die2,
      sum: pair.sum,
      has_rolled: true,
    })
    .eq("id", me.id)
    .eq("has_rolled", false);

  if (error) return false;

  const afterPlayers = await loadPlayers(roomId);
  await advanceAfterRoll(room, afterPlayers);
  return true;
}

async function forceCancelOpen(roomId: string): Promise<boolean> {
  const db = getAdminClient();
  const room = await loadRoom(roomId);
  if (room.status !== "open") return false;

  const players = await loadPlayers(roomId);
  const amount = Number(room.amount);

  for (const pl of players) {
    try {
      await creditBalance(pl.telegram_id, amount, "refund", {
        game: "dice",
        room_id: roomId,
        action: "stale_cancel",
      });
    } catch {
      /* continue */
    }
  }

  await db
    .from("dice_rooms")
    .update({
      status: "cancelled",
      phase: "finished",
      turn_seat: null,
      turn_deadline: null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "open");

  return true;
}

/**
 * Cron: AFK auto-roll + cancel stale open tables.
 */
export async function processStuckDiceRooms(limit = 40): Promise<{
  checked: number;
  autoRolled: string[];
  cancelled: string[];
}> {
  const db = getAdminClient();
  const nowIso = new Date().toISOString();
  const staleBefore = new Date(
    Date.now() - DICE_OPEN_STALE_MIN * 60 * 1000
  ).toISOString();

  const autoRolled: string[] = [];
  const cancelled: string[] = [];
  let checked = 0;

  // Overdue turns (column may be missing until SQL migration)
  try {
    const { data: overdue } = await db
      .from("dice_rooms")
      .select("id")
      .eq("status", "playing")
      .eq("phase", "rolling")
      .lte("turn_deadline", nowIso)
      .order("turn_deadline", { ascending: true })
      .limit(limit);

    for (const row of overdue || []) {
      checked++;
      try {
        const ok = await autoRollForTurn(row.id);
        if (ok) autoRolled.push(row.id);
      } catch {
        /* next */
      }
    }
  } catch {
    /* turn_deadline column missing */
  }

  // Stale open tables
  try {
    const { data: stale } = await db
      .from("dice_rooms")
      .select("id")
      .eq("status", "open")
      .lt("created_at", staleBefore)
      .order("created_at", { ascending: true })
      .limit(limit);

    for (const row of stale || []) {
      checked++;
      try {
        const ok = await forceCancelOpen(row.id);
        if (ok) cancelled.push(row.id);
      } catch {
        /* next */
      }
    }
  } catch {
    /* */
  }

  return { checked, autoRolled, cancelled };
}


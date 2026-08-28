import crypto from "crypto";
import { getAdminClient } from "./supabase";
import { creditBalance, recordWinStats } from "./ledger";
import { creditHouse } from "./house";
import { HOUSE_EDGE, MIN_BET } from "@/lib/constants";

export type RpsChoice = "rock" | "paper" | "scissors";
export type RpsStatus = "open" | "playing" | "finished" | "cancelled";

export interface RpsRoomRow {
  id: string;
  status: RpsStatus;
  creator_telegram_id: number;
  creator_username: string;
  creator_photo_url?: string | null;
  creator_choice: RpsChoice;
  creator_choice_nonce: string;
  creator_choice_hash: string;
  joiner_telegram_id?: number | null;
  joiner_username?: string | null;
  joiner_photo_url?: string | null;
  joiner_choice?: RpsChoice | null;
  amount: number;
  house_fee?: number | null;
  pot_after_fee?: number | null;
  winner_telegram_id?: number | null;
  server_seed: string;
  server_seed_hash: string;
  created_at: string;
  joined_at?: string | null;
  finished_at?: string | null;
  reveal_at?: string | null;
}

export const RPS_MIN_BET = MIN_BET;
export const RPS_MAX_BET = 500;
export const RPS_REVEAL_SEC = 11; // animation length

const CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];

function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function randomSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

function randomNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Public commitment: sha256(choice:nonce) */
export function choiceCommitment(choice: RpsChoice, nonce: string): string {
  return hashSeed(`${choice}:${nonce}`);
}

export function isValidChoice(c: unknown): c is RpsChoice {
  return c === "rock" || c === "paper" || c === "scissors";
}

/** Returns winner: 'a' | 'b' | 'draw' */
export function resolveRps(a: RpsChoice, b: RpsChoice): "a" | "b" | "draw" {
  if (a === b) return "draw";
  if (
    (a === "rock" && b === "scissors") ||
    (a === "paper" && b === "rock") ||
    (a === "scissors" && b === "paper")
  ) {
    return "a";
  }
  return "b";
}

/** Sanitize room for public list / lobby (never leak creator choice while open) */
export function publicRoom(room: RpsRoomRow, viewerTelegramId?: number | null) {
  const isCreator = viewerTelegramId === room.creator_telegram_id;
  const isJoiner = viewerTelegramId === room.joiner_telegram_id;
  const revealed =
    room.status === "finished" || room.status === "playing";

  return {
    id: room.id,
    status: room.status,
    amount: Number(room.amount),
    creatorUsername: room.creator_username,
    creatorPhotoUrl: room.creator_photo_url || null,
    creatorTelegramId: room.creator_telegram_id,
    joinerUsername: room.joiner_username || null,
    joinerPhotoUrl: room.joiner_photo_url || null,
    joinerTelegramId: room.joiner_telegram_id || null,
    // Choice hash always public (commit)
    creatorChoiceHash: room.creator_choice_hash,
    serverSeedHash: room.server_seed_hash,
    // Revealed only after join / finish
    creatorChoice:
      revealed || isCreator ? room.creator_choice : null,
    creatorChoiceNonce:
      room.status === "finished" ? room.creator_choice_nonce : null,
    joinerChoice: revealed || isJoiner ? room.joiner_choice : null,
    serverSeed: room.status === "finished" ? room.server_seed : null,
    houseFee: room.house_fee != null ? Number(room.house_fee) : null,
    potAfterFee: room.pot_after_fee != null ? Number(room.pot_after_fee) : null,
    winnerTelegramId: room.winner_telegram_id ?? null,
    createdAt: room.created_at,
    joinedAt: room.joined_at || null,
    finishedAt: room.finished_at || null,
    revealAt: room.reveal_at || null,
    isMine: isCreator || isJoiner,
    isCreator,
  };
}

export async function listOpenRooms(viewerTelegramId?: number | null) {
  const db = getAdminClient();
  const { data, error } = await db
    .from("rps_rooms")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return ((data || []) as RpsRoomRow[]).map((r) =>
    publicRoom(r, viewerTelegramId)
  );
}

export async function listRecentFinished(limit = 20) {
  const db = getAdminClient();
  const { data, error } = await db
    .from("rps_rooms")
    .select("*")
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as RpsRoomRow[]).map((r) => publicRoom(r, null));
}

export async function createRoom(opts: {
  telegramId: number;
  username: string;
  photoUrl?: string | null;
  choice: RpsChoice;
  amount: number;
}) {
  const { telegramId, username, photoUrl, choice, amount } = opts;

  if (!isValidChoice(choice)) throw new Error("Invalid choice");
  if (!Number.isFinite(amount) || amount < RPS_MIN_BET) {
    throw new Error(`Min bet ${RPS_MIN_BET} GRAM`);
  }
  if (amount > RPS_MAX_BET) {
    throw new Error(`Max bet ${RPS_MAX_BET} GRAM`);
  }

  const db = getAdminClient();

  // One open room per player
  const { data: existing } = await db
    .from("rps_rooms")
    .select("id")
    .eq("creator_telegram_id", telegramId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) {
    throw new Error("You already have an open room — cancel it first");
  }

  // Also block if currently playing as joiner
  const { data: asJoiner } = await db
    .from("rps_rooms")
    .select("id")
    .eq("joiner_telegram_id", telegramId)
    .eq("status", "playing")
    .maybeSingle();
  if (asJoiner) {
    throw new Error("Finish your current game first");
  }

  const { balance } = await creditBalance(telegramId, -amount, "bet", {
    game: "rps",
    action: "create",
  });

  const nonce = randomNonce();
  const serverSeed = randomSeed();
  const commitment = choiceCommitment(choice, nonce);

  const { data, error } = await db
    .from("rps_rooms")
    .insert({
      status: "open",
      creator_telegram_id: telegramId,
      creator_username: username,
      creator_photo_url: photoUrl || null,
      creator_choice: choice,
      creator_choice_nonce: nonce,
      creator_choice_hash: commitment,
      amount,
      server_seed: serverSeed,
      server_seed_hash: hashSeed(serverSeed),
    })
    .select("*")
    .single();

  if (error) {
    // refund
    try {
      await creditBalance(telegramId, amount, "refund", {
        game: "rps",
        reason: "create_failed",
      });
    } catch {}
    throw error;
  }

  return {
    room: publicRoom(data as RpsRoomRow, telegramId),
    balance,
  };
}

export async function cancelRoom(opts: {
  telegramId: number;
  roomId: string;
}) {
  const { telegramId, roomId } = opts;
  const db = getAdminClient();

  const { data: room, error } = await db
    .from("rps_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error || !room) throw new Error("Room not found");
  const r = room as RpsRoomRow;

  if (r.creator_telegram_id !== telegramId) {
    throw new Error("Only the creator can cancel");
  }
  if (r.status !== "open") {
    throw new Error("Room can no longer be cancelled");
  }

  const { data: claimed, error: claimErr } = await db
    .from("rps_rooms")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (claimErr || !claimed) {
    throw new Error("Room already joined or cancelled");
  }

  const { balance } = await creditBalance(
    telegramId,
    Number(r.amount),
    "refund",
    { game: "rps", room_id: roomId, action: "cancel" }
  );

  return { balance, room: publicRoom(claimed as RpsRoomRow, telegramId) };
}

export async function joinRoom(opts: {
  telegramId: number;
  username: string;
  photoUrl?: string | null;
  roomId: string;
  choice: RpsChoice;
}) {
  const { telegramId, username, photoUrl, roomId, choice } = opts;

  if (!isValidChoice(choice)) throw new Error("Invalid choice");

  const db = getAdminClient();

  const { data: room, error } = await db
    .from("rps_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error || !room) throw new Error("Room not found");
  const r = room as RpsRoomRow;

  if (r.status !== "open") throw new Error("Room is not open");
  if (r.creator_telegram_id === telegramId) {
    throw new Error("Cannot join your own room");
  }

  // Debit joiner
  const amount = Number(r.amount);
  const { balance } = await creditBalance(telegramId, -amount, "bet", {
    game: "rps",
    room_id: roomId,
    action: "join",
  });

  const now = new Date();
  const revealAt = new Date(now.getTime() + RPS_REVEAL_SEC * 1000);

  const outcome = resolveRps(r.creator_choice, choice);
  const total = +(amount * 2).toFixed(4);
  const houseFee = +(total * HOUSE_EDGE).toFixed(4);
  const potAfterFee = +(total - houseFee).toFixed(4);

  let winnerTelegramId: number | null = null;
  if (outcome === "a") winnerTelegramId = r.creator_telegram_id;
  if (outcome === "b") winnerTelegramId = telegramId;
  // draw → null, both get stake back minus half house? We refund full stakes on draw (no house)

  // Claim join atomically
  const { data: claimed, error: claimErr } = await db
    .from("rps_rooms")
    .update({
      status: "playing",
      joiner_telegram_id: telegramId,
      joiner_username: username,
      joiner_photo_url: photoUrl || null,
      joiner_choice: choice,
      joined_at: now.toISOString(),
      reveal_at: revealAt.toISOString(),
      house_fee: outcome === "draw" ? 0 : houseFee,
      pot_after_fee: outcome === "draw" ? total : potAfterFee,
      winner_telegram_id: winnerTelegramId,
    })
    .eq("id", roomId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (claimErr || !claimed) {
    // refund joiner
    try {
      await creditBalance(telegramId, amount, "refund", {
        game: "rps",
        room_id: roomId,
        reason: "join_race",
      });
    } catch {}
    throw new Error("Room was taken by someone else");
  }

  // Payouts happen at reveal (finishRoom) so animation can run first
  // Schedule is client-driven via /api/rps/state which finalizes when reveal_at passed

  return {
    balance,
    room: publicRoom(claimed as RpsRoomRow, telegramId),
  };
}

/**
 * Finalize a playing room after reveal_at — credits winner / refunds draw.
 * Idempotent via status playing → finished.
 */
export async function finishRoom(roomId: string): Promise<RpsRoomRow | null> {
  const db = getAdminClient();

  const { data: room } = await db
    .from("rps_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return null;
  const r = room as RpsRoomRow;
  if (r.status !== "playing") return r;
  if (r.reveal_at && new Date(r.reveal_at).getTime() > Date.now() + 500) {
    return r; // too early
  }

  const { data: claimed, error } = await db
    .from("rps_rooms")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "playing")
    .select("*")
    .maybeSingle();

  if (error || !claimed) {
    // already finished by another process
    const { data: again } = await db
      .from("rps_rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();
    return (again as RpsRoomRow) || null;
  }

  const finished = claimed as RpsRoomRow;
  const amount = Number(finished.amount);
  const potAfterFee = Number(finished.pot_after_fee || 0);
  const houseFee = Number(finished.house_fee || 0);
  const creatorId = finished.creator_telegram_id;
  const joinerId = finished.joiner_telegram_id!;
  const winnerId = finished.winner_telegram_id;

  if (winnerId == null) {
    // Draw — full refund both
    await creditBalance(creatorId, amount, "refund", {
      game: "rps",
      room_id: roomId,
      result: "draw",
    });
    await creditBalance(joinerId, amount, "refund", {
      game: "rps",
      room_id: roomId,
      result: "draw",
    });
  } else {
    await creditBalance(winnerId, potAfterFee, "win", {
      game: "rps",
      room_id: roomId,
      house_fee: houseFee,
    });
    try {
      await creditHouse(houseFee, "profit", "house_fee", {
        game: "rps",
        room_id: roomId,
      });
    } catch {}
  }

  // History for both players
  const creatorChoice = finished.creator_choice;
  const joinerChoice = finished.joiner_choice!;

  const rows = [
    {
      room_id: roomId,
      telegram_id: creatorId,
      opponent: finished.joiner_username || "Opponent",
      my_choice: creatorChoice,
      opponent_choice: joinerChoice,
      amount,
      result:
        winnerId == null
          ? "draw"
          : winnerId === creatorId
            ? "win"
            : "lose",
      payout:
        winnerId == null
          ? amount
          : winnerId === creatorId
            ? potAfterFee
            : 0,
      server_seed: finished.server_seed,
      server_seed_hash: finished.server_seed_hash,
      creator_choice_hash: finished.creator_choice_hash,
    },
    {
      room_id: roomId,
      telegram_id: joinerId,
      opponent: finished.creator_username,
      my_choice: joinerChoice,
      opponent_choice: creatorChoice,
      amount,
      result:
        winnerId == null
          ? "draw"
          : winnerId === joinerId
            ? "win"
            : "lose",
      payout:
        winnerId == null
          ? amount
          : winnerId === joinerId
            ? potAfterFee
            : 0,
      server_seed: finished.server_seed,
      server_seed_hash: finished.server_seed_hash,
      creator_choice_hash: finished.creator_choice_hash,
    },
  ];

  await db.from("rps_history").insert(rows);

  try {
    await recordWinStats(creatorId, potAfterFee, winnerId === creatorId);
    await recordWinStats(joinerId, potAfterFee, winnerId === joinerId);
  } catch {}

  return finished;
}

export async function getRoomState(
  roomId: string,
  viewerTelegramId?: number | null
) {
  const db = getAdminClient();
  const { data } = await db
    .from("rps_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (!data) return null;

  let room = data as RpsRoomRow;
  if (
    room.status === "playing" &&
    room.reveal_at &&
    new Date(room.reveal_at).getTime() <= Date.now()
  ) {
    const finished = await finishRoom(roomId);
    if (finished) room = finished;
  }

  return publicRoom(room, viewerTelegramId);
}

export async function getMyActiveRoom(telegramId: number) {
  const db = getAdminClient();
  const { data: asCreator } = await db
    .from("rps_rooms")
    .select("*")
    .eq("creator_telegram_id", telegramId)
    .in("status", ["open", "playing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (asCreator) {
    let room = asCreator as RpsRoomRow;
    if (
      room.status === "playing" &&
      room.reveal_at &&
      new Date(room.reveal_at).getTime() <= Date.now()
    ) {
      const f = await finishRoom(room.id);
      if (f) room = f;
    }
    return publicRoom(room, telegramId);
  }

  const { data: asJoiner } = await db
    .from("rps_rooms")
    .select("*")
    .eq("joiner_telegram_id", telegramId)
    .eq("status", "playing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (asJoiner) {
    let room = asJoiner as RpsRoomRow;
    if (
      room.reveal_at &&
      new Date(room.reveal_at).getTime() <= Date.now()
    ) {
      const f = await finishRoom(room.id);
      if (f) room = f;
    }
    return publicRoom(room, telegramId);
  }

  return null;
}

export async function getRpsHistory(telegramId: number, limit = 30) {
  const db = getAdminClient();
  const { data, error } = await db
    .from("rps_history")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

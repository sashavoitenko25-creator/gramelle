import crypto from "crypto";
import { getAdminClient } from "./supabase";
import { creditBalance, recordWinStats } from "./ledger";
import { creditHouse } from "./house";
import { payReferralFromHouseFee } from "./referral";
import {
  RACE_BUY_LOCK_SEC,
  RACE_COUNTDOWN_SEC,
  RACE_HOUSE_EDGE,
  RACE_MAPS,
  RACE_MAX_BALLS_PER_PLAYER,
  RACE_MAX_BALLS_TOTAL,
  RACE_MIN_BALL,
  RACE_MIN_PLAYERS,
  RACE_OPEN_STALE_MIN,
} from "@/lib/raceConstants";

export type RaceStatus = "open" | "countdown" | "racing" | "finished" | "cancelled";

export type RaceRoomRow = {
  id: string;
  status: RaceStatus;
  host_telegram_id: number;
  ball_price: number;
  pot: number;
  server_seed: string;
  server_seed_hash: string;
  countdown_ends_at: string | null;
  buy_locked: boolean;
  winner_telegram_id: number | null;
  winner_ball_id: string | null;
  house_fee: number | null;
  finish_order: string[] | null;
  map_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  game_no?: number | null;
};

export type RaceBallRow = {
  id: string;
  room_id: string;
  telegram_id: number;
  username: string;
  photo_url: string | null;
  color: string;
  seat: number;
  finish_rank: number | null;
  created_at: string;
};

const BALL_COLORS = [
  "#22d3ee",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#60a5fa",
  "#c084fc",
  "#2dd4bf",
  "#f97316",
];

function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function randomSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

function mapFromSeed(serverSeed: string, roomId: string): string {
  const h = crypto.createHmac("sha256", serverSeed).update(`map:${roomId}`).digest();
  const idx = h[0] % RACE_MAPS.length;
  return RACE_MAPS[idx].id;
}

/** Lower score = faster finish (deterministic) */
export function ballFinishScore(
  serverSeed: string,
  roomId: string,
  ballId: string
): number {
  const h = crypto
    .createHmac("sha256", serverSeed)
    .update(`${roomId}:${ballId}`)
    .digest();
  // 0..1
  return h.readUInt32BE(0) / 0xffffffff;
}

function publicRoom(
  room: RaceRoomRow,
  balls: RaceBallRow[],
  viewerId?: number | null
) {
  const revealed = room.status === "finished" || room.status === "cancelled";
  const uniquePlayers = new Set(balls.map((b) => b.telegram_id)).size;
  const myBalls = viewerId
    ? balls.filter((b) => b.telegram_id === viewerId)
    : [];
  const now = Date.now();
  const endsAt = room.countdown_ends_at
    ? new Date(room.countdown_ends_at).getTime()
    : null;
  const secsLeft =
    endsAt != null ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;
  const canBuy =
    (room.status === "open" || room.status === "countdown") &&
    !room.buy_locked &&
    (secsLeft == null || secsLeft > RACE_BUY_LOCK_SEC) &&
    balls.length < RACE_MAX_BALLS_TOTAL;

  return {
    id: room.id,
    status: room.status,
    hostTelegramId: room.host_telegram_id,
    ballPrice: Number(room.ball_price),
    pot: Number(room.pot),
    serverSeedHash: room.server_seed_hash,
    serverSeed: revealed ? room.server_seed : null,
    countdownEndsAt: room.countdown_ends_at,
    secsLeft,
    buyLocked: room.buy_locked || !canBuy,
    canBuy,
    winnerTelegramId: room.winner_telegram_id,
    winnerBallId: room.winner_ball_id,
    houseFee: room.house_fee != null ? Number(room.house_fee) : null,
    finishOrder: revealed ? room.finish_order : null,
    mapId: room.map_id || (revealed || room.status === "racing" || room.status === "countdown"
      ? mapFromSeed(room.server_seed, room.id)
      : null),
    gameNo: room.game_no != null ? Number(room.game_no) : null,
    createdAt: room.created_at,
    startedAt: room.started_at,
    finishedAt: room.finished_at,
    uniquePlayers,
    ballCount: balls.length,
    balls: balls.map((b) => ({
      id: b.id,
      telegramId: b.telegram_id,
      username: b.username,
      photoUrl: b.photo_url,
      color: b.color,
      seat: b.seat,
      finishRank: revealed ? b.finish_rank : null,
      isMine: viewerId === b.telegram_id,
    })),
    myBallCount: myBalls.length,
    isHost: viewerId === room.host_telegram_id,
  };
}

async function loadRoom(id: string): Promise<RaceRoomRow> {
  const { data, error } = await getAdminClient()
    .from("race_rooms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Race not found");
  return data as RaceRoomRow;
}

async function loadBalls(roomId: string): Promise<RaceBallRow[]> {
  const { data, error } = await getAdminClient()
    .from("race_balls")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as RaceBallRow[];
}

async function nextGameNo(): Promise<number | null> {
  try {
    const { data } = await getAdminClient()
      .from("race_rooms")
      .select("game_no")
      .not("game_no", "is", null)
      .order("game_no", { ascending: false })
      .limit(1);
    const n = data?.[0]?.game_no;
    return n != null ? Number(n) + 1 : 1;
  } catch {
    return null;
  }
}

/** Promote open → countdown when ≥2 unique players */
async function maybeStartCountdown(roomId: string) {
  const room = await loadRoom(roomId);
  if (room.status !== "open") return room;
  const balls = await loadBalls(roomId);
  const unique = new Set(balls.map((b) => b.telegram_id)).size;
  if (unique < RACE_MIN_PLAYERS) return room;

  const ends = new Date(Date.now() + RACE_COUNTDOWN_SEC * 1000).toISOString();
  const { data } = await getAdminClient()
    .from("race_rooms")
    .update({
      status: "countdown",
      countdown_ends_at: ends,
    })
    .eq("id", roomId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();
  return (data as RaceRoomRow) || room;
}

async function lockBuysIfNeeded(room: RaceRoomRow): Promise<RaceRoomRow> {
  if (room.status !== "countdown" || !room.countdown_ends_at || room.buy_locked)
    return room;
  const left =
    (new Date(room.countdown_ends_at).getTime() - Date.now()) / 1000;
  if (left > RACE_BUY_LOCK_SEC) return room;
  const { data } = await getAdminClient()
    .from("race_rooms")
    .update({ buy_locked: true })
    .eq("id", room.id)
    .eq("status", "countdown")
    .select("*")
    .maybeSingle();
  return (data as RaceRoomRow) || { ...room, buy_locked: true };
}

export async function listRaces(viewerId?: number | null) {
  const db = getAdminClient();
  const { data: rooms } = await db
    .from("race_rooms")
    .select("*")
    .in("status", ["open", "countdown", "racing"])
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: recent } = await db
    .from("race_rooms")
    .select("*")
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(12);

  const all = [...(rooms || []), ...(recent || [])] as RaceRoomRow[];
  const ids = all.map((r) => r.id);
  const ballsByRoom = new Map<string, RaceBallRow[]>();
  if (ids.length) {
    const { data: balls } = await db
      .from("race_balls")
      .select("*")
      .in("room_id", ids);
    for (const b of (balls || []) as RaceBallRow[]) {
      const arr = ballsByRoom.get(b.room_id) || [];
      arr.push(b);
      ballsByRoom.set(b.room_id, arr);
    }
  }

  let mine = null as ReturnType<typeof publicRoom> | null;
  const live = [];
  for (const r of (rooms || []) as RaceRoomRow[]) {
    const balls = ballsByRoom.get(r.id) || [];
    const pub = publicRoom(r, balls, viewerId);
    live.push(pub);
    if (
      viewerId &&
      balls.some((b) => b.telegram_id === viewerId) &&
      !mine
    ) {
      mine = pub;
    }
  }

  const recentPub = ((recent || []) as RaceRoomRow[]).map((r) =>
    publicRoom(r, ballsByRoom.get(r.id) || [], viewerId)
  );

  return { rooms: live, recent: recentPub, mine };
}


/** Single global live race: current open/countdown/racing, or null */
export async function getActiveRace(viewerId?: number | null) {
  await processStale().catch(() => {});
  const db = getAdminClient();
  const { data: live } = await db
    .from("race_rooms")
    .select("*")
    .in("status", ["open", "countdown", "racing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (live) {
    let room = live as RaceRoomRow;
    room = await lockBuysIfNeeded(room);
    if (
      room.status === "countdown" &&
      room.countdown_ends_at &&
      new Date(room.countdown_ends_at).getTime() <= Date.now()
    ) {
      try {
        await runRace(room.id);
        room = await loadRoom(room.id);
      } catch {
        room = await loadRoom(room.id);
      }
    }
    const balls = await loadBalls(room.id);
    return { room: publicRoom(room, balls, viewerId) };
  }
  // last finished for spectators
  const { data: last } = await db
    .from("race_rooms")
    .select("*")
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last) {
    const balls = await loadBalls(last.id);
    return { room: publicRoom(last as RaceRoomRow, balls, viewerId), idle: true };
  }
  return { room: null };
}

export async function getRaceState(roomId: string, viewerId?: number | null) {
  let room = await loadRoom(roomId);
  room = await lockBuysIfNeeded(room);
  // Auto-run race when countdown elapsed
  if (
    room.status === "countdown" &&
    room.countdown_ends_at &&
    new Date(room.countdown_ends_at).getTime() <= Date.now()
  ) {
    try {
      await runRace(roomId);
      room = await loadRoom(roomId);
    } catch {
      /* concurrent */
      room = await loadRoom(roomId);
    }
  }
  const balls = await loadBalls(roomId);
  return publicRoom(room, balls, viewerId);
}

export async function createRace(opts: {
  telegramId: number;
  username: string;
  photoUrl?: string | null;
  ballPrice?: number;
}) {
  const price = opts.ballPrice ?? RACE_MIN_BALL;
  if (!Number.isFinite(price) || price < RACE_MIN_BALL) {
    throw new Error(`Min ball ${RACE_MIN_BALL} GRAM`);
  }

  const db = getAdminClient();
  // already in live race?
  const { data: myBalls } = await db
    .from("race_balls")
    .select("room_id")
    .eq("telegram_id", opts.telegramId)
    .limit(40);
  const roomIds = [...new Set((myBalls || []).map((b: { room_id: string }) => b.room_id))];
  if (roomIds.length) {
    const { data: live } = await db
      .from("race_rooms")
      .select("id")
      .in("id", roomIds)
      .in("status", ["open", "countdown", "racing"]);
    if (live?.length) throw new Error("Finish your current Race first");
  }

  const { balance } = await creditBalance(opts.telegramId, -price, "bet", {
    game: "race",
    action: "create",
  });

  const serverSeed = randomSeed();
  const { data: room, error } = await db
    .from("race_rooms")
    .insert({
      status: "open",
      host_telegram_id: opts.telegramId,
      ball_price: price,
      pot: price,
      server_seed: serverSeed,
      server_seed_hash: hashSeed(serverSeed),
      countdown_ends_at: null,
      buy_locked: false,
    } as Record<string, unknown>)
    .select("*")
    .single();

  if (error || !room) {
    try {
      await creditBalance(opts.telegramId, price, "refund", {
        game: "race",
        reason: "create_failed",
      });
    } catch {
      /* */
    }
    throw error || new Error("Create failed");
  }

  const color = BALL_COLORS[0];
  const { data: ball, error: bErr } = await db
    .from("race_balls")
    .insert({
      room_id: room.id,
      telegram_id: opts.telegramId,
      username: opts.username,
      photo_url: opts.photoUrl || null,
      color,
      seat: 0,
    })
    .select("*")
    .single();

  if (bErr || !ball) {
    await db.from("race_rooms").delete().eq("id", room.id);
    try {
      await creditBalance(opts.telegramId, price, "refund", {
        game: "race",
        reason: "ball_failed",
      });
    } catch {
      /* */
    }
    throw bErr || new Error("Ball failed");
  }

  const balls = await loadBalls(room.id);
  return {
    balance,
    room: publicRoom(room as RaceRoomRow, balls, opts.telegramId),
  };
}

export async function buyBall(opts: {
  telegramId: number;
  username: string;
  photoUrl?: string | null;
  roomId: string;
  count?: number;
}) {
  const count = Math.min(10, Math.max(1, Math.floor(opts.count || 1)));
  let room = await loadRoom(opts.roomId);
  room = await lockBuysIfNeeded(room);

  if (room.status !== "open" && room.status !== "countdown") {
    throw new Error("Race is closed for buys");
  }
  if (room.buy_locked) throw new Error("Buys locked — race starting soon");

  if (room.countdown_ends_at) {
    const left =
      (new Date(room.countdown_ends_at).getTime() - Date.now()) / 1000;
    if (left <= RACE_BUY_LOCK_SEC) {
      await getAdminClient()
        .from("race_rooms")
        .update({ buy_locked: true })
        .eq("id", room.id);
      throw new Error("Buys locked — race starting soon");
    }
  }

  const balls = await loadBalls(opts.roomId);
  if (balls.length + count > RACE_MAX_BALLS_TOTAL) {
    throw new Error("Race is full");
  }
  const mine = balls.filter((b) => b.telegram_id === opts.telegramId).length;
  if (mine + count > RACE_MAX_BALLS_PER_PLAYER) {
    throw new Error(`Max ${RACE_MAX_BALLS_PER_PLAYER} balls per player`);
  }

  const price = Number(room.ball_price);
  const total = +(price * count).toFixed(6);
  const { balance } = await creditBalance(opts.telegramId, -total, "bet", {
    game: "race",
    room_id: opts.roomId,
    action: "buy",
    count,
  });

  const inserts = [];
  for (let i = 0; i < count; i++) {
    const seat = balls.length + i;
    inserts.push({
      room_id: opts.roomId,
      telegram_id: opts.telegramId,
      username: opts.username,
      photo_url: opts.photoUrl || null,
      color: BALL_COLORS[seat % BALL_COLORS.length],
      seat,
    });
  }

  const { error: insErr } = await getAdminClient()
    .from("race_balls")
    .insert(inserts);
  if (insErr) {
    try {
      await creditBalance(opts.telegramId, total, "refund", {
        game: "race",
        reason: "buy_failed",
      });
    } catch {
      /* */
    }
    throw insErr;
  }

  await getAdminClient()
    .from("race_rooms")
    .update({ pot: +(Number(room.pot) + total).toFixed(6) })
    .eq("id", opts.roomId);

  room = await maybeStartCountdown(opts.roomId);
  const allBalls = await loadBalls(opts.roomId);
  return {
    balance,
    room: publicRoom(room, allBalls, opts.telegramId),
  };
}

export async function runRace(roomId: string) {
  const db = getAdminClient();
  const room = await loadRoom(roomId);
  if (room.status === "finished" || room.status === "cancelled") {
    return publicRoom(room, await loadBalls(roomId));
  }
  if (room.status !== "countdown" && room.status !== "racing") {
    // allow process from countdown only primarily
    if (room.status === "open") throw new Error("Need more players");
  }

  if (
    room.status === "countdown" &&
    room.countdown_ends_at &&
    new Date(room.countdown_ends_at).getTime() > Date.now() + 200
  ) {
    throw new Error("Countdown not finished");
  }

  const mapId = mapFromSeed(room.server_seed, roomId);
  const { data: claimed } = await db
    .from("race_rooms")
    .update({
      status: "racing",
      buy_locked: true,
      started_at: new Date().toISOString(),
      map_id: mapId,
    })
    .eq("id", roomId)
    .in("status", ["countdown", "racing"])
    .select("*")
    .maybeSingle();

  if (!claimed) {
    const again = await loadRoom(roomId);
    return publicRoom(again, await loadBalls(roomId));
  }

  const balls = await loadBalls(roomId);
  if (balls.length === 0) throw new Error("No balls");

  const scored = balls
    .map((b) => ({
      ball: b,
      score: ballFinishScore(claimed.server_seed, roomId, b.id),
    }))
    .sort((a, b) => a.score - b.score || a.ball.seat - b.ball.seat);

  const finishOrder = scored.map((s) => s.ball.id);
  const winnerBall = scored[0].ball;
  const pot = Number(claimed.pot);
  const houseFee = +(pot * RACE_HOUSE_EDGE).toFixed(6);
  const payout = +(pot - houseFee).toFixed(6);
  const gameNo = await nextGameNo();

  for (let i = 0; i < scored.length; i++) {
    await db
      .from("race_balls")
      .update({ finish_rank: i + 1 })
      .eq("id", scored[i].ball.id);
  }

  const { data: finished } = await db
    .from("race_rooms")
    .update({
      status: "finished",
      winner_telegram_id: winnerBall.telegram_id,
      winner_ball_id: winnerBall.id,
      house_fee: houseFee,
      finish_order: finishOrder,
      finished_at: new Date().toISOString(),
      game_no: gameNo,
    })
    .eq("id", roomId)
    .eq("status", "racing")
    .select("*")
    .maybeSingle();

  if (finished) {
    await creditBalance(winnerBall.telegram_id, payout, "win", {
      game: "race",
      room_id: roomId,
      house_fee: houseFee,
      ball_id: winnerBall.id,
    });
    try {
      await recordWinStats(winnerBall.telegram_id, payout, true);
    } catch {
      /* */
    }
    try {
      await creditHouse(houseFee, "profit", "house_fee", {
        game: "race",
        room_id: roomId,
      });
    } catch {
      /* */
    }
    if (houseFee > 0) {
      // split referral share across unique players by ball count
      const byPlayer = new Map<number, number>();
      for (const b of balls) {
        byPlayer.set(b.telegram_id, (byPlayer.get(b.telegram_id) || 0) + 1);
      }
      const totalBalls = balls.length;
      for (const [tid, n] of byPlayer) {
        const slice = +((houseFee * n) / totalBalls).toFixed(6);
        if (slice > 0) {
          try {
            await payReferralFromHouseFee(tid, Number(claimed.ball_price) * n, slice);
          } catch {
            /* */
          }
        }
      }
    }
  }

  const finalRoom = (finished as RaceRoomRow) || (await loadRoom(roomId));
  const finalBalls = await loadBalls(roomId);
  return publicRoom(finalRoom, finalBalls);
}

export async function cancelRace(opts: {
  telegramId: number;
  roomId: string;
}) {
  const room = await loadRoom(opts.roomId);
  if (room.host_telegram_id !== opts.telegramId) {
    throw new Error("Only host can cancel");
  }
  if (room.status !== "open") {
    throw new Error("Can only cancel before countdown");
  }
  const balls = await loadBalls(opts.roomId);
  const unique = new Set(balls.map((b) => b.telegram_id));
  if (unique.size > 1) throw new Error("Others already joined");

  const { data: cancelled } = await getAdminClient()
    .from("race_rooms")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
    })
    .eq("id", opts.roomId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (!cancelled) throw new Error("Cancel failed");

  const price = Number(room.ball_price);
  for (const b of balls) {
    try {
      await creditBalance(b.telegram_id, price, "refund", {
        game: "race",
        room_id: opts.roomId,
        reason: "cancel",
      });
    } catch {
      /* */
    }
  }

  return publicRoom(cancelled as RaceRoomRow, balls, opts.telegramId);
}

export async function processStale() {
  const db = getAdminClient();
  const now = Date.now();

  // finish expired countdowns
  const { data: ready } = await db
    .from("race_rooms")
    .select("id, countdown_ends_at")
    .eq("status", "countdown")
    .limit(20);
  for (const r of ready || []) {
    if (
      r.countdown_ends_at &&
      new Date(r.countdown_ends_at).getTime() <= now
    ) {
      try {
        await runRace(r.id);
      } catch {
        /* */
      }
    }
  }

  // cancel stale open solo rooms
  const staleBefore = new Date(
    now - RACE_OPEN_STALE_MIN * 60 * 1000
  ).toISOString();
  const { data: stale } = await db
    .from("race_rooms")
    .select("id")
    .eq("status", "open")
    .lt("created_at", staleBefore)
    .limit(10);
  for (const r of stale || []) {
    try {
      const room = await loadRoom(r.id);
      const balls = await loadBalls(r.id);
      await db
        .from("race_rooms")
        .update({
          status: "cancelled",
          finished_at: new Date().toISOString(),
        })
        .eq("id", r.id)
        .eq("status", "open");
      const price = Number(room.ball_price);
      for (const b of balls) {
        try {
          await creditBalance(b.telegram_id, price, "refund", {
            game: "race",
            room_id: r.id,
            reason: "stale",
          });
        } catch {
          /* */
        }
      }
    } catch {
      /* */
    }
  }
}

export async function raceHistory(telegramId: number, limit = 40) {
  const db = getAdminClient();
  const { data: myBalls } = await db
    .from("race_balls")
    .select("room_id")
    .eq("telegram_id", telegramId)
    .limit(100);
  const ids = [
    ...new Set((myBalls || []).map((b: { room_id: string }) => b.room_id)),
  ];
  if (!ids.length) return { items: [] };

  const { data: rooms } = await db
    .from("race_rooms")
    .select("*")
    .in("id", ids)
    .in("status", ["finished", "cancelled"])
    .order("finished_at", { ascending: false })
    .limit(limit);

  const items = [];
  for (const room of (rooms || []) as RaceRoomRow[]) {
    const balls = await loadBalls(room.id);
    const mine = balls.filter((b) => b.telegram_id === telegramId);
    const won = room.winner_telegram_id === telegramId;
    const spent = mine.length * Number(room.ball_price);
    const payout =
      won && room.house_fee != null
        ? +(Number(room.pot) - Number(room.house_fee)).toFixed(6)
        : room.status === "cancelled"
          ? spent
          : 0;
    items.push({
      roomId: room.id,
      gameNo: room.game_no,
      status: room.status,
      ballPrice: Number(room.ball_price),
      myBalls: mine.length,
      pot: Number(room.pot),
      won,
      payout,
      spent,
      serverSeedHash: room.server_seed_hash,
      serverSeed: room.server_seed,
      finishedAt: room.finished_at,
      result: room.status === "cancelled" ? "cancel" : won ? "win" : "lose",
    });
  }
  return { items };
}

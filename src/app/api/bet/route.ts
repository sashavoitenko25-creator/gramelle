import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { placeBet } from "@/lib/server/round";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { COLORS, DEFAULT_ROOM, ROOMS, type RoomMode } from "@/lib/constants";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertNotBanned } from "@/lib/server/ban";
import { captureException } from "@/lib/server/sentry";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const auth = await requireTelegramUser(req);

    const rl = rateLimit(`bet:${auth.user.id}`, 30, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many bets — slow down" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    await assertNotBanned(auth.user.id);

    const body = await req.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const mode = (body.mode as RoomMode) || DEFAULT_ROOM;
    if (!ROOMS[mode]) {
      return NextResponse.json({ error: "Invalid room" }, { status: 400 });
    }

    const username =
      auth.user.username ||
      auth.user.first_name ||
      "Player" + String(auth.user.id).slice(-4);

    const color =
      typeof body.color === "string" && body.color
        ? body.color
        : COLORS[Math.floor(Math.random() * COLORS.length)];

    const result = await placeBet({
      telegramId: auth.user.id,
      username,
      amount,
      color,
      mode,
    });

    return NextResponse.json({
      ok: true,
      balance: result.balance,
      round: {
        id: result.round.id,
        rollId: result.round.roll_id,
        mode: result.round.mode || mode,
        status: result.round.status,
        totalBank: result.round.total_bank,
        countdownEndsAt: result.round.countdown_ends_at,
        serverSeedHash: result.round.server_seed_hash,
      },
      bets: result.bets.map((b) => ({
        telegramId: b.telegram_id,
        username: b.username,
        amount: Number(b.amount),
        color: b.color,
        isMe: b.telegram_id === auth.user.id,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    const msg = e instanceof Error ? e.message : "Bet failed";
    if (msg.toLowerCase().includes("banned")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    await captureException(e, { route: "bet" });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

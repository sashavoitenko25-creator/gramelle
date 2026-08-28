import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { spinRound, getOpenRound } from "@/lib/server/round";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { DEFAULT_ROOM, type RoomMode } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    await requireTelegramUser(req);
    const body = await req.json().catch(() => ({}));
    const mode = (body.mode as RoomMode) || DEFAULT_ROOM;

    const round = await getOpenRound(mode);
    if (!round) {
      return NextResponse.json({ error: "No open round" }, { status: 400 });
    }

    if (round.status === "countdown" && round.countdown_ends_at) {
      if (new Date(round.countdown_ends_at).getTime() > Date.now() + 800) {
        return NextResponse.json({ error: "Countdown not finished" }, { status: 400 });
      }
    }

    if (round.status === "open") {
      return NextResponse.json({ error: "Need 2+ players" }, { status: 400 });
    }

    const result = await spinRound(round.id, mode);

    return NextResponse.json({
      ok: true,
      spinDegrees: result.spinDegrees,
      mult: result.mult,
      houseFee: result.houseFee,
      potAfterFee: result.potAfterFee,
      winner: {
        telegramId: result.winner.telegram_id,
        username: result.winner.username,
        amount: Number(result.winner.amount),
      },
      total: result.round.total_bank,
      rollId: result.round.roll_id,
      serverSeed: result.round.server_seed,
      serverSeedHash: result.round.server_seed_hash,
      bets: result.bets.map((b) => ({
        telegramId: b.telegram_id,
        username: b.username,
        amount: Number(b.amount),
        color: b.color,
        photoUrl: b.photo_url || null,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Spin failed" },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { createRace } from "@/lib/server/race";
import { RACE_MIN_BALL } from "@/lib/raceConstants";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }
    const auth = await requireTelegramUser(req);
    const body = await req.json().catch(() => ({}));
    const ballPrice = Number(body.ballPrice ?? RACE_MIN_BALL);
    const data = await createRace({
      telegramId: auth.user.id,
      username: auth.user.username || auth.user.first_name || "Player",
      photoUrl: auth.user.photo_url || null,
      ballPrice,
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

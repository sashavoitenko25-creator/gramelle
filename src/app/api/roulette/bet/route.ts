import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { placeRouletteBet } from "@/lib/server/roulette";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertNotBanned } from "@/lib/server/ban";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
    }
    const auth = await requireTelegramUser(req);
    const rl = rateLimit(`roulette-bet:${auth.user.id}`, 40, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many bets" }, { status: 429 });
    }
    await assertNotBanned(auth.user.id);

    const body = await req.json();
    const amount = Number(body.amount);
    const color = body.color;
    const username =
      auth.user.username ||
      auth.user.first_name ||
      "Player" + String(auth.user.id).slice(-4);

    const result = await placeRouletteBet({
      telegramId: auth.user.id,
      username,
      color,
      amount,
    });

    return NextResponse.json({ ok: true, ...result });
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

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { placePvpRouletteBet } from "@/lib/server/pvpRoulette";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertNotBanned } from "@/lib/server/ban";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
    }
    const auth = await requireTelegramUser(req);

    const rl = rateLimit(`pvp-roulette-bet:${auth.user.id}`, 12, 10_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Слишком быстро — подождите" },
        { status: 429 }
      );
    }
    await assertNotBanned(auth.user.id);

    const body = await req.json();
    const amount = Number(body.amount);
    const username =
      auth.user.username ||
      auth.user.first_name ||
      "Player" + String(auth.user.id).slice(-4);
    const avatarUrl =
      (auth.user as { photo_url?: string }).photo_url ||
      body.avatarUrl ||
      null;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const result = await placePvpRouletteBet({
      telegramId: auth.user.id,
      username,
      avatarUrl,
      amount,
    });

    return NextResponse.json({
      ...result,
      balance: result.balance,
    });
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

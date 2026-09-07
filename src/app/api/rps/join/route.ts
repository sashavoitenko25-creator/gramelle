import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { joinRoom, isValidChoice } from "@/lib/server/rps";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertNotBanned } from "@/lib/server/ban";
import { captureException } from "@/lib/server/sentry";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
    }

    const auth = await requireTelegramUser(req);
    const rl = rateLimit(`rps-join:${auth.user.id}`, 20, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    }
    await assertNotBanned(auth.user.id);

    const body = await req.json();
    const roomId = String(body.roomId || "");
    const choice = body.choice;

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }
    if (!isValidChoice(choice)) {
      return NextResponse.json({ error: "Неверный выбор" }, { status: 400 });
    }

    const username =
      auth.user.username ||
      auth.user.first_name ||
      "Player" + String(auth.user.id).slice(-4);

    const result = await joinRoom({
      telegramId: auth.user.id,
      username,
      photoUrl: auth.user.photo_url || null,
      roomId,
      choice,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    const msg = e instanceof Error ? e.message : "Не удалось войти";
    if (msg.toLowerCase().includes("banned")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    await captureException(e, { route: "rps/join" });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

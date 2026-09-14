import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertNotBanned } from "@/lib/server/ban";
import { captureException } from "@/lib/server/sentry";
import * as dice from "@/lib/server/dice";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
    }
    const auth = await requireTelegramUser(req);
    const rl = rateLimit("dice-join:" + auth.user.id, 30, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    }
    await assertNotBanned(auth.user.id);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const username =
      auth.user.username ||
      auth.user.first_name ||
      "Player" + String(auth.user.id).slice(-4);
    const photoUrl = auth.user.photo_url || null;
    const telegramId = auth.user.id;

    let result: Record<string, unknown>;
    if ("join" === "create") {
      result = await dice.createTable({
        telegramId, username, photoUrl,
        amount: Number(body.amount),
        maxPlayers: Number(body.maxPlayers ?? 2),
      });
    } else if ("join" === "join") {
      result = await dice.joinTable({
        telegramId, username, photoUrl,
        roomId: String(body.roomId || ""),
      });
    } else if ("join" === "leave") {
      result = await dice.leaveTable({
        telegramId, roomId: String(body.roomId || ""),
      });
    } else if ("join" === "start") {
      result = await dice.startTable({
        telegramId, roomId: String(body.roomId || ""),
      });
    } else if ("join" === "roll") {
      result = await dice.rollDice({
        telegramId, roomId: String(body.roomId || ""),
      });
    } else {
      result = await dice.cancelTable({
        telegramId, roomId: String(body.roomId || ""),
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    const msg = e instanceof Error ? e.message : "Ошибка";
    if (msg.toLowerCase().includes("banned")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    await captureException(e, { route: "dice/join" });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { cancelRoom } from "@/lib/server/rps";
import { rateLimit } from "@/lib/server/rateLimit";
import { captureException } from "@/lib/server/sentry";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const auth = await requireTelegramUser(req);
    const rl = rateLimit(`rps-cancel:${auth.user.id}`, 20, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const roomId = String(body.roomId || "");
    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    const result = await cancelRoom({
      telegramId: auth.user.id,
      roomId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    await captureException(e, { route: "rps/cancel" });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cancel failed" },
      { status: 400 }
    );
  }
}

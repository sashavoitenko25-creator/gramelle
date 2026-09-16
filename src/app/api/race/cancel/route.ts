import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { cancelRace } from "@/lib/server/race";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }
    const auth = await requireTelegramUser(req);
    const body = await req.json().catch(() => ({}));
    const roomId = String(body.roomId || "");
    if (!roomId) {
      return NextResponse.json({ error: "roomId required" }, { status: 400 });
    }
    const room = await cancelRace({
      telegramId: auth.user.id,
      roomId,
    });
    return NextResponse.json({ ok: true, room });
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

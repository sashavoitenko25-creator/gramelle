import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { getRoomState } from "@/lib/server/rps";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const roomId = req.nextUrl.searchParams.get("id");
    if (!roomId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    let telegramId: number | null = null;
    try {
      const auth = await requireTelegramUser(req);
      telegramId = auth.user.id;
    } catch {
      // allow public poll
    }

    const room = await getRoomState(roomId, telegramId);
    if (!room) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, room });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

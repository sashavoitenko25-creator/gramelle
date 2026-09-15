import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { getRoomState } from "@/lib/server/xo";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }
    let viewerId: number | null = null;
    try {
      const auth = await requireTelegramUser(req);
      viewerId = auth.user.id;
    } catch {
      /* optional */
    }
    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const room = await getRoomState(id, viewerId);
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
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

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { makeMove } from "@/lib/server/xo";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertNotBanned } from "@/lib/server/ban";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }
    const auth = await requireTelegramUser(req);
    const rl = rateLimit(`xo-move:${auth.user.id}`, 60, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    await assertNotBanned(auth.user.id);
    const body = await req.json().catch(() => ({}));
    const roomId = String(body.roomId || "");
    const cell = Number(body.cell);
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
    const res = await makeMove({ telegramId: auth.user.id, roomId, cell });
    return NextResponse.json({ ok: true, ...res });
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

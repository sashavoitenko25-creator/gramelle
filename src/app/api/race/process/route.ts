import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { processStale, runRace } from "@/lib/server/race";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }
    const body = await req.json().catch(() => ({}));
    const roomId = body.roomId ? String(body.roomId) : null;
    if (roomId) {
      const room = await runRace(roomId);
      return NextResponse.json({ ok: true, room });
    }
    await processStale();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { listBundle } from "@/lib/server/xo";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ rooms: [], recent: [], mine: null, demo: true });
    }
    let viewerId: number | null = null;
    try {
      const auth = await requireTelegramUser(req);
      viewerId = auth.user.id;
    } catch {
      /* public list ok without auth in demo */
    }
    const data = await listBundle(viewerId);
    return NextResponse.json({ ok: true, ...data });
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

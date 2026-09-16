import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { raceHistory } from "@/lib/server/race";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ items: [], demo: true });
    }
    const auth = await requireTelegramUser(req);
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 40), 80);
    const data = await raceHistory(auth.user.id, limit);
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

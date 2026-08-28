import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { getRpsHistory } from "@/lib/server/rps";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ items: [], demo: true });
    }

    const auth = await requireTelegramUser(req);
    const limit = Math.min(
      50,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 30))
    );
    const items = await getRpsHistory(auth.user.id, limit);
    return NextResponse.json({ ok: true, items });
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

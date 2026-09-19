import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { getRecentHistory } from "@/lib/server/pvpRoulette";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
    }
    const limit = Math.min(
      50,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 20))
    );
    const history = await getRecentHistory(limit);
    return NextResponse.json({ ok: true, history });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

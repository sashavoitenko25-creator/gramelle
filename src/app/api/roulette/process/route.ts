import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { advanceRoulette, getRouletteState } from "@/lib/server/roulette";

/** Optional cron/heartbeat — clients also advance via /state */
export async function POST() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
    }
    await advanceRoulette();
    const data = await getRouletteState(null);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

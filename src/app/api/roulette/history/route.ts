import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { getRouletteHistory } from "@/lib/server/roulette";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
    }
    const data = await getRouletteHistory(40);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

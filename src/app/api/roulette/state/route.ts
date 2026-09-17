import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { getRouletteState } from "@/lib/server/roulette";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
    }
    let telegramId: number | null = null;
    try {
      const auth = await requireTelegramUser(req);
      telegramId = auth.user.id;
    } catch {
      /* public */
    }
    // Only count as "online" when client is actually in the game (?presence=1)
    const touchPresence =
      req.nextUrl.searchParams.get("presence") === "1" ||
      req.nextUrl.searchParams.get("presence") === "true";
    const data = await getRouletteState(telegramId, { touchPresence });
    return NextResponse.json(
      { ok: true, ...data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[roulette/state]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

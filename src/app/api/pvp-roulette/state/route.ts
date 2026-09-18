import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { getPvpRouletteState } from "@/lib/server/pvpRoulette";

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
      /* optional auth for spectators */
    }

    const presence = req.nextUrl.searchParams.get("presence") === "1";
    const state = await getPvpRouletteState({
      telegramId,
      presence: presence && !!telegramId,
    });

    return NextResponse.json(state, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
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

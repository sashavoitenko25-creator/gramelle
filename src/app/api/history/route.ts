import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

/**
 * Personal game history for the authenticated Telegram user.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ items: [], demo: true });
    }

    const auth = await requireTelegramUser(req);
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 40), 80);
    const db = getAdminClient();

    const { data, error } = await db
      .from("game_history")
      .select("roll_id, winner, chance, win_amount, mult, bet, telegram_id, is_me, created_at")
      .eq("telegram_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const items = (data || []).map((h) => {
      const winner = String(h.winner || "");
      const iWon = Boolean(h.is_me);
      return {
        id: Number(h.roll_id),
        winner: iWon ? "You" : winner,
        chance: Number(h.chance || 0),
        win: Number(h.win_amount || 0),
        mult: Number(h.mult || 0),
        bet: Number(h.bet || 0),
        time: h.created_at as string,
        isMe: true,
        iWon,
        telegramId: Number(h.telegram_id),
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { items: [], error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

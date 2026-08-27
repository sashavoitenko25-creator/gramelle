import { NextRequest, NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/lib/server/admin";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { trackEvent } from "@/lib/server/sentry";

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "No DB" }, { status: 503 });
    }
    const body = await req.json();
    const telegramId = Number(body.telegram_id);
    const banned = Boolean(body.banned);
    const reason = body.reason ? String(body.reason) : null;

    if (!telegramId) {
      return NextResponse.json({ error: "telegram_id required" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data, error } = await db
      .from("profiles")
      .update({
        banned,
        ban_reason: banned ? reason || "Banned by admin" : null,
        banned_at: banned ? new Date().toISOString() : null,
      })
      .eq("telegram_id", telegramId)
      .select("id, telegram_id, username, banned")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    await trackEvent(banned ? "player_banned" : "player_unbanned", {
      telegram_id: telegramId,
    });

    return NextResponse.json({ ok: true, player: data });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

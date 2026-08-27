import { NextRequest, NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/lib/server/admin";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "No DB" }, { status: 503 });
    }
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const db = getAdminClient();
    let query = db
      .from("profiles")
      .select(
        "id, username, telegram_id, balance, ref_count, ref_earned, banned, ban_reason, wins, games, biggest_win, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (q) {
      if (/^\d+$/.test(q)) {
        query = query.eq("telegram_id", Number(q));
      } else {
        query = query.ilike("username", `%${q}%`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

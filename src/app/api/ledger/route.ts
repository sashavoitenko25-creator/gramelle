import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ items: [], demo: true });
    }
    const auth = await requireTelegramUser(req);
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 100);
    const db = getAdminClient();
    const { data, error } = await db
      .from("ledger")
      .select("id, amount, balance_after, reason, meta, created_at")
      .eq("telegram_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
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

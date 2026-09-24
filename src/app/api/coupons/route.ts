import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    const auth = await requireTelegramUser(req);
    const db = getAdminClient();
    const { data, error } = await db.from("coupons")
      .select("id,amount,game,status,created_at,used_at,used_game,expires_at,promo_codes(code)")
      .eq("telegram_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const coupons = (data || []).map((c: any) => ({
      ...c,
      promo_code: c.promo_codes?.code || null,
      promo_codes: undefined,
    }));
    const active = coupons.filter((c: any) => c.status === "active" && (!c.expires_at || new Date(c.expires_at).getTime() > Date.now()));
    return NextResponse.json({
      ok: true,
      coupons: active,
      count: active.length,
      total: active.reduce((s: number, c: any) => s + Number(c.amount || 0), 0),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

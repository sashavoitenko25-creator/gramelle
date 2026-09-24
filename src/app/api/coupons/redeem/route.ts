import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    const auth = await requireTelegramUser(req);
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,64}$/.test(code)) return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
    const { data, error } = await getAdminClient().rpc("redeem_promo", {
      p_telegram_id: auth.user.id, p_code: code
    });
    if (error) throw new Error(error.message || "Promo redemption failed");
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

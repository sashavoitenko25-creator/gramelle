import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { getOrCreateProfile } from "@/lib/server/ledger";

/** Save TON Connect wallet address on profile */
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, demo: true });
    }
    const auth = await requireTelegramUser(req);
    const body = await req.json();
    const address = String(body.address || "").trim();
    if (!address || address.length < 20) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    await getOrCreateProfile(auth.user.id);
    const db = getAdminClient();
    await db
      .from("profiles")
      .update({ ton_wallet: address })
      .eq("telegram_id", auth.user.id);
    return NextResponse.json({ ok: true, address });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

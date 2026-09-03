import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { buildTonMemo, gramFromTon } from "@/lib/payments";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertNotBanned } from "@/lib/server/ban";
import { MIN_DEPOSIT_TON, MAX_DEPOSIT_TON, TON_PENDING_TTL_SEC } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }
    const auth = await requireTelegramUser(req);
    const rl = rateLimit(`ton:${auth.user.id}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    await assertNotBanned(auth.user.id);

    const body = await req.json();
    const ton = Number(body.ton);
    if (!Number.isFinite(ton) || ton < MIN_DEPOSIT_TON || ton > MAX_DEPOSIT_TON) {
      return NextResponse.json(
        { error: `Deposit must be between ${MIN_DEPOSIT_TON} and ${MAX_DEPOSIT_TON} TON` },
        { status: 400 }
      );
    }

    const username = auth.user.username || auth.user.first_name || String(auth.user.id);
    const memo = buildTonMemo(auth.user.id, username);
    const gram = gramFromTon(ton);
    const expiresAt = new Date(Date.now() + TON_PENDING_TTL_SEC * 1000).toISOString();

    const db = getAdminClient();
    const { data, error } = await db
      .from("ton_deposits")
      .insert({
        telegram_id: auth.user.id,
        memo,
        amount_ton: ton,
        amount_gram: gram,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("id, memo, amount_ton, amount_gram, expires_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, deposit: data, memo, gram, expiresAt });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

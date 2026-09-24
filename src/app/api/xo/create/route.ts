import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { createRoom, isValidSymbol } from "@/lib/server/xo";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertNotBanned } from "@/lib/server/ban";
import { captureException } from "@/lib/server/sentry";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }
    const auth = await requireTelegramUser(req);
    const rl = rateLimit(`xo-create:${auth.user.id}`, 15, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    await assertNotBanned(auth.user.id);
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const symbol = body.symbol === "O" ? "O" : "X";
    const couponId = body.couponId ? String(body.couponId) : undefined;
    if (!isValidSymbol(symbol)) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    }
    const res = await createRoom({
      telegramId: auth.user.id,
      username: auth.user.username || auth.user.first_name || "Player",
      photoUrl: auth.user.photo_url || null,
      amount,
      symbol,
      couponId,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    captureException(e);
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

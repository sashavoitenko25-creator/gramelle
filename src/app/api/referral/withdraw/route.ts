import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { assertNotBanned } from "@/lib/server/ban";
import { withdrawReferralSavings } from "@/lib/server/referral";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { REFERRAL_MIN_WITHDRAW } from "@/lib/constants";

/**
 * POST { amount?: number } — move referral savings → main balance.
 * Omit amount to withdraw all (if >= min).
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const auth = await requireTelegramUser(req);
    await assertNotBanned(auth.user.id);
    let amount: number | undefined;
    try {
      const body = await req.json();
      if (body?.amount != null) amount = Number(body.amount);
    } catch {
      // empty body = withdraw all
    }

    const result = await withdrawReferralSavings(auth.user.id, amount);
    return NextResponse.json({
      ok: true,
      balance: result.balance,
      refEarned: result.refEarned,
      withdrawn: result.withdrawn,
      minWithdraw: REFERRAL_MIN_WITHDRAW,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Withdraw failed" },
      { status: 400 }
    );
  }
}

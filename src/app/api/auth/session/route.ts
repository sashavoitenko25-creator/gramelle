import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getOrCreateProfile } from "@/lib/server/ledger";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { bindReferral } from "@/lib/server/referral";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Server not configured", demo: true },
        { status: 503 }
      );
    }

    const auth = await requireTelegramUser(req);
    const username =
      auth.user.username ||
      [auth.user.first_name, auth.user.last_name].filter(Boolean).join(" ") ||
      "Player" + String(auth.user.id).slice(-4);

    const profile = await getOrCreateProfile(
      auth.user.id,
      username,
      auth.user.photo_url || null
    );

    // Referral bind: prefer signed initData start_param; fallback body.startParam
    let bodyStart: string | undefined;
    try {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body.startParam === "string") {
        bodyStart = body.startParam;
      }
    } catch {
      /* empty body */
    }

    const startRaw = auth.startParam || bodyStart;
    let referralBound = false;
    if (startRaw && String(startRaw).includes("ref")) {
      try {
        const res = await bindReferral(auth.user.id, String(startRaw), username);
        referralBound = !!res.bound;
      } catch {
        /* non-fatal */
      }
    }

    // Re-read profile after possible bind (ref fields may change only for referrer)
    const fresh = await getOrCreateProfile(
      auth.user.id,
      username,
      auth.user.photo_url || null
    );

    return NextResponse.json({
      ok: true,
      referralBound,
      user: {
        telegramId: auth.user.id,
        username: fresh.username,
        photoUrl: auth.user.photo_url,
      },
      profile: {
        id: fresh.id,
        username: fresh.username,
        balance: Number(fresh.balance),
        referral_code: fresh.referral_code,
        ref_earned: Number(fresh.ref_earned),
        ref_count: Number(fresh.ref_count),
        photo_url: fresh.photo_url,
        biggest_win: Number(fresh.biggest_win || 0),
        wins: Number(fresh.wins || 0),
        games: Number(fresh.games || 0),
        ref_turnover: Number(
          (fresh as { ref_turnover?: number }).ref_turnover || 0
        ),
        ref_active: Number((fresh as { ref_active?: number }).ref_active || 0),
        wager_remaining: Number(
          (fresh as { wager_remaining?: number }).wager_remaining || 0
        ),
        referred_by: (fresh as { referred_by?: string | null }).referred_by || null,
        ban_reason: (fresh as { ban_reason?: string }).ban_reason || null,
        banned: !!(fresh as { banned?: boolean }).banned,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Session failed" },
      { status: 500 }
    );
  }
}

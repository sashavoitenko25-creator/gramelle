import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getOrCreateProfile, creditBalance } from "@/lib/server/ledger";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { START_BALANCE, REFERRAL_JOIN_BONUS } from "@/lib/constants";

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

    const profile = await getOrCreateProfile(auth.user.id, username);

    // referral once: start_param ref_*
    if (auth.startParam?.startsWith("ref_")) {
      const code = auth.startParam;
      if (code !== profile.referral_code) {
        try {
          const { getAdminClient } = await import("@/lib/server/supabase");
          const db = getAdminClient();
          const { data: referrer } = await db
            .from("profiles")
            .select("id, telegram_id, ref_count, ref_earned")
            .eq("referral_code", code)
            .maybeSingle();

          if (referrer?.telegram_id && referrer.telegram_id !== auth.user.id) {
            // only if this user has no referrer recorded yet
            const { data: me } = await db
              .from("profiles")
              .select("referred_by")
              .eq("id", profile.id)
              .maybeSingle();

            if (!me?.referred_by) {
              await db
                .from("profiles")
                .update({ referred_by: referrer.id })
                .eq("id", profile.id);

              await db
                .from("profiles")
                .update({
                  ref_count: (referrer.ref_count || 0) + 1,
                  ref_earned: Number(referrer.ref_earned || 0) + REFERRAL_JOIN_BONUS,
                })
                .eq("id", referrer.id);

              await creditBalance(referrer.telegram_id, REFERRAL_JOIN_BONUS, "referral", {
                from: auth.user.id,
                type: "join",
              });
            }
          }
        } catch {
          // non-fatal
        }
      }
    }

    return NextResponse.json({
      ok: true,
      user: {
        telegramId: auth.user.id,
        username: profile.username,
        photoUrl: auth.user.photo_url,
      },
      profile: {
        id: profile.id,
        username: profile.username,
        balance: Number(profile.balance),
        referral_code: profile.referral_code,
        ref_earned: Number(profile.ref_earned),
        ref_count: Number(profile.ref_count),
        photo_url: auth.user.photo_url || (profile as { photo_url?: string }).photo_url || null,
        biggest_win: Number((profile as { biggest_win?: number }).biggest_win || 0),
        wins: Number((profile as { wins?: number }).wins || 0),
        games: Number((profile as { games?: number }).games || 0),
        ref_turnover: Number((profile as { ref_turnover?: number }).ref_turnover || 0),
        ref_active: Number((profile as { ref_active?: number }).ref_active || 0),
        ton_wallet: (profile as { ton_wallet?: string }).ton_wallet || null,
        banned: Boolean((profile as { banned?: boolean }).banned),
        ban_reason: (profile as { ban_reason?: string }).ban_reason || null,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Auth failed" },
      { status: 500 }
    );
  }
}

/** Dev fallback when no bot token — should not be used in production */
export async function GET() {
  return NextResponse.json({
    ok: true,
    demo: true,
    startBalance: START_BALANCE,
  });
}

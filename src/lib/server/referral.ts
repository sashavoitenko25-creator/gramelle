import { getAdminClient } from "./supabase";
import { creditBalance } from "./ledger";
import { getReferralTier, REFERRAL_MIN_WITHDRAW } from "@/lib/constants";
import { getOrCreateProfile } from "./ledger";

/** Normalize codes: "ref_foo", "REF_FOO", "foo" → try match */
export function normalizeRefCode(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.startsWith("ref_") ? s : s.startsWith("ref") ? s : `ref_${s}`;
}

/**
 * Bind new user to referrer by referral_code. Idempotent.
 * Returns true if newly bound.
 */
export async function bindReferral(
  newTelegramId: number,
  rawCode: string,
  usernameHint?: string
): Promise<{ ok: boolean; bound: boolean; reason?: string }> {
  const code = normalizeRefCode(rawCode);
  if (!code.startsWith("ref_")) {
    return { ok: false, bound: false, reason: "bad_code" };
  }

  const db = getAdminClient();
  const profile = await getOrCreateProfile(newTelegramId, usernameHint);

  if (code === profile.referral_code) {
    return { ok: true, bound: false, reason: "self" };
  }

  const { data: referrer } = await db
    .from("profiles")
    .select("id, telegram_id, ref_count, referral_code")
    .eq("referral_code", code)
    .maybeSingle();

  // fallback: case-insensitive / without double prefix
  let ref = referrer;
  if (!ref) {
    const { data: all } = await db
      .from("profiles")
      .select("id, telegram_id, ref_count, referral_code")
      .ilike("referral_code", code)
      .limit(1);
    ref = all?.[0] || null;
  }

  if (!ref?.telegram_id) {
    return { ok: false, bound: false, reason: "not_found" };
  }
  if (Number(ref.telegram_id) === Number(newTelegramId)) {
    return { ok: true, bound: false, reason: "self" };
  }

  const { data: me } = await db
    .from("profiles")
    .select("referred_by")
    .eq("id", profile.id)
    .maybeSingle();

  if (me?.referred_by) {
    return { ok: true, bound: false, reason: "already" };
  }

  const { error: upErr } = await db
    .from("profiles")
    .update({ referred_by: ref.id })
    .eq("id", profile.id)
    .is("referred_by", null);

  if (upErr) {
    return { ok: false, bound: false, reason: upErr.message };
  }

  // atomic-ish ref_count bump
  await db
    .from("profiles")
    .update({ ref_count: (Number(ref.ref_count) || 0) + 1 })
    .eq("id", ref.id);

  return { ok: true, bound: true };
}

/**
 * Accrue share of house fee to referrer's savings (ref_earned).
 */
export async function payReferralFromHouseFee(
  playerTelegramId: number,
  betAmount: number,
  houseFeeFromThisBet: number
) {
  if (houseFeeFromThisBet <= 0 || betAmount <= 0) return;

  const db = getAdminClient();
  const { data: player } = await db
    .from("profiles")
    .select("referred_by")
    .eq("telegram_id", playerTelegramId)
    .maybeSingle();

  if (!player?.referred_by) return;

  const { data: referrer } = await db
    .from("profiles")
    .select("id, telegram_id, ref_count, ref_earned, ref_turnover, ref_active")
    .eq("id", player.referred_by)
    .maybeSingle();

  if (!referrer) return;

  const newTurnover = Number(referrer.ref_turnover || 0) + betAmount;
  await db
    .from("profiles")
    .update({ ref_turnover: newTurnover })
    .eq("id", referrer.id);

  // Players who already played at least once
  const { count: played } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", referrer.id)
    .gte("games", 1);

  // Total invites (so bronze unlocks even before first game of invitee)
  const totalInvites = Math.max(
    Number(referrer.ref_count) || 0,
    played || 0
  );
  const activeCount = Math.max(played || 0, totalInvites > 0 ? 1 : 0);

  await db
    .from("profiles")
    .update({ ref_active: activeCount })
    .eq("id", referrer.id);

  const tier = getReferralTier(activeCount, newTurnover);
  if (!tier) return;

  const bonus = +(houseFeeFromThisBet * tier.shareOfHouseFee).toFixed(6);
  if (bonus < 0.0001) return;

  await db
    .from("profiles")
    .update({
      ref_earned: +(Number(referrer.ref_earned || 0) + bonus).toFixed(6),
    })
    .eq("id", referrer.id);
}

export async function withdrawReferralSavings(
  telegramId: number,
  amount?: number
): Promise<{ balance: number; refEarned: number; withdrawn: number }> {
  const db = getAdminClient();
  const { data: profile, error } = await db
    .from("profiles")
    .select("id, telegram_id, ref_earned, balance")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error || !profile) throw new Error("Profile not found");

  const available = +(Number(profile.ref_earned) || 0).toFixed(6);
  const toWithdraw =
    amount != null && Number.isFinite(amount)
      ? +Number(amount).toFixed(6)
      : available;

  if (toWithdraw < REFERRAL_MIN_WITHDRAW) {
    throw new Error(`Minimum withdraw is ${REFERRAL_MIN_WITHDRAW} GRAM`);
  }
  if (toWithdraw > available + 1e-9) {
    throw new Error("Insufficient referral balance");
  }

  const newRef = +(available - toWithdraw).toFixed(6);
  const { data: updated, error: upErr } = await db
    .from("profiles")
    .update({ ref_earned: newRef })
    .eq("id", profile.id)
    .eq("ref_earned", profile.ref_earned)
    .select("ref_earned")
    .maybeSingle();

  if (upErr || !updated) {
    const { data: again } = await db
      .from("profiles")
      .select("ref_earned")
      .eq("id", profile.id)
      .maybeSingle();
    const avail2 = +(Number(again?.ref_earned) || 0).toFixed(6);
    if (avail2 < toWithdraw) throw new Error("Insufficient referral balance");
    const newRef2 = +(avail2 - toWithdraw).toFixed(6);
    await db
      .from("profiles")
      .update({ ref_earned: newRef2 })
      .eq("id", profile.id);
  }

  const { balance } = await creditBalance(telegramId, toWithdraw, "referral", {
    kind: "ref_withdraw",
    amount: toWithdraw,
  });

  const { data: final } = await db
    .from("profiles")
    .select("ref_earned")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  return {
    balance,
    refEarned: +(Number(final?.ref_earned) || 0).toFixed(6),
    withdrawn: toWithdraw,
  };
}

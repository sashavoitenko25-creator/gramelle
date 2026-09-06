import { getAdminClient } from "./supabase";
import { creditBalance } from "./ledger";
import { getReferralTier, REFERRAL_MIN_WITHDRAW } from "@/lib/constants";

/**
 * Accrue share of house fee to referrer's savings (ref_earned).
 * Does NOT credit main balance — user withdraws manually.
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

  const { count: active } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", referrer.id)
    .gte("games", 1);

  const activeCount = active || Number(referrer.ref_active || 0);
  await db
    .from("profiles")
    .update({ ref_active: activeCount })
    .eq("id", referrer.id);

  const tier = getReferralTier(activeCount, newTurnover);
  if (!tier) return;

  const bonus = +(houseFeeFromThisBet * tier.shareOfHouseFee).toFixed(6);
  if (bonus < 0.0001) return;

  // Savings only — no main balance credit
  await db
    .from("profiles")
    .update({
      ref_earned: +(Number(referrer.ref_earned || 0) + bonus).toFixed(6),
    })
    .eq("id", referrer.id);
}

/**
 * Move referral savings (ref_earned) → main balance.
 * Min amount: REFERRAL_MIN_WITHDRAW.
 */
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
    .eq("ref_earned", profile.ref_earned) // light optimistic lock
    .select("ref_earned")
    .maybeSingle();

  if (upErr || !updated) {
    // retry once without version match if concurrent
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
    type: "referral_withdraw",
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

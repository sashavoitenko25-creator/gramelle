import { getAdminClient } from "./supabase";
import { creditBalance } from "./ledger";
import { getReferralTier } from "@/lib/constants";

/**
 * After a bet is settled into a round: attribute turnover to referrer
 * and pay share of house fee when the round finishes.
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

  // Update turnover on referrer
  const newTurnover = Number(referrer.ref_turnover || 0) + betAmount;
  await db
    .from("profiles")
    .update({ ref_turnover: newTurnover })
    .eq("id", referrer.id);

  // Count active referrals (games >= 1)
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

  await creditBalance(referrer.telegram_id, bonus, "referral", {
    from: playerTelegramId,
    tier: tier.id,
    share: tier.shareOfHouseFee,
    house_fee_slice: houseFeeFromThisBet,
    bet: betAmount,
  });

  await db
    .from("profiles")
    .update({
      ref_earned: Number(referrer.ref_earned || 0) + bonus,
    })
    .eq("id", referrer.id);
}

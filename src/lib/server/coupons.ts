import { getAdminClient } from "./supabase";

export type CouponGame = "rps" | "dice" | "xo" | "roulette" | "pvp_roulette" | "all";

export async function consumeCoupon(telegramId: number, couponId: string, game: CouponGame) {
  const { data, error } = await getAdminClient().rpc("consume_coupon", {
    p_telegram_id: telegramId,
    p_coupon_id: couponId,
    p_game: game,
  });
  if (error) throw new Error(error.message || "Coupon is unavailable");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.coupon_id) throw new Error("Coupon is unavailable");
  return { id: String(row.coupon_id), amount: Number(row.amount), game: row.game as string | null };
}

export async function refundCoupon(telegramId: number, couponId: string) {
  const { data, error } = await getAdminClient().rpc("refund_coupon", {
    p_telegram_id: telegramId,
    p_coupon_id: couponId,
  });
  if (error) throw new Error(error.message || "Coupon refund failed");
  return Boolean(data);
}

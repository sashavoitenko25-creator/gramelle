import { apiFetch } from "@/lib/api";

export type CouponGame = "rps" | "dice" | "xo" | "roulette" | "pvp_roulette" | "all";
export interface Coupon {
  id: string;
  amount: number;
  game: CouponGame | null;
  status: "active" | "used" | "refunded" | "expired";
  created_at: string;
  used_at: string | null;
  used_game: string | null;
  expires_at: string | null;
  promo_code?: string | null;
}

export async function fetchCoupons() {
  return apiFetch<{ ok: boolean; coupons: Coupon[]; count: number; total: number }>("/api/coupons");
}
export async function redeemPromo(code: string) {
  return apiFetch<{ ok: boolean; reward_type: "balance"|"coupon"; amount: number; game?: CouponGame|null; balance: number; coupon_id?: string; code: string }>("/api/coupons/redeem", {
    method: "POST", body: JSON.stringify({ code })
  });
}

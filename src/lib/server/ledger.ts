import { getAdminClient } from "./supabase";
import { START_BALANCE } from "@/lib/constants";
import { creditHouse } from "./house";

export type LedgerReason =
  | "deposit_stars"
  | "deposit_ton"
  | "bet"
  | "win"
  | "referral"
  | "withdraw"
  | "withdraw_fee"
  | "adjust"
  | "refund"
  | "house_fee";

export interface ProfileRow {
  id: string;
  username: string;
  balance: number;
  referral_code: string;
  ref_earned: number;
  ref_count: number;
  telegram_id: number | null;
  referred_by?: string | null;
  photo_url?: string | null;
  biggest_win?: number | null;
  wins?: number | null;
  games?: number | null;
  ton_wallet?: string | null;
  ref_turnover?: number | null;
  ref_active?: number | null;
}

export async function creditBalance(
  telegramId: number,
  amount: number,
  reason: LedgerReason,
  meta: Record<string, unknown> = {}
): Promise<{ balance: number; profileId: string }> {
  if (amount === 0) throw new Error("Amount must be non-zero");
  const db = getAdminClient();

  const profile = await getOrCreateProfile(
    telegramId,
    meta.username as string | undefined
  );

  const newBalance = +(Number(profile.balance) + amount).toFixed(4);
  if (newBalance < -0.0001) {
    throw new Error("Insufficient balance");
  }

  const { error: upErr } = await db
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", profile.id);
  if (upErr) throw upErr;

  await db.from("ledger").insert({
    profile_id: profile.id,
    telegram_id: telegramId,
    amount,
    balance_after: newBalance,
    reason,
    meta,
  });

  try {
    if ((reason === "deposit_stars" || reason === "deposit_ton") && amount > 0) {
      await creditHouse(amount, "reserve", reason, meta);
    }
  } catch {
    // non-fatal
  }

  return { balance: newBalance, profileId: profile.id };
}

export async function getOrCreateProfile(
  telegramId: number,
  usernameHint?: string
): Promise<ProfileRow> {
  const db = getAdminClient();

  const { data: existing } = await db
    .from("profiles")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (existing) return existing as ProfileRow;

  const name = usernameHint || "Player" + String(telegramId).slice(-4);
  const code =
    "ref_" +
    name.toLowerCase().replace(/\s+/g, "") +
    "_" +
    String(telegramId).slice(-4);

  const { data: created, error } = await db
    .from("profiles")
    .insert({
      username: name,
      balance: START_BALANCE,
      referral_code: code,
      ref_earned: 0,
      ref_count: 0,
      telegram_id: telegramId,
      biggest_win: 0,
      wins: 0,
      games: 0,
      ref_turnover: 0,
      ref_active: 0,
    })
    .select("*")
    .single();

  if (error) {
    const { data: again } = await db
      .from("profiles")
      .select("*")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    if (again) return again as ProfileRow;
    throw error;
  }

  return created as ProfileRow;
}

export async function getBalance(telegramId: number): Promise<number> {
  const p = await getOrCreateProfile(telegramId);
  return Number(p.balance) || 0;
}

/** @deprecated deposit % removed — referral is % of house fee on bets */
export async function creditReferralOnDeposit(
  ..._args: unknown[]
): Promise<void> {
  return;
}

export async function recordWinStats(
  telegramId: number,
  winAmount: number,
  isWinner: boolean
): Promise<void> {
  const db = getAdminClient();
  const p = await getOrCreateProfile(telegramId);
  const games = (Number(p.games) || 0) + 1;
  const wins = (Number(p.wins) || 0) + (isWinner ? 1 : 0);
  const biggest = Math.max(
    Number(p.biggest_win) || 0,
    isWinner ? winAmount : 0
  );
  await db
    .from("profiles")
    .update({ games, wins, biggest_win: biggest })
    .eq("id", p.id);
}

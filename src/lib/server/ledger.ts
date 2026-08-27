import { getAdminClient } from "./supabase";
import { START_BALANCE } from "@/lib/constants";

export type LedgerReason =
  | "deposit_stars"
  | "deposit_ton"
  | "bet"
  | "win"
  | "referral"
  | "adjust"
  | "refund";

export interface ProfileRow {
  id: string;
  username: string;
  balance: number;
  referral_code: string;
  ref_earned: number;
  ref_count: number;
  telegram_id: number | null;
}

/**
 * Atomic balance change via ledger.
 * Never update profiles.balance from the client.
 */
export async function creditBalance(
  telegramId: number,
  amount: number,
  reason: LedgerReason,
  meta: Record<string, unknown> = {}
): Promise<{ balance: number; profileId: string }> {
  if (amount === 0) throw new Error("Amount must be non-zero");
  const db = getAdminClient();

  const profile = await getOrCreateProfile(telegramId, meta.username as string | undefined);

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

  const name =
    usernameHint ||
    "Player" + String(telegramId).slice(-4);

  const code = "ref_" + name.toLowerCase().replace(/\s+/g, "") + "_" + String(telegramId).slice(-4);

  const { data: created, error } = await db
    .from("profiles")
    .insert({
      username: name,
      balance: START_BALANCE,
      referral_code: code,
      ref_earned: 0,
      ref_count: 0,
      telegram_id: telegramId,
    })
    .select("*")
    .single();

  if (error) {
    // race: already created
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

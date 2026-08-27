import { getAdminClient } from "./supabase";

export async function assertNotBanned(telegramId: number): Promise<void> {
  const db = getAdminClient();
  const { data } = await db
    .from("profiles")
    .select("banned, ban_reason")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (data?.banned) {
    throw new Error(data.ban_reason || "Account banned");
  }
}

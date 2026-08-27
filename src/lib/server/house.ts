import { getAdminClient } from "./supabase";

/** System balances: user_reserve (liability) and project_profit */
export async function creditHouse(
  amount: number,
  kind: "profit" | "reserve",
  reason: string,
  meta: Record<string, unknown> = {}
) {
  if (amount <= 0) return;
  const db = getAdminClient();
  const col = kind === "profit" ? "profit_balance" : "reserve_balance";

  const { data: row } = await db
    .from("house_wallet")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (!row) {
    await db.from("house_wallet").insert({
      id: 1,
      profit_balance: kind === "profit" ? amount : 0,
      reserve_balance: kind === "reserve" ? amount : 0,
    });
  } else {
    await db
      .from("house_wallet")
      .update({
        [col]: Number(row[col] || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
  }

  await db.from("house_ledger").insert({
    kind,
    amount,
    reason,
    meta,
  });
}

export async function getHouseBalances() {
  const db = getAdminClient();
  const { data } = await db
    .from("house_wallet")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return {
    profit: Number(data?.profit_balance || 0),
    reserve: Number(data?.reserve_balance || 0),
  };
}

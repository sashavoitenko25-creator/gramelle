import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

export type TxKind = "deposit" | "withdraw";
export type TxStatus = "pending" | "processing" | "completed" | "rejected" | "failed";

/**
 * Unified money history for the current user:
 * - withdrawals table (pending → completed / rejected)
 * - ton_deposits (pending → credited)
 * - ledger deposit_stars / deposit_ton / withdraw / refund
 */
export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ items: [], demo: true });
    }
    const auth = await requireTelegramUser(req);
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 100);
    const db = getAdminClient();
    const tg = auth.user.id;

    type Item = {
      id: string;
      kind: TxKind;
      status: TxStatus;
      amount: number;
      unit: "GRAM" | "TON";
      title: string;
      detail?: string | null;
      createdAt: string;
      txHash?: string | null;
    };

    const items: Item[] = [];

    // Withdrawals
    const { data: wds } = await db
      .from("withdrawals")
      .select(
        "id, amount_ton, amount_gram, status, wallet_address, tx_hash, created_at, processed_at, admin_note"
      )
      .eq("telegram_id", tg)
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const w of wds || []) {
      const st = String(w.status || "pending").toLowerCase();
      let status: TxStatus = "pending";
      if (st === "completed" || st === "complete") status = "completed";
      else if (st === "rejected" || st === "cancelled" || st === "canceled")
        status = "rejected";
      else if (st === "processing") status = "processing";
      else status = "pending";

      items.push({
        id: `wd-${w.id}`,
        kind: "withdraw",
        status,
        amount: Number(w.amount_ton || w.amount_gram || 0),
        unit: "TON",
        title: "Withdraw TON",
        detail: w.wallet_address
          ? String(w.wallet_address).slice(0, 8) +
            "…" +
            String(w.wallet_address).slice(-6)
          : w.admin_note || null,
        createdAt: w.created_at,
        txHash: w.tx_hash || null,
      });
    }

    // TON deposit intents
    try {
      const { data: deps } = await db
        .from("ton_deposits")
        .select("id, amount_ton, amount_gram, status, memo, created_at, tx_hash")
        .eq("telegram_id", tg)
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const d of deps || []) {
        const st = String(d.status || "pending").toLowerCase();
        let status: TxStatus = "pending";
        if (st === "credited" || st === "completed" || st === "confirmed")
          status = "completed";
        else if (st === "failed" || st === "expired") status = "failed";
        else if (st === "processing") status = "processing";
        else status = "pending";

        items.push({
          id: `td-${d.id}`,
          kind: "deposit",
          status,
          amount: Number(d.amount_ton || 0),
          unit: "TON",
          title: "Deposit TON",
          detail: d.memo ? `memo ${String(d.memo).slice(0, 12)}` : null,
          createdAt: d.created_at,
          txHash: d.tx_hash || null,
        });
      }
    } catch {
      /* table may not exist */
    }

    // Ledger deposits (Stars / credited TON) — skip raw withdraw debits if withdrawal row exists
    const { data: led } = await db
      .from("ledger")
      .select("id, amount, reason, meta, created_at")
      .eq("telegram_id", tg)
      .in("reason", ["deposit_stars", "deposit_ton", "refund"])
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const row of led || []) {
      const reason = String(row.reason);
      if (reason === "deposit_stars") {
        items.push({
          id: `ld-${row.id}`,
          kind: "deposit",
          status: "completed",
          amount: Math.abs(Number(row.amount) || 0),
          unit: "GRAM",
          title: "Deposit Stars",
          detail: null,
          createdAt: row.created_at,
        });
      } else if (reason === "deposit_ton") {
        // may duplicate ton_deposits credited — still useful if no ton_deposits row
        items.push({
          id: `ld-${row.id}`,
          kind: "deposit",
          status: "completed",
          amount: Math.abs(Number(row.amount) || 0),
          unit: "GRAM",
          title: "Deposit TON",
          detail: null,
          createdAt: row.created_at,
        });
      } else if (reason === "refund") {
        items.push({
          id: `ld-${row.id}`,
          kind: "withdraw",
          status: "rejected",
          amount: Math.abs(Number(row.amount) || 0),
          unit: "GRAM",
          title: "Refund",
          detail: "Returned to balance",
          createdAt: row.created_at,
        });
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ items: items.slice(0, limit) });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

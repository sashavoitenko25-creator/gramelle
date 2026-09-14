import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

export type TxKind = "deposit" | "withdraw";
export type TxStatus =
  | "pending"
  | "processing"
  | "completed"
  | "rejected"
  | "failed";

/**
 * Unified money history for the current user:
 * - withdrawals table
 * - ton_deposits (source of truth for TON deposits — includes memo + tx)
 * - ledger deposit_stars / refund; deposit_ton only if no matching ton_deposits row
 */
export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ items: [], demo: true });
    }
    const auth = await requireTelegramUser(req);
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") || 50),
      100
    );
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
      memo?: string | null;
      amountGram?: number | null;
      amountTon?: number | null;
    };

    const items: Item[] = [];
    const seenTonTx = new Set<string>();
    const seenTonMemo = new Set<string>();

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
        title: "Вывод TON",
        detail: w.wallet_address
          ? String(w.wallet_address).slice(0, 8) +
            "…" +
            String(w.wallet_address).slice(-6)
          : w.admin_note || null,
        createdAt: w.created_at,
        txHash: w.tx_hash || null,
        amountTon: Number(w.amount_ton || 0) || null,
        amountGram: Number(w.amount_gram || 0) || null,
      });
    }

    // TON deposit intents — primary source (memo + tx_hash)
    try {
      const { data: deps } = await db
        .from("ton_deposits")
        .select(
          "id, amount_ton, amount_gram, status, memo, created_at, tx_hash, completed_at"
        )
        .eq("telegram_id", tg)
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const d of deps || []) {
        const st = String(d.status || "pending").toLowerCase();
        if (st === "expired") continue;

        let status: TxStatus = "pending";
        if (st === "credited" || st === "completed" || st === "confirmed")
          status = "completed";
        else if (st === "failed") status = "failed";
        else if (st === "processing") status = "processing";
        else status = "pending";

        const memo = d.memo ? String(d.memo) : null;
        const txHash = d.tx_hash ? String(d.tx_hash) : null;
        if (memo) seenTonMemo.add(memo);
        if (txHash) seenTonTx.add(txHash);

        const amountTon = Number(d.amount_ton || 0);
        const amountGram = Number(d.amount_gram || 0);

        items.push({
          id: `td-${d.id}`,
          kind: "deposit",
          status,
          amount: amountTon || amountGram,
          unit: amountTon ? "TON" : "GRAM",
          title: "Депозит TON",
          detail: memo
            ? status === "completed"
              ? `memo · ${memo.slice(0, 16)}${memo.length > 16 ? "…" : ""}`
              : `memo ${memo.slice(0, 14)}…`
            : null,
          createdAt: d.created_at,
          txHash,
          memo,
          amountTon: amountTon || null,
          amountGram: amountGram || null,
        });
      }
    } catch {
      /* table may not exist */
    }

    // Ledger: Stars + refunds; deposit_ton only if not already in ton_deposits
    const { data: led } = await db
      .from("ledger")
      .select("id, amount, reason, meta, created_at")
      .eq("telegram_id", tg)
      .in("reason", ["deposit_stars", "deposit_ton", "refund"])
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const row of led || []) {
      const reason = String(row.reason);
      const meta =
        row.meta && typeof row.meta === "object"
          ? (row.meta as Record<string, unknown>)
          : {};

      if (reason === "deposit_stars") {
        items.push({
          id: `ld-${row.id}`,
          kind: "deposit",
          status: "completed",
          amount: Math.abs(Number(row.amount) || 0),
          unit: "GRAM",
          title: "Депозит Stars",
          detail: null,
          createdAt: row.created_at,
        });
      } else if (reason === "deposit_ton") {
        const metaTx = meta.tx != null ? String(meta.tx) : "";
        const metaMemo = meta.memo != null ? String(meta.memo) : "";
        // Skip empty duplicate of ton_deposits row
        if (metaTx && seenTonTx.has(metaTx)) continue;
        if (metaMemo && seenTonMemo.has(metaMemo)) continue;
        // If we already show any completed TON deposit intents, skip bare ledger copies
        if (seenTonTx.size > 0 || seenTonMemo.size > 0) {
          // still allow orphan ledger credits without memo/tx match only when no deps at all
          if (metaTx || metaMemo) continue;
          continue;
        }

        items.push({
          id: `ld-${row.id}`,
          kind: "deposit",
          status: "completed",
          amount: Math.abs(Number(row.amount) || 0),
          unit: "GRAM",
          title: "Депозит TON",
          detail: metaMemo ? `memo ${metaMemo.slice(0, 14)}` : null,
          createdAt: row.created_at,
          txHash: metaTx || null,
          memo: metaMemo || null,
          amountGram: Math.abs(Number(row.amount) || 0),
          amountTon:
            meta.ton != null ? Number(meta.ton) : null,
        });
      } else if (reason === "refund") {
        const game = meta.game != null ? String(meta.game) : "";
        if (game === "rps") continue;
        items.push({
          id: `ld-${row.id}`,
          kind: "withdraw",
          status: "rejected",
          amount: Math.abs(Number(row.amount) || 0),
          unit: "GRAM",
          title: "Возврат",
          detail: "Возвращено на баланс",
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

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { creditBalance, creditReferralOnDeposit } from "@/lib/server/ledger";
import { notifyUser, fmtAmount } from "@/lib/server/notify";
import { TON_DEPOSIT_ADDRESS } from "@/lib/constants";

/**
 * Poll TonAPI for recent transactions to our wallet and match memos.
 * Env: TONAPI_KEY (optional), NEXT_PUBLIC_TON_WALLET
 *
 * Docs: https://tonapi.io
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const auth = await requireTelegramUser(req);
    const db = getAdminClient();

    // pending deposits for this user
    const { data: pending } = await db
      .from("ton_deposits")
      .select("*")
      .eq("telegram_id", auth.user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!pending?.length) {
      return NextResponse.json({ ok: true, credited: [], message: "No pending deposits" });
    }

    const addr = process.env.NEXT_PUBLIC_TON_WALLET || TON_DEPOSIT_ADDRESS;
    const tonApiKey = process.env.TONAPI_KEY || "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (tonApiKey) headers["Authorization"] = `Bearer ${tonApiKey}`;

    let events: Array<{
      in_progress?: boolean;
      actions?: Array<{
        type?: string;
        TonTransfer?: {
          amount?: number;
          comment?: string;
          recipient?: { address?: string };
        };
      }>;
      event_id?: string;
    }> = [];

    try {
      const url = `https://tonapi.io/v2/accounts/${addr}/events?limit=30`;
      const res = await fetch(url, { headers, next: { revalidate: 0 } });
      if (res.ok) {
        const json = await res.json();
        events = json.events || [];
      }
    } catch (e) {
      console.warn("TonAPI fetch failed", e);
      return NextResponse.json({
        ok: false,
        error: "TonAPI unavailable. Set TONAPI_KEY or try later.",
        credited: [],
      });
    }

    const credited: Array<{ memo: string; gram: number }> = [];

    for (const dep of pending) {
      const memo = String(dep.memo);
      const expectedNano = Math.round(Number(dep.amount_ton) * 1e9);

      for (const ev of events) {
        if (ev.in_progress) continue;
        for (const action of ev.actions || []) {
          const tr = action.TonTransfer;
          if (!tr) continue;
          const comment = (tr.comment || "").trim();
          if (comment !== memo) continue;

          // amount tolerance 1%
          const amt = Number(tr.amount || 0);
          if (amt < expectedNano * 0.99) continue;

          // mark completed + credit
          const { data: updated } = await db
            .from("ton_deposits")
            .update({
              status: "completed",
              tx_hash: ev.event_id || null,
              completed_at: new Date().toISOString(),
            })
            .eq("id", dep.id)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();

          if (updated) {
            const gram = Number(dep.amount_gram);
            await creditBalance(auth.user.id, gram, "deposit_ton", {
              memo,
              tx: ev.event_id,
              ton: dep.amount_ton,
            });
            try {
              await creditReferralOnDeposit(auth.user.id, gram, {
                memo,
                tx: ev.event_id,
              });
            } catch {}
            credited.push({ memo, gram });
            await notifyUser(
              auth.user.id,
              `✅ <b>Deposit completed</b>\n` +
                `+${fmtAmount(gram, "GRAM")} (TON)\n` +
                `Status: <b>Completed</b>`
            );
          }
        }
      }
    }

    return NextResponse.json({ ok: true, credited });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Check failed" },
      { status: 500 }
    );
  }
}

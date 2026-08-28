import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { creditBalance, creditReferralOnDeposit } from "@/lib/server/ledger";
import { notifyUser, fmtAmount } from "@/lib/server/notify";
import { TON_DEPOSIT_ADDRESS } from "@/lib/constants";

/**
 * Poll TonAPI for recent txs to deposit wallet.
 * Match order:
 *  1) exact memo comment
 *  2) same amount (±1%) for this user's pending (TON Connect often has no comment)
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const auth = await requireTelegramUser(req);
    const db = getAdminClient();

    const { data: pending } = await db
      .from("ton_deposits")
      .select("*")
      .eq("telegram_id", auth.user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!pending?.length) {
      return NextResponse.json({
        ok: true,
        credited: [],
        message: "No pending deposits",
      });
    }

    const addr = process.env.NEXT_PUBLIC_TON_WALLET || TON_DEPOSIT_ADDRESS;
    const tonApiKey = process.env.TONAPI_KEY || "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (tonApiKey) headers["Authorization"] = `Bearer ${tonApiKey}`;

    type Ev = {
      in_progress?: boolean;
      timestamp?: number;
      actions?: Array<{
        type?: string;
        TonTransfer?: {
          amount?: number;
          comment?: string;
          recipient?: { address?: string };
        };
      }>;
      event_id?: string;
    };

    let events: Ev[] = [];
    try {
      const url = `https://tonapi.io/v2/accounts/${addr}/events?limit=40`;
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

    // Flatten inbound transfers
    const transfers: Array<{
      nano: number;
      comment: string;
      eventId: string;
      ts: number;
    }> = [];
    for (const ev of events) {
      if (ev.in_progress) continue;
      for (const action of ev.actions || []) {
        const tr = action.TonTransfer;
        if (!tr) continue;
        transfers.push({
          nano: Number(tr.amount || 0),
          comment: (tr.comment || "").trim(),
          eventId: String(ev.event_id || ""),
          ts: Number(ev.timestamp || 0),
        });
      }
    }

    const usedEvents = new Set<string>();
    const credited: Array<{ memo: string; gram: number }> = [];

    const tryCredit = async (
      dep: (typeof pending)[0],
      tr: (typeof transfers)[0]
    ) => {
      if (tr.eventId && usedEvents.has(tr.eventId)) return false;
      const { data: updated } = await db
        .from("ton_deposits")
        .update({
          status: "completed",
          tx_hash: tr.eventId || null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", dep.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (!updated) return false;
      if (tr.eventId) usedEvents.add(tr.eventId);

      const gram = Number(dep.amount_gram);
      await creditBalance(auth.user.id, gram, "deposit_ton", {
        memo: dep.memo,
        tx: tr.eventId,
        ton: dep.amount_ton,
      });
      try {
        await creditReferralOnDeposit(auth.user.id, gram, {
          memo: dep.memo,
          tx: tr.eventId,
        });
      } catch {}
      await notifyUser(
        auth.user.id,
        `✅ <b>Deposit completed</b>\n` +
          `+${fmtAmount(gram, "GRAM")} (TON)\n` +
          `Status: <b>Completed</b>`
      );
      credited.push({ memo: String(dep.memo), gram });
      return true;
    };

    for (const dep of pending) {
      const memo = String(dep.memo);
      const expectedNano = Math.round(Number(dep.amount_ton) * 1e9);
      const createdMs = dep.created_at
        ? new Date(dep.created_at).getTime()
        : Date.now();

      // 1) memo match
      let matched = false;
      for (const tr of transfers) {
        if (tr.comment !== memo) continue;
        if (tr.nano < expectedNano * 0.99) continue;
        matched = await tryCredit(dep, tr);
        if (matched) break;
      }
      if (matched) continue;

      // 2) amount match for this user only (TON Connect without comment)
      //    only transfers after pending was created (with 2 min slack)
      for (const tr of transfers) {
        if (tr.nano < expectedNano * 0.99 || tr.nano > expectedNano * 1.01)
          continue;
        if (tr.ts && tr.ts * 1000 < createdMs - 120_000) continue;
        matched = await tryCredit(dep, tr);
        if (matched) break;
      }
    }

    return NextResponse.json({ ok: true, credited });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Check failed", credited: [] },
      { status: 500 }
    );
  }
}

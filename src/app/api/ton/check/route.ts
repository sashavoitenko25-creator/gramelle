import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { creditBalance } from "@/lib/server/ledger";
import { notifyUser, fmtAmount } from "@/lib/server/notify";
import { TON_DEPOSIT_ADDRESS } from "@/lib/constants";

type TonTransfer = {
  amount?: number;
  comment?: string;
  recipient?: { address?: string };
};

type TonAction = {
  type?: string;
  TonTransfer?: TonTransfer;
};

type TonEvent = {
  in_progress?: boolean;
  timestamp?: number;
  event_id?: string;
  actions?: TonAction[];
};

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const auth = await requireTelegramUser(req);
    const db = getAdminClient();

    // Expire stale intents before matching anything.
    await db
      .from("ton_deposits")
      .update({ status: "expired" })
      .eq("telegram_id", auth.user.id)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    const { data: pending } = await db
      .from("ton_deposits")
      .select("*")
      .eq("telegram_id", auth.user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    if (!pending?.length) {
      return NextResponse.json({ ok: true, credited: [], message: "No pending deposits" });
    }

    const addr = process.env.NEXT_PUBLIC_TON_WALLET || TON_DEPOSIT_ADDRESS;
    const apiKey = process.env.TONAPI_KEY || "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    let events: TonEvent[] = [];
    try {
      const res = await fetch(`https://tonapi.io/v2/accounts/${addr}/events?limit=40`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`TonAPI ${res.status}`);
      const json = await res.json();
      events = Array.isArray(json.events) ? json.events : [];
    } catch {
      return NextResponse.json(
        { ok: false, error: "TonAPI unavailable. Set TONAPI_KEY or try later.", credited: [] },
        { status: 503 }
      );
    }

    const transfers = events.flatMap((ev) =>
      (ev.actions || [])
        .filter((action) => !!action.TonTransfer)
        .map((action) => ({
          // TonAPI event_id is used as the chain event/trace identifier. It is
          // persisted in tx_hash and protected by a unique DB index.
          txHash: String(ev.event_id || ""),
          nano: Number(action.TonTransfer?.amount || 0),
          comment: String(action.TonTransfer?.comment || "").trim(),
          recipient: String(action.TonTransfer?.recipient?.address || ""),
          ts: Number(ev.timestamp || 0),
        }))
    ).filter((tr) => tr.txHash && tr.recipient === addr && tr.nano > 0);

    const credited: Array<{ memo: string; gram: number; txHash: string }> = [];
    const used = new Set<string>();

    for (const dep of pending) {
      const memo = String(dep.memo);
      const expectedNano = Math.round(Number(dep.amount_ton) * 1e9);
      const createdMs = new Date(dep.created_at).getTime();

      // STRICT: memo is mandatory. Never credit by amount alone.
      const candidates = transfers.filter(
        (tr) =>
          tr.comment === memo &&
          tr.nano >= expectedNano &&
          (!tr.ts || tr.ts * 1000 >= createdMs - 60_000)
      );

      for (const tr of candidates) {
        if (used.has(tr.txHash)) continue;

        // Atomic claim. The unique tx_hash index is the second line of defense
        // against the same chain event being credited twice.
        const { data: claimed, error: claimError } = await db
          .from("ton_deposits")
          .update({
            status: "completed",
            tx_hash: tr.txHash,
            completed_at: new Date().toISOString(),
          })
          .eq("id", dep.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();

        if (claimError) throw claimError;
        if (!claimed) continue;

        try {
          await creditBalance(auth.user.id, Number(dep.amount_gram), "deposit_ton", {
            memo,
            tx: tr.txHash,
            ton: dep.amount_ton,
          });
        } catch (e) {
          // Restore pending only if this exact claim still belongs to us.
          await db
            .from("ton_deposits")
            .update({ status: "pending", tx_hash: null, completed_at: null })
            .eq("id", dep.id)
            .eq("status", "completed")
            .eq("tx_hash", tr.txHash);
          throw e;
        }

        used.add(tr.txHash);
        credited.push({ memo, gram: Number(dep.amount_gram), txHash: tr.txHash });
        try {
          await notifyUser(
            auth.user.id,
            `✅ <b>Deposit completed</b>\n+${fmtAmount(Number(dep.amount_gram), "GRAM")} (TON)\nStatus: <b>Completed</b>`
          );
        } catch {}
        break;
      }
    }

    return NextResponse.json({ ok: true, credited });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Check failed", credited: [] },
      { status: 500 }
    );
  }
}

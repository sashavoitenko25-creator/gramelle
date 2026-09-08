import { getAdminClient } from "./supabase";
import { creditBalance } from "./ledger";
import { notifyUser, fmtAmount } from "./notify";
import { TON_DEPOSIT_ADDRESS, TON_PENDING_TTL_SEC } from "@/lib/constants";

type ChainTx = {
  nano: number;
  comment: string;
  ts: number;
  txHash: string;
};

/**
 * Expire stale intents and credit any pending TON deposits that appear on-chain.
 * @param telegramId if set — only that user; otherwise all pending (cron).
 */
export async function processPendingTonDeposits(telegramId?: number): Promise<{
  credited: Array<{ telegramId: number; memo: string; gram: number; txHash: string }>;
  expired: number;
}> {
  const db = getAdminClient();
  const nowIso = new Date().toISOString();
  const ttlCutoff = new Date(Date.now() - TON_PENDING_TTL_SEC * 1000).toISOString();

  let expQ = db
    .from("ton_deposits")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", nowIso);
  if (telegramId != null) expQ = expQ.eq("telegram_id", telegramId);
  await expQ;

  let expNull = db
    .from("ton_deposits")
    .update({ status: "expired" })
    .eq("status", "pending")
    .is("expires_at", null)
    .lt("created_at", ttlCutoff);
  if (telegramId != null) expNull = expNull.eq("telegram_id", telegramId);
  await expNull;

  let pendingQ = db
    .from("ton_deposits")
    .select("*")
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(telegramId != null ? 10 : 50);
  if (telegramId != null) pendingQ = pendingQ.eq("telegram_id", telegramId);

  const { data: pending } = await pendingQ;
  if (!pending?.length) {
    return { credited: [], expired: 0 };
  }

  const addr = process.env.NEXT_PUBLIC_TON_WALLET || TON_DEPOSIT_ADDRESS;
  const apiKey = process.env.TONAPI_KEY || "";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let events: Array<{
    in_progress?: boolean;
    timestamp?: number;
    event_id?: string;
    actions?: Array<{
      type?: string;
      TonTransfer?: {
        amount?: number;
        comment?: string;
        recipient?: { address?: string };
      };
    }>;
  }> = [];

  try {
    const res = await fetch(
      `https://tonapi.io/v2/accounts/${addr}/events?limit=50`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) throw new Error(`TonAPI ${res.status}`);
    const json = (await res.json()) as { events?: typeof events };
    events = json.events || [];
  } catch (e) {
    throw e instanceof Error ? e : new Error("TonAPI failed");
  }

  const transfers: ChainTx[] = [];
  for (const ev of events) {
    if (ev.in_progress) continue;
    for (const act of ev.actions || []) {
      if (act.type !== "TonTransfer" || !act.TonTransfer) continue;
      const tr = act.TonTransfer;
      const comment = (tr.comment || "").trim();
      const nano = Number(tr.amount) || 0;
      if (nano <= 0) continue;
      transfers.push({
        nano,
        comment,
        ts: Number(ev.timestamp) || 0,
        txHash: String(ev.event_id || ""),
      });
    }
  }

  const credited: Array<{
    telegramId: number;
    memo: string;
    gram: number;
    txHash: string;
  }> = [];
  const used = new Set<string>();

  for (const dep of pending) {
    const memo = String(dep.memo || "").trim();
    if (!memo) continue;
    const expectedNano = Math.round(Number(dep.amount_ton) * 1e9);
    const createdMs = new Date(dep.created_at).getTime();
    const tid = Number(dep.telegram_id);

    const candidates = transfers.filter(
      (tr) =>
        tr.comment === memo &&
        tr.nano >= expectedNano - 1 &&
        tr.txHash &&
        (!tr.ts || tr.ts * 1000 >= createdMs - 120_000)
    );

    for (const tr of candidates) {
      if (used.has(tr.txHash)) continue;

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
        await creditBalance(tid, Number(dep.amount_gram), "deposit_ton", {
          memo,
          tx: tr.txHash,
          ton: dep.amount_ton,
        });
      } catch (e) {
        await db
          .from("ton_deposits")
          .update({ status: "pending", tx_hash: null, completed_at: null })
          .eq("id", dep.id)
          .eq("status", "completed")
          .eq("tx_hash", tr.txHash);
        throw e;
      }

      used.add(tr.txHash);
      credited.push({
        telegramId: tid,
        memo,
        gram: Number(dep.amount_gram),
        txHash: tr.txHash,
      });

      try {
        await notifyUser(
          tid,
          `✅ <b>Депозит зачислен</b>\n+${fmtAmount(Number(dep.amount_gram), "GRAM")} (TON)\nСтатус: <b>Успешно</b>`
        );
      } catch {
        /* ignore */
      }
      break;
    }
  }

  return { credited, expired: 0 };
}

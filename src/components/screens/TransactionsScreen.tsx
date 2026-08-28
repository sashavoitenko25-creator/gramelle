"use client";

import { useCallback, useEffect, useState } from "react";
import { formatGram, cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

type TxKind = "deposit" | "withdraw";
type TxStatus = "pending" | "processing" | "completed" | "rejected" | "failed";

interface TxItem {
  id: string;
  kind: TxKind;
  status: TxStatus;
  amount: number;
  unit: "GRAM" | "TON";
  title: string;
  detail?: string | null;
  createdAt: string;
  txHash?: string | null;
}

interface Props {
  onBack: () => void;
}

const STATUS_LABEL: Record<TxStatus, string> = {
  pending: "Processing",
  processing: "Processing",
  completed: "Completed",
  rejected: "Rejected",
  failed: "Failed",
};

function statusStyle(s: TxStatus) {
  if (s === "completed")
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (s === "rejected" || s === "failed")
    return "bg-red-500/15 text-red-300 border-red-500/25";
  return "bg-amber-500/15 text-amber-200 border-amber-500/25";
}

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function TransactionsScreen({ onBack }: Props) {
  const [items, setItems] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "deposit" | "withdraw">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: TxItem[] }>("/api/transactions?limit=60");
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered =
    filter === "all" ? items : items.filter((i) => i.kind === filter);

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="flex items-center justify-between px-4 pt-3 pb-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/50 btn-press"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-[15px] font-semibold">Transactions</h1>
        <button
          type="button"
          onClick={() => void load()}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/45"
          aria-label="Refresh"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-3-6.7" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      <div className="mx-4 mb-4 flex gap-1.5 p-1 rounded-2xl bg-black/35 border border-white/[0.06]">
        {(
          [
            ["all", "All"],
            ["deposit", "Deposits"],
            ["withdraw", "Withdrawals"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-semibold transition btn-press",
              filter === id
                ? "bg-white/10 text-white border border-white/10"
                : "text-white/40 border border-transparent"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2.5">
        {loading && (
          <p className="text-center text-xs text-white/35 py-12 pulse-soft">
            Loading…
          </p>
        )}
        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-white/45 font-medium">No transactions yet</p>
            <p className="text-xs text-white/25 mt-1.5">
              Deposits and withdrawals will appear here
            </p>
          </div>
        )}

        {filtered.map((tx) => (
          <div
            key={tx.id}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0",
                  tx.kind === "deposit"
                    ? "bg-cyan-500/12 border-cyan-500/25 text-cyan-300"
                    : "bg-violet-500/12 border-violet-500/25 text-violet-300"
                )}
              >
                {tx.kind === "deposit" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">{tx.title}</div>
                  <div className="text-sm font-semibold tabular-nums shrink-0">
                    {tx.kind === "deposit" ? "+" : "−"}
                    {formatGram(tx.amount)}{" "}
                    <span className="text-[10px] text-white/35 font-medium">
                      {tx.unit}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-lg border",
                      statusStyle(tx.status)
                    )}
                  >
                    {STATUS_LABEL[tx.status]}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {formatWhen(tx.createdAt)}
                  </span>
                </div>
                {tx.detail && (
                  <p className="text-[11px] text-white/30 mt-1.5 truncate font-mono">
                    {tx.detail}
                  </p>
                )}
                {tx.txHash && (
                  <p className="text-[10px] text-white/25 mt-1 truncate font-mono">
                    tx {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-6)}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

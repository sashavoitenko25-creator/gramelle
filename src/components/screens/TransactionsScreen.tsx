"use client";

import { useTelegram } from "@/hooks/useTelegram";
import { useI18n } from "@/lib/i18n/context";
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
  memo?: string | null;
  amountGram?: number | null;
  amountTon?: number | null;
}

interface Props {
  onBack: () => void;
}

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

function explorerUrl(txHash: string): string {
  const h = encodeURIComponent(txHash);
  // Tonviewer accepts event / message hashes from TonAPI
  return `https://tonviewer.com/transaction/${h}`;
}

export function TransactionsScreen({ onBack }: Props) {
  const { t, lang } = useI18n();
  const { setBackButton, openLink } = useTelegram();
  useEffect(() => {
    setBackButton(() => {
      onBack();
    });
    return () => setBackButton(null);
  }, [onBack, setBackButton]);

  const [items, setItems] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "deposit" | "withdraw">("all");
  const [selected, setSelected] = useState<TxItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: TxItem[] }>(
        "/api/transactions?limit=60"
      );
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered =
    filter === "all" ? items : items.filter((x) => x.kind === filter);

  const isRu = lang === "ru";

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-4 pt-3 pb-2">
        <h1 className="text-[15px] font-semibold">{t("transactions")}</h1>
      </div>

      <div className="px-4 flex gap-2 mb-3">
        {(
          [
            ["all", t("all")],
            ["deposit", t("deposits")],
            ["withdraw", t("withdrawals")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-[12px] font-medium border transition",
              filter === id
                ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200"
                : "bg-white/[0.03] border-white/10 text-white/45"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 flex-1 space-y-2 overflow-y-auto">
        {loading && (
          <div className="text-center text-white/40 text-sm py-10">…</div>
        )}
        {error && (
          <div className="text-center text-red-300/80 text-sm py-6">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center text-white/35 text-sm py-10">
            {t("noRounds")}
          </div>
        )}

        {filtered.map((tx) => (
          <button
            key={tx.id}
            type="button"
            onClick={() => setSelected(tx)}
            className="w-full text-left rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5 btn-press active:scale-[0.99] transition"
          >
            <div className="flex gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0",
                  tx.kind === "deposit"
                    ? "bg-emerald-500/12 border-emerald-500/25 text-emerald-300"
                    : "bg-violet-500/12 border-violet-500/25 text-violet-300"
                )}
              >
                {tx.kind === "deposit" ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
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
                    {tx.status === "completed"
                      ? t("completed")
                      : tx.status === "rejected" || tx.status === "failed"
                        ? t(
                            tx.status === "rejected" ? "rejected" : "failed"
                          )
                        : t("processing")}
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
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Detail sheet */}
      {selected && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="close"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0c0c14] p-5 pb-8 safe-bottom slide-up">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold">{selected.title}</div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-white/40 text-sm px-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="text-white/40">
                  {isRu ? "Статус" : "Status"}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-lg border",
                    statusStyle(selected.status)
                  )}
                >
                  {selected.status === "completed"
                    ? t("completed")
                    : selected.status === "rejected"
                      ? t("rejected")
                      : selected.status === "failed"
                        ? t("failed")
                        : t("processing")}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-white/40">
                  {isRu ? "Сумма" : "Amount"}
                </span>
                <span className="font-semibold tabular-nums">
                  {selected.kind === "deposit" ? "+" : "−"}
                  {formatGram(selected.amount)} {selected.unit}
                </span>
              </div>

              {selected.amountTon != null && selected.amountTon > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-white/40">TON</span>
                  <span className="tabular-nums">
                    {formatGram(selected.amountTon)} TON
                  </span>
                </div>
              )}
              {selected.amountGram != null && selected.amountGram > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-white/40">GRAM</span>
                  <span className="tabular-nums">
                    {formatGram(selected.amountGram)} GRAM
                  </span>
                </div>
              )}

              <div className="flex justify-between gap-3">
                <span className="text-white/40">
                  {isRu ? "Дата" : "Date"}
                </span>
                <span className="text-white/70">
                  {formatWhen(selected.createdAt)}
                </span>
              </div>

              {selected.memo && (
                <div>
                  <div className="text-white/40 mb-1">Memo</div>
                  <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 font-mono text-[11px] text-cyan-200/90 break-all">
                    {selected.memo}
                  </div>
                </div>
              )}

              {selected.txHash && (
                <div>
                  <div className="text-white/40 mb-1">TX</div>
                  <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 font-mono text-[11px] text-white/60 break-all">
                    {selected.txHash}
                  </div>
                </div>
              )}
            </div>

            {selected.txHash && (
              <button
                type="button"
                onClick={() => openLink(explorerUrl(selected.txHash!))}
                className="mt-5 w-full h-12 rounded-2xl btn-primary text-sm font-medium btn-press"
              >
                {isRu ? "Проверить в сети" : "View on explorer"}
              </button>
            )}

            {!selected.txHash && selected.status === "completed" && (
              <p className="mt-4 text-[11px] text-white/35 text-center">
                {isRu
                  ? "Хеш транзакции недоступен для этой записи"
                  : "Transaction hash not available for this entry"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { HistoryItem } from "@/lib/types";
import { formatGram, formatTime, cn } from "@/lib/utils";
import { RoundDetailModal } from "@/components/modals/RoundDetailModal";

interface HistoryScreenProps {
  history: HistoryItem[];
  onBack: () => void;
  onVerify?: (rollId: number) => void;
  initialTab?: "all" | "lucky" | "top";
  telegramId?: number | null;
}

type HistTab = "all" | "lucky" | "top";

interface ServerItem {
  rollId: number;
  roomSeq?: number;
  mode?: string;
  winner: string;
  pot: number;
  chance: number;
  at?: string;
  winnerTelegramId?: number | null;
  playerTelegramIds?: number[];
}

export function HistoryScreen({
  history,
  onBack,
  initialTab = "all",
  telegramId = null,
}: HistoryScreenProps) {
  const [tab, setTab] = useState<HistTab>(initialTab);
  const [detailRoll, setDetailRoll] = useState<number | null>(null);
  const [serverItems, setServerItems] = useState<ServerItem[]>([]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let alive = true;
    fetch("/api/rounds/recent?limit=40")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setServerItems((d.items || []) as ServerItem[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (serverItems.length > 0) {
      if (tab === "lucky") {
        return [...serverItems]
          .filter((x) => x.chance > 0 && x.chance <= 25)
          .sort((a, b) => a.chance - b.chance);
      }
      if (tab === "top") {
        return [...serverItems].sort((a, b) => b.pot - a.pot);
      }
      return [...serverItems].sort((a, b) => b.rollId - a.rollId);
    }
    if (tab === "lucky") {
      return history.filter((h) => h.chance <= 25).sort((a, b) => a.chance - b.chance);
    }
    if (tab === "top") {
      return [...history].sort((a, b) => b.win - a.win);
    }
    return history;
  }, [serverItems, history, tab]);

  const outcome = (h: ServerItem | HistoryItem, isServer: boolean) => {
    if (telegramId == null) return "none" as const;
    if (isServer) {
      const s = h as ServerItem;
      const ids = s.playerTelegramIds || [];
      const played = ids.includes(Number(telegramId));
      if (!played) return "none" as const;
      if (s.winnerTelegramId != null && Number(s.winnerTelegramId) === Number(telegramId))
        return "win" as const;
      return "lose" as const;
    }
    const loc = h as HistoryItem;
    if (loc.isMe) return "win" as const;
    return "none" as const;
  };

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/60 btn-press"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">History</h1>
      </div>

      <div className="mx-4 mb-3 flex gap-1.5 p-1 rounded-2xl bg-black/30 border border-white/[0.06]">
        {(["all", "lucky", "top"] as HistTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 h-9 rounded-xl text-xs font-medium capitalize transition btn-press",
              tab === t ? "bg-white/10 text-white" : "text-white/40"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-white/35 py-10">No rounds yet</p>
        )}
        {filtered.map((h, idx) => {
          const isServer = "rollId" in h && !("isMe" in h);
          const id = isServer ? (h as ServerItem).rollId : (h as HistoryItem).id;
          const roomSeq = isServer
            ? (h as ServerItem).roomSeq ?? id
            : id;
          const winner = isServer
            ? (h as ServerItem).winner
            : (h as HistoryItem).winner;
          const chance = isServer
            ? (h as ServerItem).chance
            : (h as HistoryItem).chance;
          const amount = isServer
            ? (h as ServerItem).pot
            : (h as HistoryItem).win;
          const timeLabel = isServer
            ? (h as ServerItem).at
              ? formatTime(new Date((h as ServerItem).at as string))
              : ""
            : formatTime((h as HistoryItem).time);

          const oc = outcome(h, isServer);
          const rowCls =
            oc === "win"
              ? "border-emerald-500/35 bg-emerald-500/[0.08]"
              : oc === "lose"
                ? "border-rose-500/35 bg-rose-500/[0.08]"
                : "border-white/[0.06] bg-white/[0.03]";
          const amountCls =
            oc === "win"
              ? "text-emerald-400"
              : oc === "lose"
                ? "text-rose-300"
                : "text-white/70";

          return (
            <div
              key={`${id}-${idx}`}
              onClick={() => isServer && setDetailRoll(id)}
              className={cn(
                "rounded-2xl border px-3.5 py-3 transition",
                rowCls,
                isServer && "cursor-pointer hover:border-white/15"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white/90 truncate">
                    @{winner}
                  </div>
                  <div className="text-[11px] text-white/40 flex items-center gap-1.5 mt-0.5">
                    <span>
                      {(isServer ? (h as ServerItem).mode : undefined) === "high"
                        ? "SPINH"
                        : "SPINC"}
                      #{roomSeq}
                    </span>
                    <span>·</span>
                    <span>{chance}%</span>
                    {timeLabel && (
                      <>
                        <span>·</span>
                        <span>{timeLabel}</span>
                      </>
                    )}
                    {oc === "win" && (
                      <span className="text-emerald-400/90 ml-1">Win</span>
                    )}
                    {oc === "lose" && (
                      <span className="text-rose-300/90 ml-1">Lost</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("text-sm font-semibold tabular-nums", amountCls)}>
                    {formatGram(amount)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <RoundDetailModal
        open={detailRoll != null}
        rollId={detailRoll}
        onClose={() => setDetailRoll(null)}
      />
    </div>
  );
}

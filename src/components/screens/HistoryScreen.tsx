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
}

type HistTab = "all" | "lucky" | "top";

interface ServerItem {
  rollId: number;
  winner: string;
  pot: number;
  chance: number;
  at?: string;
  mode?: string;
}

export function HistoryScreen({
  history,
  onBack,
  initialTab = "all",
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
        const items = (d.items || []) as ServerItem[];
        setServerItems(items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    // Prefer server feed for global Lucky/Top/All when available
    if (serverItems.length > 0) {
      if (tab === "all") {
        return [...serverItems].sort((a, b) => b.rollId - a.rollId);
      }
      if (tab === "lucky") {
        // lowest chance % among winners
        return [...serverItems]
          .filter((x) => x.chance > 0)
          .sort((a, b) => a.chance - b.chance);
      }
      // top — biggest pot
      return [...serverItems].sort((a, b) => b.pot - a.pot);
    }

    // Fallback: local history
    const wins = history.filter((h) => h.isMe);
    if (tab === "all") {
      return [...history].sort((a, b) => b.time.getTime() - a.time.getTime());
    }
    if (tab === "lucky") {
      return [...wins].sort((a, b) => a.chance - b.chance);
    }
    return [...wins].sort((a, b) => b.win - a.win);
  }, [history, tab, serverItems]);

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
        <h1 className="text-[15px] font-semibold">History</h1>
        <div className="w-9" />
      </div>

      <div className="mx-4 mb-4 flex gap-1.5 p-1 rounded-2xl bg-black/35 border border-white/[0.06]">
        {(
          [
            ["all", "All"],
            ["lucky", "Lucky"],
            ["top", "Top"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-semibold transition btn-press",
              tab === id
                ? "bg-white/10 text-white border border-white/10"
                : "text-white/40 border border-transparent"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "all" && (
        <p className="px-4 mb-3 text-[10px] text-white/30 text-center">
          {tab === "lucky"
            ? "Wins with the lowest chance %"
            : "Biggest win amounts"}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-white/45 font-medium">No games yet</p>
          </div>
        ) : (
          filtered.map((h, i) => {
            const isServer = "rollId" in h && !("isMe" in h);
            const id = isServer
              ? (h as ServerItem).rollId
              : (h as HistoryItem).id;
            const winner = isServer
              ? (h as ServerItem).winner
              : (h as HistoryItem).winner;
            const chance = isServer
              ? (h as ServerItem).chance
              : (h as HistoryItem).chance;
            const amount = isServer
              ? (h as ServerItem).pot
              : (h as HistoryItem).isMe
                ? (h as HistoryItem).win
                : (h as HistoryItem).bet;
            const isMe = !isServer && (h as HistoryItem).isMe;
            const timeLabel = isServer
              ? (h as ServerItem).at
                ? formatTime(new Date((h as ServerItem).at!))
                : ""
              : formatTime((h as HistoryItem).time);

            return (
              <div
                key={`${id}-${i}`}
                role="button"
                onClick={() => setDetailRoll(id)}
                className={cn(
                  "rounded-2xl border p-3.5 fade-in cursor-pointer active:scale-[0.99] transition",
                  isMe
                    ? "bg-emerald-500/[0.06] border-emerald-500/15"
                    : "bg-white/[0.03] border-white/[0.06]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {isMe ? (
                        <span className="text-emerald-400">You won</span>
                      ) : (
                        <span className="text-white/70">
                          @{winner}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/30 mt-0.5 flex flex-wrap gap-x-1.5">
                      <span>SPIN #{id}</span>
                      <span>·</span>
                      <span>{chance}%</span>
                      {timeLabel && (
                        <>
                          <span>·</span>
                          <span>{timeLabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        isMe ? "text-emerald-400" : "text-white/70"
                      )}
                    >
                      {formatGram(amount)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <RoundDetailModal
        open={detailRoll != null}
        rollId={detailRoll}
        onClose={() => setDetailRoll(null)}
      />
    </div>
  );
}

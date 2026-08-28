"use client";

import { useMemo, useState } from "react";
import type { HistoryItem } from "@/lib/types";
import { formatGram, formatTime, cn } from "@/lib/utils";

interface HistoryScreenProps {
  history: HistoryItem[];
  onBack: () => void;
  onVerify?: (rollId: number) => void;
}

type HistTab = "all" | "lucky" | "top";

export function HistoryScreen({ history, onBack, onVerify }: HistoryScreenProps) {
  const [tab, setTab] = useState<HistTab>("all");

  const filtered = useMemo(() => {
    const wins = history.filter((h) => h.isMe);
    if (tab === "all") {
      return [...history].sort((a, b) => b.time.getTime() - a.time.getTime());
    }
    if (tab === "lucky") {
      // lowest win chance % among wins (luckiest)
      return [...wins].sort((a, b) => a.chance - b.chance);
    }
    // top — biggest win amount
    return [...wins].sort((a, b) => b.win - a.win);
  }, [history, tab]);

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
        <h2 className="text-base font-semibold tracking-tight">History</h2>
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-white/[0.07] flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
                <path d="M12 8v4l2.5 2.5" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <p className="text-sm text-white/45 font-medium">No games yet</p>
            <p className="text-xs text-white/25 mt-1.5 max-w-[240px] mx-auto leading-relaxed">
              Finish a round and your results will appear here.
            </p>
          </div>
        ) : (
          filtered.map((h, i) => {
            const rank = tab !== "all" ? i + 1 : null;
            return (
              <div
                key={`${h.id}-${h.bet}-${i}`}
                role="button"
                onClick={() => onVerify?.(h.id)}
                className={cn(
                  "rounded-2xl border p-3.5 fade-in cursor-pointer active:scale-[0.99] transition",
                  h.isMe
                    ? "bg-emerald-500/[0.06] border-emerald-500/15"
                    : "bg-white/[0.03] border-white/[0.06]"
                )}
                style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
              >
                <div className="flex items-center gap-3">
                  {rank !== null && (
                    <div
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0",
                        rank === 1
                          ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                          : rank === 2
                            ? "bg-white/10 text-white/70 border border-white/10"
                            : rank === 3
                              ? "bg-orange-500/15 text-orange-200 border border-orange-500/25"
                              : "bg-white/[0.04] text-white/40 border border-white/[0.06]"
                      )}
                    >
                      {rank}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {h.isMe ? (
                        <span className="text-emerald-400">You won</span>
                      ) : (
                        <span className="text-white/70">
                          Lost
                          <span className="text-white/35"> · @{h.winner}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/30 mt-0.5 flex flex-wrap gap-x-1.5">
                      <span>#{h.id}</span>
                      <span>·</span>
                      <span
                        className={cn(
                          tab === "lucky" && h.isMe && "text-violet-300"
                        )}
                      >
                        {h.chance}%
                      </span>
                      <span>·</span>
                      <span>{formatTime(h.time)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        h.isMe ? "text-emerald-400" : "text-white/45"
                      )}
                    >
                      {h.isMe ? "+" : "−"}
                      {formatGram(h.isMe ? h.win : h.bet)}
                    </div>
                    <div className="text-[10px] text-white/25 mt-0.5">
                      {h.isMe ? `×${h.mult}` : `bet ${formatGram(h.bet)}`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

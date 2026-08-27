"use client";

import { useState } from "react";
import type { HistoryItem, HistoryFilter } from "@/lib/types";
import { formatGram, formatTime, cn } from "@/lib/utils";

interface HistoryScreenProps {
  history: HistoryItem[];
  onBack: () => void;
}

export function HistoryScreen({ history, onBack }: HistoryScreenProps) {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const filtered = history.filter((h) => {
    if (filter === "wins") return h.isMe;
    if (filter === "my") return h.isMe;
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen pb-28 safe-top">
      <div className="flex items-center justify-between px-4 pt-3 pb-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/50 btn-press"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h2 className="text-base font-semibold tracking-tight">History</h2>
        <div className="w-9" />
      </div>

      <div className="flex gap-2 px-4 mb-4">
        {(
          [
            ["all", "All"],
            ["wins", "Wins"],
            ["my", "My bets"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all btn-press",
              filter === key
                ? "bg-white/10 text-white border border-white/10"
                : "text-white/40 hover:text-white/60"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/25">
                <path d="M12 8v4l2.5 2.5" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <p className="text-sm text-white/30">No games yet</p>
            <p className="text-xs text-white/20 mt-1">Your rounds will appear here</p>
          </div>
        ) : (
          filtered.map((h, i) => (
            <div
              key={`${h.id}-${i}`}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-3.5 fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {h.isMe ? (
                      <span className="text-emerald-400">You won</span>
                    ) : (
                      <span className="text-white/80">@{h.winner}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/30 mt-0.5">
                    {h.chance}% · Roll #{h.id} · {formatTime(h.time)}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      h.isMe ? "text-emerald-400" : "text-white/70"
                    )}
                  >
                    {h.isMe ? "+" : ""}
                    {formatGram(h.win)}
                  </div>
                  <div className="text-[10px] text-white/25 mt-0.5">
                    x{h.mult}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

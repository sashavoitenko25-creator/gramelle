"use client";

import { useState } from "react";
import type { HistoryItem, HistoryFilter } from "@/lib/types";
import { formatGram, cn } from "@/lib/utils";

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
    <div className="flex flex-col min-h-screen pb-20">
      <div className="flex items-center justify-between px-4 pt-3 pb-3">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60"
        >
          ←
        </button>
        <h2 className="text-base font-semibold">History</h2>
        <div className="w-8" />
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
              "px-3 py-1.5 rounded-full text-xs font-medium transition",
              filter === key
                ? "bg-[#2a2a3a] text-white"
                : "text-white/50 hover:text-white/70"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-white/30 text-sm py-12">
            No games yet
          </div>
        ) : (
          filtered.map((h, i) => (
            <div
              key={`${h.id}-${i}`}
              className="rounded-xl bg-[#16161f] border border-white/5 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {h.isMe ? (
                      <span className="text-emerald-400">You won</span>
                    ) : (
                      <span>@{h.winner}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    Chance {h.chance}% · Roll #{h.id}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      h.isMe ? "text-emerald-400" : "text-white/80"
                    )}
                  >
                    {h.isMe ? "+" : ""}
                    {formatGram(h.win)} GRAM
                  </div>
                  <div className="text-[11px] text-white/40">x{h.mult}</div>
                </div>
              </div>
              <div className="mt-2">
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 text-[11px] font-medium">
                  💎 {formatGram(h.bet)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

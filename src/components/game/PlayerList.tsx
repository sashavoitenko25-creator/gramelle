"use client";

import type { Player } from "@/lib/types";
import { formatGram } from "@/lib/utils";

interface PlayerListProps {
  players: Player[];
  total: number;
}

export function PlayerList({ players, total }: PlayerListProps) {
  if (players.length === 0) {
    return (
      <div className="text-center text-white/30 text-sm py-6">
        No players yet. Place a bet!
      </div>
    );
  }

  return (
    <div className="space-y-2 px-4">
      {players.map((p) => {
        const chance = total > 0 ? ((p.amount / total) * 100).toFixed(1) : "0";
        return (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-xl bg-[#16161f] border border-white/5 px-3 py-3 fade-in"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: p.color + "33", color: p.color }}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {p.isMe ? "You" : p.name}
                  {p.isMe && (
                    <span className="ml-1.5 text-[10px] text-cyan-400">you</span>
                  )}
                </div>
                <div className="text-[11px] text-white/40">{chance}% chance</div>
              </div>
            </div>
            <div className="text-sm font-semibold text-cyan-300 shrink-0">
              {formatGram(p.amount)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

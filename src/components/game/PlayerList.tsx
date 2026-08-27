"use client";

import type { Player } from "@/lib/types";
import { formatGram, cn } from "@/lib/utils";

interface PlayerListProps {
  players: Player[];
  total: number;
}

export function PlayerList({ players, total }: PlayerListProps) {
  if (players.length === 0) {
    return (
      <div className="mx-4 py-10 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/25">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
        </div>
        <p className="text-sm text-white/35">Waiting for players</p>
        <p className="text-xs text-white/20 mt-1.5 max-w-[220px] mx-auto leading-relaxed">
          Place a bet to join the round. Need at least 2 players to spin.
        </p>
      </div>
    );
  }

  if (players.length === 1) {
    return (
      <div className="space-y-2 px-4 pb-2">
        {players.map((p) => {
          const chance = total > 0 ? ((p.amount / total) * 100).toFixed(1) : "100.0";
          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center justify-between rounded-2xl px-3.5 py-3 border",
                p.isMe ? "bg-cyan-500/[0.07] border-cyan-500/20" : "bg-white/[0.03] border-white/[0.05]"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border border-white/10"
                  style={{
                    background: "linear-gradient(135deg, " + p.color + "44, " + p.color + "22)",
                    color: p.color,
                  }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {p.isMe ? "You" : p.name}
                    {p.isMe && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-cyan-400/80 bg-cyan-400/10 px-1.5 py-0.5 rounded-md">
                        you
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/35 mt-0.5">
                    {chance}% · waiting for opponent
                  </div>
                </div>
              </div>
              <div className="text-sm font-semibold text-cyan-300/90 shrink-0 tabular-nums">
                {formatGram(p.amount)}
              </div>
            </div>
          );
        })}
        <p className="text-center text-[11px] text-white/25 pt-2">
          Invite a friend or wait for another player
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-4 pb-2">
      {players.map((p, i) => {
        const chance = total > 0 ? ((p.amount / total) * 100).toFixed(1) : "0.0";
        return (
          <div
            key={p.id}
            className={cn(
              "flex items-center justify-between rounded-2xl px-3.5 py-3 fade-in border",
              p.isMe ? "bg-cyan-500/[0.07] border-cyan-500/20" : "bg-white/[0.03] border-white/[0.05]"
            )}
            style={{ animationDelay: i * 40 + "ms" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border border-white/10"
                style={{
                  background: "linear-gradient(135deg, " + p.color + "44, " + p.color + "22)",
                  color: p.color,
                }}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-1.5">
                  {p.isMe ? "You" : p.name}
                  {p.isMe && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-cyan-400/80 bg-cyan-400/10 px-1.5 py-0.5 rounded-md">
                      you
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-white/35 mt-0.5">{chance}% chance</div>
              </div>
            </div>
            <div className="text-sm font-semibold text-cyan-300/90 shrink-0 tabular-nums">
              {formatGram(p.amount)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

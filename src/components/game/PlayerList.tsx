"use client";

import type { Player } from "@/lib/types";
import { formatGram } from "@/lib/utils";

interface PlayerListProps {
  players: Player[];
  total: number;
}

function Avatar({
  name,
  photoUrl,
  color,
  size = 36,
}: {
  name: string;
  photoUrl?: string | null;
  color: string;
  size?: number;
}) {
  const letter = (name || "?").replace(/^@/, "").charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0 text-white font-semibold bg-white/10"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        boxShadow: `0 0 0 2px ${color}`,
      }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        letter
      )}
    </div>
  );
}

export function PlayerList({ players, total }: PlayerListProps) {
  if (!players.length) {
    return (
      <div className="mx-4 py-8 text-center">
        <p className="text-sm text-white/35">Waiting for players</p>
      </div>
    );
  }

  const sorted = [...players].sort((a, b) => b.amount - a.amount);

  return (
    <div className="mx-4 space-y-2">
      {sorted.map((p) => {
        const chance =
          p.chance != null
            ? Math.round(p.chance)
            : total > 0
              ? Math.round((p.amount / total) * 100)
              : 0;
        return (
          <div
            key={String(p.id)}
            className={
              p.isMe
                ? "flex items-center justify-between rounded-2xl px-3 py-2.5 bg-cyan-500/[0.07] border border-cyan-500/20"
                : "flex items-center justify-between rounded-2xl px-3 py-2.5 bg-white/[0.03] border border-white/[0.05]"
            }
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                name={p.name}
                photoUrl={p.photoUrl}
                color={p.color || "#22d3ee"}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-white/90 truncate flex items-center gap-1.5">
                  {p.isMe ? "You" : p.name}
                  {p.isMe && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-cyan-400/80 bg-cyan-400/10 px-1.5 py-0.5 rounded-md">
                      you
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-white/35 mt-0.5">
                  {chance}% chance
                </div>
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

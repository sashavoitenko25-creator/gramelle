"use client";

import { useEffect, useState } from "react";
import { formatGram, cn } from "@/lib/utils";

export interface RecentItem {
  rollId: number;
  mode: string;
  bank: number;
  pot: number;
  winner: string;
  chance: number;
  hasSeed: boolean;
}

interface Props {
  mode?: string;
  onVerify?: (rollId: number) => void;
}

export function RecentRounds({ mode, onVerify }: Props) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const q = mode ? `?mode=${mode}&limit=10` : "?limit=10";
        const res = await fetch(`/api/rounds/recent${q}`);
        const data = await res.json();
        if (alive && Array.isArray(data.items)) setItems(data.items);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [mode]);

  if (items.length === 0) return null;

  return (
    <div className="mx-4 mb-4">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <span className="text-[11px] text-white/35 uppercase tracking-[0.12em] font-medium">
          Recent
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {items.map((r) => (
          <button
            key={r.rollId}
            type="button"
            onClick={() => onVerify?.(r.rollId)}
            className={cn(
              "shrink-0 min-w-[132px] rounded-2xl px-3 py-2.5 border text-left transition btn-press",
              "bg-white/[0.03] border-white/[0.06] hover:border-cyan-500/25"
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] text-white/35 tabular-nums">
                #{r.rollId}
              </span>
              <span className="text-[9px] uppercase text-white/25">
                {r.mode}
              </span>
            </div>
            <div className="text-xs font-medium truncate text-white/80">
              @{r.winner}
            </div>
            <div className="text-[11px] text-cyan-300/80 tabular-nums mt-0.5">
              {formatGram(r.pot)} GRAM
              {r.chance > 0 && (
                <span className="text-white/30 ml-1">{r.chance}%</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

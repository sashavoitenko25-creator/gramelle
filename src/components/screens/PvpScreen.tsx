"use client";

import { Wheel } from "@/components/game/Wheel";
import { PlayerList } from "@/components/game/PlayerList";
import { TonIcon } from "@/components/ui/TonIcon";
import type { Player } from "@/lib/types";
import { formatGram, cn } from "@/lib/utils";
import { ROOMS, type RoomMode } from "@/lib/constants";

interface PvpScreenProps {
  players: Player[];
  balance: number;
  online: number;
  rollId: number;
  isSpinning: boolean;
  spinDegrees: number;
  status: string;
  mode: RoomMode;
  onModeChange: (m: RoomMode) => void;
  serverSeedHash?: string | null;
  onOpenBet: () => void;
  onOpenDeposit: () => void;
  onOpenHistory: () => void;
}

export function PvpScreen({
  players,
  balance,
  online,
  rollId,
  isSpinning,
  spinDegrees,
  status,
  mode,
  onModeChange,
  serverSeedHash,
  onOpenBet,
  onOpenDeposit,
}: PvpScreenProps) {
  const total = players.reduce((s, p) => s + p.amount, 0);
  const room = ROOMS[mode];

  return (
    <div className="flex flex-col min-h-screen pb-28 safe-top">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-white/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-300">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18M3 12h18" opacity="0.5" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Gramelle</div>
            <div className="text-[10px] text-white/35 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              {online > 0 ? `${online} in round` : "lobby"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-full px-3 py-1.5 border border-white/[0.06]">
          <span className="text-[10px] text-white/30 font-medium">#{rollId}</span>
        </div>
      </div>

      <div className="mx-4 mb-3 flex gap-2 p-1 rounded-2xl bg-black/30 border border-white/[0.06]">
        {(Object.keys(ROOMS) as RoomMode[]).map((id) => {
          const r = ROOMS[id];
          const active = mode === id;
          return (
            <button
              key={id}
              disabled={isSpinning}
              onClick={() => onModeChange(id)}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-semibold transition btn-press",
                active
                  ? id === "high"
                    ? "bg-amber-500/20 text-amber-200 border border-amber-500/25"
                    : "bg-white/10 text-white border border-white/10"
                  : "text-white/40 hover:text-white/60 border border-transparent"
              )}
            >
              {r.name}
              <span className="block text-[9px] font-normal opacity-60 mt-0.5">
                {r.minBet}+ GRAM
              </span>
            </button>
          );
        })}
      </div>

      <div className="mx-4 mt-1 mb-4 flex items-center justify-center">
        <div className="px-6 py-2.5 rounded-full glass border border-white/[0.08] flex items-center gap-2">
          <span className="text-[11px] text-white/40 uppercase tracking-widest">
            Bank
          </span>
          <span className="text-base font-semibold text-gradient-cyan tabular-nums">
            {formatGram(total)}
          </span>
          <span className="text-xs text-white/30">GRAM</span>
        </div>
      </div>

      <Wheel
        players={players}
        isSpinning={isSpinning}
        spinDegrees={spinDegrees}
        status={status}
      />

      {serverSeedHash && (
        <div className="mx-4 mb-2 text-center">
          <p className="text-[9px] text-white/20 font-mono truncate">
            hash {serverSeedHash.slice(0, 16)}…
          </p>
        </div>
      )}

      <div className="mx-4 mb-4 flex items-center gap-3">
        <div className="flex-1 flex items-center justify-between bg-white/[0.03] rounded-2xl px-4 py-3 border border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0098EA]/15 border border-[#0098EA]/25 flex items-center justify-center">
              <TonIcon size={18} />
            </div>
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">
                Balance
              </div>
              <div className="text-sm font-semibold tabular-nums flex items-center gap-1">
                {formatGram(balance)}
                <span className="text-[10px] text-white/35 font-medium">GRAM</span>
              </div>
            </div>
          </div>
          <button
            onClick={onOpenDeposit}
            className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 hover:bg-white/10 transition btn-press"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mx-4 mb-5">
        <button
          onClick={onOpenBet}
          disabled={isSpinning}
          className="w-full py-3.5 rounded-2xl btn-primary text-sm tracking-wide btn-press disabled:opacity-40"
        >
          Place Bet · {room.minBet}–{room.maxBet}
        </button>
        <p className="text-center text-[10px] text-white/20 mt-2">
          House edge {(room.houseEdge * 100).toFixed(0)}% · max {room.maxPlayers} players
        </p>
      </div>

      <div className="mx-4 mb-2 flex items-center justify-between">
        <span className="text-[11px] text-white/30 uppercase tracking-widest font-medium">
          Players · {players.length}
        </span>
      </div>

      <PlayerList players={players} total={total} />
    </div>
  );
}

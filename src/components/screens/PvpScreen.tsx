"use client";

import { Wheel } from "@/components/game/Wheel";
import { PlayerList } from "@/components/game/PlayerList";
import type { Player } from "@/lib/types";
import { formatGram } from "@/lib/utils";

interface PvpScreenProps {
  players: Player[];
  balance: number;
  online: number;
  rollId: number;
  isSpinning: boolean;
  spinDegrees: number;
  status: string;
  onOpenBet: () => void;
  onOpenDeposit: () => void;
  onOpenHistory: () => void;
  onClose?: () => void;
}

export function PvpScreen({
  players,
  balance,
  online,
  rollId,
  isSpinning,
  spinDegrees,
  status,
  onOpenBet,
  onOpenDeposit,
  onOpenHistory,
  onClose,
}: PvpScreenProps) {
  const total = players.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{online} online</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenHistory}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 transition text-sm"
          >
            ⏱
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tournament banner */}
      <div className="mx-4 mb-3">
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2.5 shadow-lg shadow-emerald-500/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-sm font-semibold text-white">
              USDT PvP Tournament
            </span>
          </div>
          <span className="text-white/80 text-lg">›</span>
        </div>
      </div>

      {/* Total bank */}
      <div className="mx-4 mb-4 flex items-center justify-center">
        <div className="px-5 py-2 rounded-full bg-[#16161f] border border-white/10">
          <span className="text-sm font-semibold tracking-wide">
            TOTAL{" "}
            <span className="text-cyan-300">{formatGram(total)} GRAM</span>
          </span>
        </div>
      </div>

      {/* Wheel */}
      <Wheel
        players={players}
        isSpinning={isSpinning}
        spinDegrees={spinDegrees}
        status={status}
      />

      {/* Balance row */}
      <div className="mx-4 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-[#16161f] rounded-full px-2 py-1 border border-white/5">
          <span className="text-xs text-white/40">#{rollId}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#16161f] rounded-full px-3 py-1.5 border border-white/5">
          <span className="text-cyan-300 text-sm">💎</span>
          <span className="text-sm font-medium">{formatGram(balance)}</span>
          <button
            onClick={onOpenDeposit}
            className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs ml-1"
          >
            +
          </button>
        </div>
      </div>

      {/* Bet button */}
      <div className="mx-4 mb-5">
        <button
          onClick={onOpenBet}
          disabled={isSpinning}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition"
        >
          💎 {formatGram(balance)} Gram — Place Bet
        </button>
      </div>

      {/* Players */}
      <div className="mx-4 mb-2 flex items-center justify-between">
        <span className="text-xs text-white/40 uppercase tracking-wide">
          Players ({players.length})
        </span>
      </div>
      <PlayerList players={players} total={total} />
    </div>
  );
}

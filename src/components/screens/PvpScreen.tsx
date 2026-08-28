"use client";

import { Wheel } from "@/components/game/Wheel";
import { PlayerList } from "@/components/game/PlayerList";
import { RecentRounds } from "@/components/game/RecentRounds";
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
  onOpenVerify?: () => void;
  onVerifyRoll?: (rollId: number) => void;
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
  onOpenVerify,
  onVerifyRoll,
}: PvpScreenProps) {
  const total = players.reduce((s, p) => s + p.amount, 0);
  const room = ROOMS[mode];

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500/35 to-cyan-500/25 border border-white/10 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.2)]">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-cyan-300"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18M3 12h18" opacity="0.45" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-tight leading-tight">
              Gramelle
            </div>
            <div className="text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              {online > 0 ? `${online} in round` : "lobby"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-full px-3 py-1.5 border border-white/[0.07]">
          <span className="text-[10px] text-white/35 font-medium tracking-wide">
            #{rollId}
          </span>
        </div>
      </div>

      {/* Rooms */}
      <div className="mx-4 mb-3 flex gap-1.5 p-1 rounded-2xl bg-black/35 border border-white/[0.06]">
        {(Object.keys(ROOMS) as RoomMode[]).map((id) => {
          const r = ROOMS[id];
          const active = mode === id;
          return (
            <button
              key={id}
              disabled={isSpinning}
              onClick={() => onModeChange(id)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold transition btn-press",
                active
                  ? id === "high"
                    ? "bg-amber-500/20 text-amber-100 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
                    : "bg-white/10 text-white border border-white/12"
                  : "text-white/40 hover:text-white/60 border border-transparent"
              )}
            >
              {r.name}
              <span className="block text-[9px] font-normal opacity-60 mt-0.5">
                from {r.minBet} GRAM
              </span>
            </button>
          );
        })}
      </div>

      {/* Bank */}
      <div className="mx-4 mt-1 mb-3 flex items-center justify-center">
        <div className="px-5 py-2.5 rounded-full glass border border-white/[0.09] flex items-center gap-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
          <span className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-medium">
            Bank
          </span>
          <span className="text-[17px] font-semibold text-gradient-cyan tabular-nums">
            {formatGram(total)}
          </span>
          <span className="text-[11px] text-white/35">GRAM</span>
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
          <button
            type="button"
            onClick={onOpenVerify}
            className="text-[9px] text-white/25 font-mono truncate tracking-tight hover:text-cyan-300/70 transition"
          >
            hash {serverSeedHash.slice(0, 18)}… · verify
          </button>
        </div>
      )}

      {/* Balance card */}
      <div className="mx-4 mb-4">
        <div className="flex items-center justify-between bg-white/[0.035] rounded-2xl px-4 py-3.5 border border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center shadow-[0_0_16px_rgba(0,152,234,0.15)]">
              <TonIcon size={18} />
            </div>
            <div>
              <div className="text-[10px] text-white/35 uppercase tracking-wider">
                Balance
              </div>
              <div className="text-[15px] font-semibold tabular-nums flex items-baseline gap-1.5 mt-0.5">
                {formatGram(balance)}
                <span className="text-[10px] text-white/35 font-medium">GRAM</span>
              </div>
            </div>
          </div>
          <button
            onClick={onOpenDeposit}
            className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white/65 hover:bg-white/10 transition btn-press"
            aria-label="Deposit"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* CTA */}
      <div className="mx-4 mb-5">
        <button
          onClick={onOpenBet}
          disabled={isSpinning}
          className="w-full py-3.5 rounded-2xl btn-primary text-[14px] tracking-wide btn-press disabled:opacity-40"
        >
          Place Bet · {room.minBet}–{room.maxBet}
        </button>
        <p className="text-center text-[10px] text-white/25 mt-2.5">
          House {(room.houseEdge * 100).toFixed(0)}% · up to {room.maxPlayers} players
        </p>
      </div>

      <RecentRounds mode={mode} onVerify={onVerifyRoll} />

      <div className="mx-4 mb-2 flex items-center justify-between">
        <span className="text-[11px] text-white/35 uppercase tracking-[0.12em] font-medium">
          Players · {players.length}
        </span>
      </div>

      <PlayerList players={players} total={total} />
    </div>
  );
}

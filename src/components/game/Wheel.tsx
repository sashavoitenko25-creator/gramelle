"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WheelProps {
  players: Player[];
  isSpinning: boolean;
  spinDegrees: number;
  status: string;
}

export function Wheel({ players, isSpinning, spinDegrees, status }: WheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  /** Freeze segment colors for the whole spin so polling cannot wipe the gradient */
  const frozenPlayers = useRef<Player[] | null>(null);

  useEffect(() => {
    if (isSpinning) {
      if (!frozenPlayers.current && players.length > 0) {
        frozenPlayers.current = players.map((p) => ({ ...p }));
      }
    } else {
      frozenPlayers.current = null;
    }
  }, [isSpinning, players]);

  const displayPlayers =
    isSpinning && frozenPlayers.current?.length
      ? frozenPlayers.current
      : players;

  const total = displayPlayers.reduce((s, p) => s + p.amount, 0);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;

    if (isSpinning && spinDegrees > 0) {
      el.style.transition = "none";
      el.style.transform = "rotate(0deg)";
      void el.offsetWidth;
      el.style.transition = "transform 4.2s cubic-bezier(0.12, 0.85, 0.15, 1)";
      el.style.transform = `rotate(${spinDegrees}deg)`;
    } else if (!isSpinning && spinDegrees === 0) {
      el.style.transition = "none";
      el.style.transform = "rotate(0deg)";
    }
  }, [isSpinning, spinDegrees]);

  const background = useMemo(() => {
    if (displayPlayers.length === 0 || total <= 0) return "";
    let acc = 0;
    const parts: string[] = [];
    displayPlayers.forEach((p) => {
      const pct = (p.amount / total) * 100;
      parts.push(`${p.color} ${acc}% ${acc + pct}%`);
      acc += pct;
    });
    return `conic-gradient(from 0deg, ${parts.join(", ")})`;
  }, [displayPlayers, total]);

  return (
    <div className="relative flex justify-center mb-4">
      <div className="relative w-[260px] h-[260px]">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
        </div>

        <div className="absolute inset-0 rounded-full border border-white/[0.07] pointer-events-none" />
        <div className="absolute inset-[3px] rounded-full border border-white/[0.03] pointer-events-none" />

        <div
          ref={wheelRef}
          className={cn(
            "w-full h-full rounded-full will-change-transform",
            displayPlayers.length === 0 ? "wheel-empty" : "wheel-glow"
          )}
          style={{
            background:
              displayPlayers.length === 0
                ? "linear-gradient(145deg, #1a1a24 0%, #0e0e16 100%)"
                : background,
          }}
        />

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[82px] h-[82px] rounded-full bg-[#07070b] border border-white/10 flex flex-col items-center justify-center z-10 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 mb-1 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 19c0-3.5 3-6 7-6s7 2.5 7 6" />
            </svg>
          </div>
          <span
            className={cn(
              "text-[10px] font-semibold tracking-wider uppercase",
              isSpinning ? "text-cyan-300 pulse-soft" : "text-white/45"
            )}
          >
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}

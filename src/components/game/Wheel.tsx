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
  const frozenPlayers = useRef<Player[] | null>(null);

  // Capture segments the moment spin starts (and keep until spin ends)
  if (isSpinning && !frozenPlayers.current && players.length > 0) {
    frozenPlayers.current = players.map((p) => ({ ...p }));
  }
  if (!isSpinning && frozenPlayers.current) {
    frozenPlayers.current = null;
  }

  const displayPlayers =
    isSpinning && frozenPlayers.current && frozenPlayers.current.length > 0
      ? frozenPlayers.current
      : players;

  const total = displayPlayers.reduce((s, p) => s + p.amount, 0);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;

    if (isSpinning && spinDegrees > 0) {
      el.style.transition = "none";
      el.style.transform = "rotate(0deg)";
      // force reflow
      void el.offsetWidth;
      el.style.transition = "transform 4.2s cubic-bezier(0.12, 0.85, 0.15, 1)";
      el.style.transform = `rotate(${spinDegrees}deg)`;
    } else if (!isSpinning) {
      el.style.transition = "none";
      el.style.transform = "rotate(0deg)";
    }
  }, [isSpinning, spinDegrees]);

  const background = useMemo(() => {
    if (displayPlayers.length === 0 || total <= 0) {
      return "conic-gradient(from 0deg, #1a1a28 0%, #12121c 50%, #1a1a28 100%)";
    }
    let acc = 0;
    const parts: string[] = [];
    displayPlayers.forEach((p) => {
      const pct = (p.amount / total) * 100;
      const next = acc + pct;
      parts.push(`${p.color} ${acc}% ${next}%`);
      acc = next;
    });
    return `conic-gradient(from -90deg, ${parts.join(", ")})`;
  }, [displayPlayers, total]);

  return (
    <div className="relative flex justify-center mb-5">
      <div className="relative w-[272px] h-[272px]">
        {/* soft ambient glow */}
        <div
          className="absolute inset-[-12px] rounded-full opacity-60 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)",
          }}
        />

        {/* Pointer */}
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[11px] border-r-[11px] border-t-[18px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]" />
        </div>

        {/* Rings */}
        <div className="absolute inset-0 rounded-full border border-white/[0.08] pointer-events-none z-20" />
        <div className="absolute inset-[4px] rounded-full border border-white/[0.04] pointer-events-none z-20" />

        {/* Wheel disk */}
        <div
          ref={wheelRef}
          className={cn(
            "w-full h-full rounded-full will-change-transform",
            displayPlayers.length === 0 ? "wheel-empty" : "wheel-glow"
          )}
          style={{ background }}
        />

        {/* Center hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[88px] h-[88px] rounded-full bg-[#08080e] border border-white/[0.12] flex flex-col items-center justify-center z-10 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/12 to-white/[0.03] border border-white/10 mb-1 flex items-center justify-center">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-white/55"
            >
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 19c0-3.5 3-6 7-6s7 2.5 7 6" />
            </svg>
          </div>
          <span
            className={cn(
              "text-[10px] font-semibold tracking-wider uppercase tabular-nums",
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

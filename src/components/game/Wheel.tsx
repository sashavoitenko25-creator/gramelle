"use client";

import { useEffect, useRef } from "react";
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
  const total = players.reduce((s, p) => s + p.amount, 0);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;

    if (isSpinning) {
      el.style.transition = "none";
      el.style.transform = "rotate(0deg)";
      // force reflow
      void el.offsetWidth;
      el.style.transition = "transform 4.2s cubic-bezier(0.12, 0.8, 0.2, 1)";
      el.style.transform = `rotate(${spinDegrees}deg)`;
    } else {
      el.style.transition = "none";
      el.style.transform = "rotate(0deg)";
    }
  }, [isSpinning, spinDegrees]);

  let background = "";
  if (players.length > 0 && total > 0) {
    let acc = 0;
    const parts: string[] = [];
    players.forEach((p) => {
      const pct = (p.amount / total) * 100;
      parts.push(`${p.color} ${acc}% ${acc + pct}%`);
      acc += pct;
    });
    background = `conic-gradient(${parts.join(", ")})`;
  }

  return (
    <div className="relative flex justify-center mb-5">
      <div className="relative w-[240px] h-[240px]">
        {/* Pointer */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 text-[22px] drop-shadow-md text-white">
          ▼
        </div>

        {/* Wheel */}
        <div
          ref={wheelRef}
          className={cn(
            "w-full h-full rounded-full wheel-glow",
            players.length === 0 && "wheel-empty"
          )}
          style={{
            background:
              players.length === 0
                ? "linear-gradient(145deg, #2a2a35, #1a1a24)"
                : background,
          }}
        />

        {/* Center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[78px] h-[78px] rounded-full bg-[#0a0a0f] border-2 border-white/10 flex flex-col items-center justify-center z-10">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 mb-1 flex items-center justify-center text-xs">
            👤
          </div>
          <span className="text-[11px] text-white/60 font-medium">{status}</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

interface ConfettiProps {
  active: boolean;
  durationMs?: number;
}

const COLORS = ["#22d3ee", "#a78bfa", "#f5c542", "#34d399", "#f472b6", "#60a5fa"];

export function Confetti({ active, durationMs = 2200 }: ConfettiProps) {
  const [pieces, setPieces] = useState<
    Array<{ id: number; left: number; delay: number; color: string; rot: number; size: number }>
  >([]);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }
    const next = Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      color: COLORS[i % COLORS.length],
      rot: Math.random() * 360,
      size: 6 + Math.random() * 8,
    }));
    setPieces(next);
    const t = setTimeout(() => setPieces([]), durationMs);
    return () => clearTimeout(t);
  }, [active, durationMs]);

  if (!pieces.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-0 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

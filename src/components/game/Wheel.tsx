"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WheelProps {
  players: Player[];
  isSpinning: boolean;
  spinDegrees: number;
  status: string;
  /** 0..1 countdown progress (0 = just started, 1 = done). null = no ring */
  countdownProgress?: number | null;
  /** seconds left for display */
  countdownSec?: number | null;
  countdownEndsAt?: string | null;
  countdownTotalSec?: number;
}

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 132;
const R_INNER = 52;
const AVATAR_R = R_OUTER * 0.72;
const RING_R = 46;
const RING_CIRC = 2 * Math.PI * RING_R;

function polar(cx: number, cy: number, r: number, deg: number) {
  // 0deg = top, clockwise (CSS conic style)
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number
) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const p0o = polar(cx, cy, r1, a0);
  const p1o = polar(cx, cy, r1, a1);
  const p1i = polar(cx, cy, r0, a1);
  const p0i = polar(cx, cy, r0, a0);
  return [
    `M ${p0o.x} ${p0o.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${p1o.x} ${p1o.y}`,
    `L ${p1i.x} ${p1i.y}`,
    `A ${r0} ${r0} 0 ${large} 0 ${p0i.x} ${p0i.y}`,
    "Z",
  ].join(" ");
}

export function Wheel({
  players,
  isSpinning,
  spinDegrees,
  status,
  countdownProgress = null,
  countdownSec = null,
  countdownEndsAt = null,
  countdownTotalSec = 20,
}: WheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const frozenPlayers = useRef<Player[] | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [smoothSec, setSmoothSec] = useState<number | null>(null);

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

  // Trigger soft reflow animation when player set / amounts change
  const fingerprint = displayPlayers
    .map((p) => `${p.telegramId ?? p.id}:${p.amount}`)
    .join("|");
  useEffect(() => {
    if (!isSpinning) setAnimKey((k) => k + 1);
  }, [fingerprint, isSpinning]);

  useEffect(() => {
    if (!countdownEndsAt || isSpinning) {
      setSmoothProgress(0);
      setSmoothSec(null);
      return;
    }
    const ends = new Date(countdownEndsAt).getTime();
    const totalMs = Math.max(1000, countdownTotalSec * 1000);
    let raf = 0;
    const tick = () => {
      const leftMs = ends - Date.now();
      if (leftMs <= 0) {
        setSmoothProgress(1);
        setSmoothSec(0);
        return;
      }
      const elapsed = totalMs - leftMs;
      setSmoothProgress(Math.min(1, Math.max(0, elapsed / totalMs)));
      setSmoothSec(Math.min(countdownTotalSec, Math.max(0, Math.ceil(leftMs / 1000))));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [countdownEndsAt, countdownTotalSec, isSpinning]);


  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    if (isSpinning && spinDegrees > 0) {
      el.style.transition = "none";
      el.style.transform = "rotate(0deg)";
      void el.offsetWidth;
      el.style.transition = "transform 4.2s cubic-bezier(0.12, 0.85, 0.15, 1)";
      el.style.transform = `rotate(${spinDegrees}deg)`;
    } else if (!isSpinning) {
      el.style.transition = "none";
      el.style.transform = "rotate(0deg)";
    }
  }, [isSpinning, spinDegrees]);

  const segments = useMemo(() => {
    if (displayPlayers.length === 0 || total <= 0) return [];
    let acc = 0;
    return displayPlayers.map((p) => {
      const share = p.amount / total;
      const start = acc * 360;
      const sweep = Math.max(share * 360, 0.4);
      acc += share;
      const mid = start + sweep / 2;
      const pos = polar(CX, CY, AVATAR_R, mid);
      return { player: p, start, sweep, mid, pos, share };
    });
  }, [displayPlayers, total]);

  const ringProgress =
    countdownEndsAt && !isSpinning
      ? smoothProgress
      : countdownProgress;
  const displaySec =
    countdownEndsAt && !isSpinning
      ? smoothSec
      : countdownSec;
  const showTimer =
    !isSpinning &&
    displaySec != null &&
    displaySec > 0 &&
    ringProgress != null;

  return (
    <div className="relative flex justify-center mb-4">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <div
          className="absolute inset-[-14px] rounded-full opacity-50 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 68%)",
          }}
        />

        {/* Pointer */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]" />
        </div>

        {/* Rotating wheel + avatars */}
        <div
          ref={wheelRef}
          className="absolute inset-0 will-change-transform"
          style={{ transformOrigin: "50% 50%" }}
        >
          <svg width={SIZE} height={SIZE} className="absolute inset-0">
            <defs>
              <filter id="segGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {segments.length === 0 ? (
              <circle
                cx={CX}
                cy={CY}
                r={R_OUTER}
                fill="#14141e"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            ) : (
              segments.map((s, i) => {
                const path =
                  s.sweep >= 359.5
                    ? undefined
                    : arcPath(CX, CY, R_INNER, R_OUTER, s.start, s.start + s.sweep);
                return s.sweep >= 359.5 ? (
                  <circle
                    key={`${s.player.id}-${animKey}-${i}`}
                    cx={CX}
                    cy={CY}
                    r={(R_OUTER + R_INNER) / 2}
                    fill="none"
                    stroke={s.player.color}
                    strokeWidth={R_OUTER - R_INNER}
                    className="wheel-seg-in"
                    style={{ animationDelay: `${i * 70}ms` }}
                  />
                ) : (
                  <path
                    key={`${s.player.id}-${animKey}-${i}`}
                    d={path}
                    fill={s.player.color}
                    className="wheel-seg-in"
                    style={{
                      animationDelay: `${i * 75}ms`,
                      filter: "url(#segGlow)",
                    }}
                  />
                );
              })
            )}
            {/* inner hole */}
            <circle cx={CX} cy={CY} r={R_INNER - 1} fill="#08080e" />
          </svg>

          {/* Avatars on segments (rotate with wheel) */}
          {segments.map((s) => {
            const letter = (s.player.name || "?").charAt(0).toUpperCase();
            const size = s.share > 0.25 ? 34 : s.share > 0.12 ? 28 : 22;
            return (
              <div
                key={`av-${s.player.id}`}
                className="absolute z-20 rounded-full border-2 border-white/80 shadow-[0_2px_12px_rgba(0,0,0,0.45)] overflow-hidden bg-[#1a1a24] flex items-center justify-center text-xs font-bold text-white/90 wheel-avatar-in"
                style={{
                  width: size,
                  height: size,
                  left: s.pos.x - size / 2,
                  top: s.pos.y - size / 2,
                  fontSize: size * 0.38,
                }}
                title={s.player.name}
              >
                {s.player.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.player.photoUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  letter
                )}
              </div>
            );
          })}
        </div>

        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border border-white/[0.08] pointer-events-none z-30" />

        {/* Center hub + timer ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center justify-center">
          <svg
            width={RING_R * 2 + 12}
            height={RING_R * 2 + 12}
            className="absolute"
          >
            <circle
              cx={RING_R + 6}
              cy={RING_R + 6}
              r={RING_R}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="3.5"
            />
            {showTimer && (
              <circle
                cx={RING_R + 6}
                cy={RING_R + 6}
                r={RING_R}
                fill="none"
                stroke="url(#timerGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={RING_CIRC * (1 - (ringProgress ?? 0))}
                transform={`rotate(-90 ${RING_R + 6} ${RING_R + 6})`}
              />
            )}
            <defs>
              <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>

          <div className="w-[84px] h-[84px] rounded-full bg-[#08080e] border border-white/[0.12] flex flex-col items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.7)]">
            {showTimer ? (
              <>
                <span className="text-[22px] font-semibold tabular-nums text-white leading-none tracking-tight">
                  {displaySec}
                </span>
                <span className="text-[9px] text-white/35 uppercase tracking-wider mt-1">
                  sec
                </span>
              </>
            ) : isSpinning ? (
              <span className="text-[11px] font-semibold tracking-wider uppercase text-cyan-300 pulse-soft px-1 text-center">
                {status || "Spinning"}
              </span>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/12 to-white/[0.03] border border-white/10 mb-1 flex items-center justify-center">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-white/50"
                  >
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 19c0-3.5 3-6 7-6s7 2.5 7 6" />
                  </svg>
                </div>
                <span className="text-[10px] font-semibold tracking-wider uppercase tabular-nums text-white/45">
                  {status}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

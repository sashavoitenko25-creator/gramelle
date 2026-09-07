"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "@/lib/types";
import { SPIN_DURATION_MS } from "@/lib/constants";

interface WheelProps {
  players: Player[];
  isSpinning: boolean;
  spinDegrees: number;
  status: string;
  countdownProgress?: number | null;
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

function WheelInner({
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

  const total = useMemo(
    () => displayPlayers.reduce((s, p) => s + p.amount, 0),
    [displayPlayers]
  );

  // Countdown: throttle UI updates (~5fps) instead of every RAF frame
  useEffect(() => {
    if (!countdownEndsAt || isSpinning) {
      setSmoothProgress(0);
      setSmoothSec(null);
      return;
    }
    const ends = new Date(countdownEndsAt).getTime();
    const totalMs = Math.max(1000, countdownTotalSec * 1000);
    let raf = 0;
    let lastUi = 0;
    const tick = (now: number) => {
      const leftMs = ends - Date.now();
      if (leftMs <= 0) {
        setSmoothProgress(1);
        setSmoothSec(0);
        return;
      }
      if (now - lastUi >= 200) {
        lastUi = now;
        const elapsed = totalMs - leftMs;
        setSmoothProgress(Math.min(1, Math.max(0, elapsed / totalMs)));
        setSmoothSec(
          Math.min(countdownTotalSec, Math.max(0, Math.ceil(leftMs / 1000)))
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [countdownEndsAt, countdownTotalSec, isSpinning]);

  // Pure CSS transform spin — GPU layer, no React updates during rotation
  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    const durSec = SPIN_DURATION_MS / 1000;
    if (isSpinning && spinDegrees > 0) {
      el.style.transition = "none";
      el.style.transform = "rotate3d(0,0,1,0deg)";
      // force reflow
      void el.offsetWidth;
      el.style.transition = `transform ${durSec}s cubic-bezier(0.05, 0.82, 0.08, 1)`;
      el.style.transform = `rotate3d(0,0,1,${spinDegrees}deg)`;
    } else if (!isSpinning) {
      el.style.transition = "none";
      el.style.transform = "rotate3d(0,0,1,0deg)";
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
    countdownEndsAt && !isSpinning ? smoothProgress : countdownProgress;
  const displaySec =
    countdownEndsAt && !isSpinning ? smoothSec : countdownSec;
  const showTimer =
    !isSpinning &&
    displaySec != null &&
    displaySec > 0 &&
    ringProgress != null;

  // Keep avatars while spinning (user request); cap only if very crowded
  const showAvatars = segments.length > 0;
  const avatarSegments =
    segments.length > 16 ? segments.filter((_, i) => i % 2 === 0) : segments;

  return (
    <div className="relative flex justify-center mb-4">
      <div
        className="relative"
        style={{ width: SIZE, height: SIZE, contain: "layout style" }}
      >
        {/* soft glow — static, no filter */}
        <div
          className="absolute inset-[-12px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)",
            opacity: isSpinning ? 0.35 : 0.5,
          }}
        />

        {/* Pointer — fixed, not rotating */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-white" />
        </div>

        {/* Rotating layer */}
        <div
          ref={wheelRef}
          className="absolute inset-0"
          style={{
            transformOrigin: "50% 50%",
            willChange: isSpinning ? "transform" : "auto",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "translateZ(0)",
          }}
        >
          <svg
            width={SIZE}
            height={SIZE}
            className="absolute inset-0"
            style={{ shapeRendering: isSpinning ? "optimizeSpeed" : "auto" }}
          >
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
                if (s.sweep >= 359.5) {
                  return (
                    <circle
                      key={String(s.player.id) + i}
                      cx={CX}
                      cy={CY}
                      r={(R_OUTER + R_INNER) / 2}
                      fill="none"
                      stroke={s.player.color}
                      strokeWidth={R_OUTER - R_INNER}
                    />
                  );
                }
                return (
                  <path
                    key={String(s.player.id) + i}
                    d={arcPath(
                      CX,
                      CY,
                      R_INNER,
                      R_OUTER,
                      s.start,
                      s.start + s.sweep
                    )}
                    fill={s.player.color}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth={1}
                  />
                );
              })
            )}
            <circle cx={CX} cy={CY} r={R_INNER - 1} fill="#08080e" />
            <circle
              cx={CX}
              cy={CY}
              r={R_OUTER}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1.5"
            />
          </svg>

          {showAvatars &&
            avatarSegments.map((s) => {
              const letter = (s.player.name || "?")
                .replace(/^@/, "")
                .charAt(0)
                .toUpperCase();
              const size = 28;
              return (
                <div
                  key={String(s.player.id)}
                  className="absolute z-20 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold text-white"
                  style={{
                    width: size,
                    height: size,
                    left: s.pos.x - size / 2,
                    top: s.pos.y - size / 2,
                    boxShadow: `0 0 0 2px ${s.player.color || "#22d3ee"}`,
                    background: s.player.photoUrl ? "transparent" : (s.player.color || "#333"),
                  }}
                >
                  {s.player.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.player.photoUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    letter
                  )}
                </div>
              );
            })}
        </div>

        {/* Static rim */}
        <div className="absolute inset-0 rounded-full border border-white/[0.08] pointer-events-none z-30" />

        {/* Center hub */}
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <svg width={(RING_R + 6) * 2} height={(RING_R + 6) * 2} className="absolute">
            {showTimer && (
              <circle
                cx={RING_R + 6}
                cy={RING_R + 6}
                r={RING_R}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={RING_CIRC * (1 - (ringProgress ?? 0))}
                transform={`rotate(-90 ${RING_R + 6} ${RING_R + 6})`}
                style={{ transition: "stroke-dashoffset 0.2s linear" }}
              />
            )}
          </svg>

          <div className="w-[84px] h-[84px] rounded-full bg-[#08080e] border border-white/[0.12] flex flex-col items-center justify-center">
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
              <span className="text-[11px] font-semibold tracking-wider uppercase text-cyan-300 px-1 text-center">
                {status || "Spinning"}
              </span>
            ) : players.length === 0 ? (
              <>
                <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 mb-1 flex items-center justify-center">
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
            ) : (
              <span className="text-[11px] font-semibold tracking-wider uppercase text-white/50 px-1 text-center">
                {status || "Waiting"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const Wheel = memo(WheelInner);

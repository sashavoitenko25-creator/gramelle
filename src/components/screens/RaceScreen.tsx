"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatGram } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { useTelegram } from "@/hooks/useTelegram";
import { RACE_MAPS, RACE_MIN_BALL } from "@/lib/raceConstants";
import {
  raceActive,
  raceBuy,
  raceCancel,
  raceCreate,
  raceHistory,
  raceProcess,
  type RaceRoomPublic,
} from "@/lib/raceApi";

interface RaceScreenProps {
  balance: number;
  telegramId: number;
  username: string;
  onBack: () => void;
  onBalanceUpdate: (b: number) => void;
  onReloadBalance: () => void;
  onDeposit?: () => void;
  haptic: (t?: "light" | "medium" | "heavy") => void;
  hapticSuccess: () => void;
  hapticError: () => void;
  showToast: (msg: string) => void;
}

type Phase = "lobby" | "lock" | "release" | "fall" | "finish";

type Peg = { x: number; y: number; r: number; kind: string };
type Wall = { x1: number; y1: number; x2: number; y2: number };

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function HashChip({
  label,
  value,
  onCopy,
}: {
  label: string;
  value?: string | null;
  onCopy: (v: string) => void;
}) {
  if (!value) return null;
  const short =
    value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/35 border border-white/10 text-[10px] font-mono text-cyan-200/85"
    >
      <span className="text-white/35 uppercase tracking-wider">{label}</span>
      {short}
    </button>
  );
}

function buildTrack(mapId: string | null, W: number, H: number, ringY: number) {
  const map = RACE_MAPS.find((m) => m.id === mapId) || RACE_MAPS[0];
  const segs = map.segments;
  const trackTop = ringY + 55;
  const trackBot = H * 0.88;
  const segH = (trackBot - trackTop) / segs.length;
  const pegs: Peg[] = [];
  const walls: Wall[] = [];
  const leftX = W * 0.1;
  const rightX = W * 0.9;

  walls.push(
    { x1: leftX, y1: trackTop, x2: leftX, y2: trackBot },
    { x1: rightX, y1: trackTop, x2: rightX, y2: trackBot }
  );

  segs.forEach((kind, si) => {
    const y0 = trackTop + si * segH;
    const y1 = y0 + segH;

    if (kind === "pegs" || kind === "sieve") {
      const rows = kind === "sieve" ? 5 : 4;
      for (let r = 0; r < rows; r++) {
        const cols = 5 + (r % 2);
        const yy = y0 + 16 + (r / Math.max(rows - 1, 1)) * (segH - 26);
        for (let c = 0; c < cols; c++) {
          const u = cols === 1 ? 0.5 : c / (cols - 1);
          const inset = 0.14 + (r % 2) * 0.035;
          pegs.push({
            x: W * (inset + u * (1 - 2 * inset)),
            y: yy,
            r: kind === "sieve" ? 3.2 : 4.5,
            kind,
          });
        }
      }
    } else if (kind === "bumpers") {
      for (let i = 0; i < 5; i++) {
        pegs.push({
          x: W * (0.2 + ((i + 0.5) / 5) * 0.6),
          y: y0 + segH * (0.28 + (i % 2) * 0.38),
          r: 8,
          kind: "bumper",
        });
      }
    } else if (kind === "funnel") {
      walls.push(
        { x1: leftX, y1: y0 + 4, x2: W * 0.4, y2: y1 - 6 },
        { x1: rightX, y1: y0 + 4, x2: W * 0.6, y2: y1 - 6 }
      );
    } else if (kind === "lanes") {
      for (let i = 1; i <= 3; i++) {
        const x = W * (0.25 * i);
        walls.push({ x1: x, y1: y0 + 4, x2: x, y2: y1 - 4 });
      }
    } else if (kind === "zigzag") {
      walls.push(
        { x1: leftX + 4, y1: y0 + 8, x2: W * 0.58, y2: y0 + segH * 0.48 },
        {
          x1: rightX - 4,
          y1: y0 + segH * 0.42,
          x2: W * 0.42,
          y2: y0 + segH * 0.88,
        }
      );
    } else if (kind === "tunnel") {
      walls.push(
        { x1: W * 0.28, y1: y0 + 4, x2: W * 0.28, y2: y1 - 4 },
        { x1: W * 0.72, y1: y0 + 4, x2: W * 0.72, y2: y1 - 4 }
      );
    } else if (kind === "ramps") {
      walls.push(
        {
          x1: leftX,
          y1: y0 + segH * 0.15,
          x2: W * 0.48,
          y2: y0 + segH * 0.55,
        },
        {
          x1: rightX,
          y1: y0 + segH * 0.3,
          x2: W * 0.52,
          y2: y0 + segH * 0.78,
        }
      );
    } else if (kind === "cross") {
      // blue X / plus obstacles like in @myballs
      for (let i = 0; i < 3; i++) {
        const cx = W * (0.25 + i * 0.25);
        const cy = y0 + segH * (0.35 + (i % 2) * 0.25);
        const arm = Math.min(28, segH * 0.28);
        walls.push(
          { x1: cx - arm, y1: cy, x2: cx + arm, y2: cy },
          { x1: cx, y1: cy - arm, x2: cx, y2: cy + arm }
        );
        pegs.push({ x: cx, y: cy, r: 6, kind: "cross" });
      }
    } else if (kind === "dots") {
      // grid of blue dots
      const rows = 4;
      const cols = 7;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          pegs.push({
            x: W * (0.14 + (c / (cols - 1)) * 0.72),
            y: y0 + 12 + (r / Math.max(rows - 1, 1)) * (segH - 24),
            r: 2.8,
            kind: "dot",
          });
        }
      }
    } else if (kind === "arcs") {
      // large incomplete circles (visual + soft bumpers)
      for (let i = 0; i < 2; i++) {
        const cx = W * (0.32 + i * 0.36);
        const cy = y0 + segH * 0.5;
        const rr = Math.min(42, segH * 0.38);
        pegs.push({ x: cx, y: cy, r: rr * 0.35, kind: "arc" });
        // soft ring points
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 1.6 - 0.3;
          pegs.push({
            x: cx + Math.cos(ang) * rr,
            y: cy + Math.sin(ang) * rr,
            r: 3.5,
            kind: "arc_edge",
          });
        }
      }
    } else if (kind === "bomb") {
      // bomb hazards (visual skull + bounce)
      for (let i = 0; i < 2; i++) {
        pegs.push({
          x: W * (0.35 + i * 0.3),
          y: y0 + segH * (0.4 + (i % 2) * 0.2),
          r: 14,
          kind: "bomb",
        });
      }
    } else if (kind === "antigrav") {
      // upward force zone (visual only in sim; path still deterministic)
      pegs.push({
        x: W * 0.5,
        y: y0 + segH * 0.5,
        r: 40,
        kind: "antigrav",
      });
    } else if (kind === "platforms") {
      // horizontal blue platforms with gaps (like video numbered zones)
      const levels = 3;
      for (let lv = 0; lv < levels; lv++) {
        const yy = y0 + 10 + (lv / (levels - 1 || 1)) * (segH - 20);
        const gapSide = lv % 2 === 0 ? "left" : "right";
        if (gapSide === "left") {
          walls.push({ x1: W * 0.42, y1: yy, x2: rightX - 4, y2: yy });
        } else {
          walls.push({ x1: leftX + 4, y1: yy, x2: W * 0.58, y2: yy });
        }
      }
    }
  });

  return { map, pegs, walls, trackTop, trackBot, leftX, rightX };
}

function simulatePath(
  ballId: string,
  seat: number,
  W: number,
  ringY: number,
  trackBot: number,
  leftX: number,
  rightX: number,
  pegs: Peg[],
  walls: Wall[]
): { x: number; y: number }[] {
  const seed = hash01(ballId + ":" + seat);
  const R = 7;
  // drop through top hole
  let x = W * 0.5 + (seed - 0.5) * 28;
  let y = ringY;
  let vx = (seed - 0.5) * 3.2 + ((seat % 5) - 2) * 0.55;
  let vy = 2.4 + seed * 0.8;
  const g = 0.38;
  const points: { x: number; y: number }[] = [{ x, y }];

  for (let step = 0; step < 900; step++) {
    vy += g;
    x += vx;
    y += vy;

    if (x - R < leftX) {
      x = leftX + R;
      vx = Math.abs(vx) * 0.72;
    }
    if (x + R > rightX) {
      x = rightX - R;
      vx = -Math.abs(vx) * 0.72;
    }

    for (const w of walls) {
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const t = Math.max(
        0,
        Math.min(1, ((x - w.x1) * dx + (y - w.y1) * dy) / (len * len))
      );
      const px = w.x1 + t * dx;
      const py = w.y1 + t * dy;
      const dist = Math.hypot(x - px, y - py);
      if (dist < R + 1.5 && t > 0.02 && t < 0.98) {
        const overlap = R + 1.5 - dist;
        x += (x - px) * 0.2 + nx * overlap * 0.3;
        y += (y - py) * 0.1;
        const dot = vx * nx + vy * ny;
        vx -= 1.6 * dot * nx;
        vy -= 1.6 * dot * ny;
        vx *= 0.9;
        vy *= 0.9;
      }
    }

    for (const p of pegs) {
      const dx = x - p.x;
      const dy = y - p.y;
      const dist = Math.hypot(dx, dy);
      const minD = R + p.r;
      if (dist < minD && dist > 0.01) {
        const nx = dx / dist;
        const ny = dy / dist;
        x = p.x + nx * minD;
        y = p.y + ny * minD;
        const dot = vx * nx + vy * ny;
        if (dot < 0) {
          vx -= 1.85 * dot * nx;
          vy -= 1.85 * dot * ny;
        }
        const bounce =
          p.kind === "bumper" || p.kind === "bomb"
            ? 0.78
            : p.kind === "cross"
              ? 0.65
              : 0.55;
        vx *= bounce;
        vy *= bounce;
        vx += (seed - 0.5) * 0.15;
      }
    }

    if (y > trackBot - 4) {
      y = trackBot - 4;
      points.push({ x, y });
      break;
    }

    if (step % 2 === 0) points.push({ x, y });
    if (vy > 8.5) vy = 8.5;
    if (Math.abs(vx) > 5) vx *= 0.96;
  }

  return points.length > 2
    ? points
    : [
        { x: W / 2, y: ringY },
        { x: W / 2, y: trackBot },
      ];
}

function samplePath(
  path: { x: number; y: number }[],
  t: number,
  rank: number,
  total: number
) {
  const bias = (rank - 1) / Math.max(total, 1);
  const tt = Math.min(1, Math.max(0, t * (1.05 - bias * 0.35) - bias * 0.05));
  if (path.length < 2) return path[0] || { x: 0, y: 0 };
  const f = tt * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(f));
  const u = f - i;
  return {
    x: path[i].x + (path[i + 1].x - path[i].x) * u,
    y: path[i].y + (path[i + 1].y - path[i].y) * u,
  };
}

function AvatarBall({
  cx,
  cy,
  r,
  username,
  photoUrl,
  highlight,
}: {
  cx: number;
  cy: number;
  r: number;
  username: string;
  photoUrl: string | null;
  highlight?: boolean;
}) {
  const initial = (username || "?").replace(/^@/, "").charAt(0).toUpperCase();
  const clipId = `av-${cx.toFixed(1)}-${cy.toFixed(1)}-${r}`;
  return (
    <g>
      {highlight && (
        <circle
          cx={cx}
          cy={cy}
          r={r + 5}
          fill="none"
          stroke="rgba(34,211,238,0.4)"
          strokeWidth="1.2"
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={r + 1.3}
        fill="#0c0c12"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1.2"
      />
      {photoUrl ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle cx={cx} cy={cy} r={r} />
            </clipPath>
          </defs>
          <image
            href={photoUrl}
            x={cx - r}
            y={cy - r}
            width={r * 2}
            height={r * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <>
          <circle cx={cx} cy={cy} r={r} fill="#1e293b" />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#e2e8f0"
            fontSize={r}
            fontWeight="700"
          >
            {initial}
          </text>
        </>
      )}
    </g>
  );
}



type SimBall = {
  id: string;
  username: string;
  photoUrl: string | null;
  telegramId: number;
  seat: number;
  finishRank: number | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

function RaceStage({
  room,
  phase,
  followBallId,
  telegramId,
  fallProgress,
}: {
  room: RaceRoomPublic | null;
  phase: Phase;
  followBallId: string | null;
  telegramId: number;
  fallProgress: number;
}) {
  const ballsMeta = room?.balls || [];
  const mapId = room?.mapId || null;

  const W = 320;
  const H = 560;
  const isLobby = phase === "lobby" || phase === "lock";
  const holeOpen =
    phase === "release" || phase === "fall" || phase === "finish";

  const ringY = isLobby ? H * 0.5 : H * 0.18;
  const ringR = isLobby ? 118 : 86;
  // hole closed in lobby; opens after timer
  const holeHalfDeg = holeOpen ? 48 : 0;

  const track = useMemo(() => buildTrack(mapId, W, H, H * 0.18), [mapId]);

  const [sim, setSim] = useState<SimBall[]>([]);
  const simRef = useRef<SimBall[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // sync new balls into simulation (spawn above ring, fall in)
  useEffect(() => {
    const prev = simRef.current;
    const byId = new Map(prev.map((b) => [b.id, b]));
    const next: SimBall[] = [];
    ballsMeta.forEach((b, i) => {
      const old = byId.get(b.id);
      if (old) {
        next.push({
          ...old,
          username: b.username,
          photoUrl: b.photoUrl,
          telegramId: b.telegramId,
          seat: b.seat,
          finishRank: b.finishRank,
        });
      } else {
        const seed = hash01(b.id);
        // spawn slightly above / inside ring
        const ang = seed * Math.PI * 2;
        next.push({
          id: b.id,
          username: b.username,
          photoUrl: b.photoUrl,
          telegramId: b.telegramId,
          seat: b.seat,
          finishRank: b.finishRank,
          x: W / 2 + Math.cos(ang) * (ringR * 0.25 * seed),
          y: ringY - ringR * 0.55 - seed * 12,
          vx: (seed - 0.5) * 2.5,
          vy: 0.5 + seed,
          r: 9,
        });
      }
    });
    simRef.current = next;
    setSim(next);
  }, [ballsMeta.map((b) => b.id).join("|"), ringY, ringR]);

  // live physics loop (lobby + release until they escape)
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const g = 0.35;
    const damp = 0.995;
    const wallRest = 0.78;
    const ballRest = 0.85;

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 16.67);
      last = now;
      const ph = phaseRef.current;
      const open = ph === "release" || ph === "fall" || ph === "finish";
      const onTrack = ph === "fall" || ph === "finish";

      // during fall/finish track animation is driven by fallProgress paths — still update lobby/release
      if (onTrack) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const cx = W / 2;
      const cy = ringY;
      const hole = open ? (48 * Math.PI) / 180 : 0;
      const balls = simRef.current.map((b) => ({ ...b }));

      for (const b of balls) {
        b.vy += g * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vx *= damp;
        b.vy *= Math.min(1, damp + 0.001);

        // containment circle (ring inner wall)
        const dx = b.x - cx;
        const dy = b.y - cy;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const maxD = ringR - b.r - 2;
        const ang = Math.atan2(dy, dx);
        // angle from top: 0 at top going clockwise... atan2: top is -PI/2
        const fromTop = Math.abs(((ang + Math.PI / 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        // simpler: hole around angle -PI/2
        let inHole = false;
        if (open) {
          const a = Math.atan2(dy, dx);
          // hole at bottom so gravity carries balls out
          const bottom = Math.PI / 2;
          let dA = a - bottom;
          while (dA > Math.PI) dA -= Math.PI * 2;
          while (dA < -Math.PI) dA += Math.PI * 2;
          inHole = Math.abs(dA) < hole / 2 && dist > maxD * 0.7;
        }

        if (dist > maxD && !inHole) {
          const nx = dx / dist;
          const ny = dy / dist;
          b.x = cx + nx * maxD;
          b.y = cy + ny * maxD;
          const vn = b.vx * nx + b.vy * ny;
          if (vn > 0) {
            b.vx -= (1 + wallRest) * vn * nx;
            b.vy -= (1 + wallRest) * vn * ny;
          }
          // friction along tangent
          b.vx *= 0.98;
          b.vy *= 0.98;
        }

        // floor of view soft clamp when still in ring area
        if (!open && b.y > cy + maxD) {
          b.y = cy + maxD;
          if (b.vy > 0) b.vy *= -wallRest;
        }
      }

      // ball-ball collisions
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i];
          const b = balls[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minD = a.r + b.r;
          if (dist < minD) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minD - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
            const va = a.vx * nx + a.vy * ny;
            const vb = b.vx * nx + b.vy * ny;
            const imp = ((1 + ballRest) * (va - vb)) / 2;
            a.vx -= imp * nx;
            a.vy -= imp * ny;
            b.vx += imp * nx;
            b.vy += imp * ny;
          }
        }
      }

      simRef.current = balls;
      setSim(balls.map((b) => ({ ...b })));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ringY, ringR]);

  // fall paths after escape
  const paths = useMemo(() => {
    const map: Record<string, { x: number; y: number }[]> = {};
    for (const b of ballsMeta) {
      map[b.id] = simulatePath(
        b.id,
        b.seat,
        W,
        H * 0.18 - 70,
        track.trackBot,
        track.leftX,
        track.rightX,
        track.pegs,
        track.walls
      );
    }
    return map;
  }, [ballsMeta, track]);

  const camY = isLobby ? 0 : phase === "release" ? 4 : 12 + fallProgress * 85;
  const camScale = isLobby
    ? 1.32
    : phase === "release"
      ? 0.96
      : 0.8 - fallProgress * 0.05;
  const accent = track.map.accent;

  const holeRad = (holeHalfDeg * Math.PI) / 180;
  // gap at bottom (PI/2)
  const arcStart = Math.PI / 2 + Math.max(holeRad, 0.02);
  const arcEnd = Math.PI / 2 - Math.max(holeRad, 0.02) + Math.PI * 2;
  const ringPath = useMemo(() => {
    if (holeHalfDeg < 1) {
      // full closed circle
      return `M ${W / 2 - ringR} ${ringY} A ${ringR} ${ringR} 0 1 1 ${W / 2 + ringR} ${ringY} A ${ringR} ${ringR} 0 1 1 ${W / 2 - ringR} ${ringY}`;
    }
    const x0 = W / 2 + Math.cos(arcStart) * ringR;
    const y0 = ringY + Math.sin(arcStart) * ringR;
    const x1 = W / 2 + Math.cos(arcEnd) * ringR;
    const y1 = ringY + Math.sin(arcEnd) * ringR;
    return `M ${x0} ${y0} A ${ringR} ${ringR} 0 1 1 ${x1} ${y1}`;
  }, [ringR, ringY, holeHalfDeg, arcStart, arcEnd]);

  return (
    <div className="relative w-full overflow-hidden rounded-[28px] border border-white/[0.1] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <div
        className={cn(
          "relative bg-[#05050a] will-change-transform overflow-hidden",
          isLobby ? "aspect-square" : "aspect-[3/4.4]"
        )}
        style={{
          transform: `scale(${camScale}) translateY(${camY}px)`,
          transformOrigin: isLobby ? "50% 50%" : "50% 12%",
          transition:
            phase === "fall" || phase === "finish"
              ? "transform 80ms linear"
              : "transform 1.1s cubic-bezier(.22,.8,.2,1)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1020] via-[#070712] to-[#030308]" />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% ${isLobby ? "50%" : "8%"}, ${accent}22, transparent 60%)`,
          }}
        />

        {(phase === "release" || phase === "fall" || phase === "finish") && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-black/50 border border-white/10 text-[10px] font-semibold text-white/65">
            {track.map.name.ru}
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="ringStroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.55" />
            </linearGradient>
            <pattern
              id="checkFinish"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="#f4f4f5" />
              <rect x="6" y="0" width="6" height="6" fill="#18181b" />
              <rect x="0" y="6" width="6" height="6" fill="#18181b" />
              <rect x="6" y="6" width="6" height="6" fill="#f4f4f5" />
            </pattern>
            <radialGradient id="antiGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
            </radialGradient>
          </defs>

          {!isLobby &&
            track.walls.map((w, i) => (
              <line
                key={`w-${i}`}
                x1={w.x1}
                y1={w.y1}
                x2={w.x2}
                y2={w.y2}
                stroke={`${accent}99`}
                strokeWidth="4"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 4px " + accent + "88)" }}
              />
            ))}

          {!isLobby &&
            track.pegs.map((pg, i) => {
              if (pg.kind === "bomb") {
                return (
                  <g key={`p-${i}`}>
                    <circle
                      cx={pg.x}
                      cy={pg.y}
                      r={pg.r}
                      fill="#1a1a22"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                    />
                    <text
                      x={pg.x}
                      y={pg.y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={pg.r * 1.1}
                    >
                      💣
                    </text>
                  </g>
                );
              }
              if (pg.kind === "arc") {
                return (
                  <circle
                    key={`p-${i}`}
                    cx={pg.x}
                    cy={pg.y}
                    r={pg.r * 2.2}
                    fill="none"
                    stroke={`${accent}cc`}
                    strokeWidth="4"
                    strokeDasharray="40 18"
                    opacity="0.85"
                  />
                );
              }
              if (pg.kind === "arc_edge") {
                return (
                  <circle
                    key={`p-${i}`}
                    cx={pg.x}
                    cy={pg.y}
                    r={pg.r}
                    fill={`${accent}55`}
                    stroke={`${accent}aa`}
                    strokeWidth="0.8"
                  />
                );
              }
              if (pg.kind === "antigrav") {
                return (
                  <g key={`p-${i}`} opacity="0.55">
                    <circle
                      cx={pg.x}
                      cy={pg.y}
                      r={pg.r}
                      fill="url(#antiGrad)"
                      stroke="#a78bfa"
                      strokeWidth="1.2"
                      strokeDasharray="6 4"
                    />
                    <text
                      x={pg.x}
                      y={pg.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#c4b5fd"
                      fontSize="9"
                      fontWeight="700"
                    >
                      ↑
                    </text>
                  </g>
                );
              }
              if (pg.kind === "cross") {
                return (
                  <circle
                    key={`p-${i}`}
                    cx={pg.x}
                    cy={pg.y}
                    r={pg.r}
                    fill={`${accent}66`}
                    stroke={`${accent}`}
                    strokeWidth="1.2"
                  />
                );
              }
              if (pg.kind === "dot") {
                return (
                  <circle
                    key={`p-${i}`}
                    cx={pg.x}
                    cy={pg.y}
                    r={pg.r}
                    fill="#38bdf8"
                    opacity="0.75"
                  />
                );
              }
              return (
                <circle
                  key={`p-${i}`}
                  cx={pg.x}
                  cy={pg.y}
                  r={pg.r}
                  fill={
                    pg.kind === "bumper" ? `${accent}88` : "rgba(255,255,255,0.2)"
                  }
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.6"
                />
              );
            })}

          {/* ring: closed in lobby, gap opens after timer */}
          <path
            d={ringPath}
            fill="none"
            stroke="url(#ringStroke)"
            strokeWidth={isLobby ? 5 : 3.5}
            strokeLinecap="round"
            opacity="0.95"
          />
          {holeOpen && (
            <>
              <circle
                cx={W / 2 + Math.cos(arcStart) * ringR}
                cy={ringY + Math.sin(arcStart) * ringR}
                r={3.5}
                fill="rgba(255,255,255,0.4)"
              />
              <circle
                cx={W / 2 + Math.cos(arcEnd) * ringR}
                cy={ringY + Math.sin(arcEnd) * ringR}
                r={3.5}
                fill="rgba(255,255,255,0.4)"
              />
            </>
          )}

          {/* physics-driven balls in lobby / release */}
          {(phase === "lobby" || phase === "lock" || phase === "release") &&
            sim.map((b) => {
              const isFollow =
                b.id === followBallId || b.telegramId === telegramId;
              return (
                <AvatarBall
                  key={b.id}
                  cx={b.x}
                  cy={b.y}
                  r={isFollow ? 11 : 9}
                  username={b.username}
                  photoUrl={b.photoUrl}
                  highlight={isFollow}
                />
              );
            })}

          {/* track fall */}
          {(phase === "fall" || phase === "finish") &&
            ballsMeta.map((b, i) => {
              const rank = b.finishRank ?? i + 1;
              const isFollow =
                b.id === followBallId || b.telegramId === telegramId;
              const path = paths[b.id] || [];
              const pos = samplePath(path, fallProgress, rank, ballsMeta.length);
              const holeX = W / 2 + (hash01(b.id) - 0.5) * 28;
              const holeY = H * 0.18 - 70;
              const finY = track.trackBot;
              const bias = (rank - 1) / Math.max(ballsMeta.length, 1);
              const tt = Math.min(
                1,
                Math.max(0, fallProgress * (1.1 - bias * 0.4) - bias * 0.04)
              );
              const ease = tt * tt * (3 - 2 * tt);
              const cx =
                path.length > 4
                  ? pos.x
                  : holeX + Math.sin(tt * 9 + i) * 20 * (1 - tt);
              const cy = path.length > 4 ? pos.y : holeY + (finY - holeY) * ease;
              return (
                <AvatarBall
                  key={b.id}
                  cx={cx}
                  cy={cy}
                  r={isFollow ? 9 : 7.5}
                  username={b.username}
                  photoUrl={b.photoUrl}
                  highlight={isFollow}
                />
              );
            })}

          {!isLobby && (
            <g>
              <rect
                x={22}
                y={H * 0.9}
                width={W - 44}
                height={22}
                rx={4}
                fill="url(#checkFinish)"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
              />
              <text
                x={W / 2}
                y={H * 0.9 + 15}
                textAnchor="middle"
                fill="rgba(0,0,0,0.55)"
                fontSize="9"
                fontWeight="800"
                letterSpacing="2"
              >
                FINISH
              </text>
            </g>
          )}
        </svg>

        {ballsMeta.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-8">
            <div className="text-center text-[13px] text-white/40 leading-relaxed">
              Купи шарик — он попадёт в круг и будет толкаться с другими.
              <br />
              После таймера внизу круга откроется дырка и шарики упадут на трассу.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BalancePill({
  balance,
  onDeposit,
  haptic,
}: {
  balance: number;
  onDeposit?: () => void;
  haptic: (t?: "light" | "medium" | "heavy") => void;
}) {
  return (
    <div className="flex items-center h-9 rounded-full glass border border-white/[0.12] overflow-hidden shrink-0">
      <div className="flex items-center gap-1.5 pl-3 pr-2">
        <span className="text-[13px] font-semibold tabular-nums text-gradient-cyan">
          {formatGram(balance)}
        </span>
        <span className="text-[10px] text-white/35 font-medium">GRAM</span>
      </div>
      {onDeposit && (
        <button
          type="button"
          onClick={() => {
            haptic("light");
            onDeposit();
          }}
          className="h-full px-2.5 flex items-center justify-center text-cyan-200/90 border-l border-white/[0.1] btn-press"
          aria-label="Deposit"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function RaceScreen({
  balance,
  telegramId,
  onBack,
  onBalanceUpdate,
  onReloadBalance,
  onDeposit,
  haptic,
  hapticSuccess,
  hapticError,
  showToast,
}: RaceScreenProps) {
  const { t, lang } = useI18n();
  const { setBackButton } = useTelegram();
  const tr = (en: string, ru: string) => (lang === "ru" ? ru : en);

  const [room, setRoom] = useState<RaceRoomPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [history, setHistory] = useState<
    Awaited<ReturnType<typeof raceHistory>>["items"]
  >([]);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [fallProgress, setFallProgress] = useState(0);
  const animKey = useRef("");
  const fallRaf = useRef<number | null>(null);

  const followBallId = useMemo(() => {
    if (!room) return null;
    const mine = room.balls.filter((b) => b.telegramId === telegramId);
    if (!mine.length) return room.balls[0]?.id ?? null;
    const ranked = [...mine].sort(
      (a, b) => (a.finishRank ?? 99) - (b.finishRank ?? 99)
    );
    return ranked[0].id;
  }, [room, telegramId]);

  const copyText = useCallback(
    (v: string) => {
      void navigator.clipboard?.writeText(v);
      haptic("light");
      showToast(tr("Copied", "Скопировано"));
    },
    [haptic, showToast, lang]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await raceActive();
      setRoom(res.room);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 1500);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    setBackButton(showHist ? () => setShowHist(false) : onBack);
    return () => setBackButton(null);
  }, [onBack, setBackButton, showHist]);

  useEffect(() => {
    if (!room) {
      setPhase("lobby");
      return;
    }
    if (room.status === "open") {
      setPhase("lobby");
      animKey.current = "";
      return;
    }
    if (room.status === "countdown") {
      setPhase(
        room.secsLeft != null && room.secsLeft <= 5 ? "lock" : "lobby"
      );
      if (room.secsLeft != null && room.secsLeft <= 0) {
        void raceProcess(room.id).then((r) => {
          if (r.room) setRoom(r.room);
          onReloadBalance();
        });
      }
      return;
    }
    if (room.status === "racing" || room.status === "finished") {
      const key = `${room.id}:${room.status}`;
      if (animKey.current !== key) {
        animKey.current = key;
        setPhase("release");
        setFallProgress(0);
        const t1 = setTimeout(() => {
          setPhase("fall");
          const start = performance.now();
          const dur = 10000;
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / dur);
            setFallProgress(p);
            if (p < 1) {
              fallRaf.current = requestAnimationFrame(tick);
            } else {
              setPhase("finish");
              if (room.status === "racing") {
                void raceProcess(room.id).then((r) => {
                  if (r.room) setRoom(r.room);
                  onReloadBalance();
                });
              } else {
                onReloadBalance();
              }
            }
          };
          fallRaf.current = requestAnimationFrame(tick);
        }, 1100);
        return () => {
          clearTimeout(t1);
          if (fallRaf.current) cancelAnimationFrame(fallRaf.current);
        };
      }
    }
  }, [room, onReloadBalance]);

  const ensureAndBuy = async (count: number) => {
    if (busy) return;
    const price = room?.ballPrice ?? RACE_MIN_BALL;
    if (balance < price * count) {
      onDeposit?.();
      return;
    }
    setBusy(true);
    try {
      if (!room || room.status === "finished" || room.status === "cancelled") {
        const created = await raceCreate(RACE_MIN_BALL);
        onBalanceUpdate(created.balance);
        let r = created.room;
        if (count > 1) {
          const more = await raceBuy(r.id, count - 1);
          onBalanceUpdate(more.balance);
          r = more.room;
        }
        setRoom(r);
      } else {
        const res = await raceBuy(room.id, count);
        onBalanceUpdate(res.balance);
        setRoom(res.room);
      }
      hapticSuccess();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!room || busy) return;
    setBusy(true);
    try {
      await raceCancel(room.id);
      setRoom(null);
      onReloadBalance();
      haptic("light");
      void refresh();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async () => {
    haptic("light");
    try {
      const res = await raceHistory(40);
      setHistory(res.items || []);
    } catch {
      setHistory([]);
    }
    setShowHist(true);
  };

  const winner = room?.balls.find((b) => b.id === room.winnerBallId);

  if (showHist) {
    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="text-[15px] font-semibold">{t("history")}</div>
          <BalancePill balance={balance} onDeposit={onDeposit} haptic={haptic} />
        </div>
        <div className="px-4 space-y-2 flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-center text-white/35 text-sm py-12">
              {tr("No games yet", "Пока нет игр")}
            </div>
          ) : (
            history.map((h) => (
              <div
                key={h.roomId}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5"
              >
                <div className="flex justify-between">
                  <div className="text-[13px] font-semibold">
                    Race {h.gameNo != null ? `#${h.gameNo}` : ""}
                  </div>
                  <div
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      h.result === "win" ? "text-emerald-400" : "text-white/45"
                    )}
                  >
                    {h.result === "win"
                      ? `+${formatGram(h.payout)}`
                      : h.result === "cancel"
                        ? tr("Refund", "Возврат")
                        : `−${formatGram(h.spent)}`}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <HashChip
                    label="Hash"
                    value={h.serverSeedHash}
                    onCopy={copyText}
                  />
                  <HashChip label="Seed" value={h.serverSeed} onCopy={copyText} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[15px] font-semibold tracking-tight">
              {tr("Race", "Гонка")}
            </div>
            <div className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/25 text-[11px] font-bold tabular-nums text-cyan-200">
              {formatGram(room?.pot || 0)}{" "}
              <span className="text-white/40 font-medium">GRAM</span>
            </div>
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {room?.status === "countdown" && room.secsLeft != null
              ? `${tr("Starts in", "Старт через")} ${room.secsLeft}s`
              : room?.status === "racing" || phase === "fall"
                ? tr("Racing…", "Гонка идёт…")
                : room?.status === "finished" && phase === "finish"
                  ? `${tr("Winner", "Победитель")}: @${winner?.username || "—"}`
                  : tr("Live lobby · buy a ball", "Live-лобби · купи шарик")}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void openHistory()}
          className="w-9 h-9 rounded-xl glass border border-white/[0.08] flex items-center justify-center text-white/45 btn-press shrink-0"
          aria-label={t("history")}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </button>
        <BalancePill balance={balance} onDeposit={onDeposit} haptic={haptic} />
      </div>

      <div className="px-4 flex-1 overflow-y-auto space-y-3 pb-4">
        <RaceStage
          room={room}
          phase={phase}
          followBallId={followBallId}
          telegramId={telegramId}
          fallProgress={fallProgress}
        />

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-white/45">
              {room?.ballCount || 0} {tr("balls", "шар.")} ·{" "}
              {room?.uniquePlayers || 0} {tr("players", "игр.")}
            </span>
            {phase === "lock" && (
              <span className="text-amber-300 font-semibold text-[11px]">
                {tr("Buys locked", "Покупки закрыты")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <HashChip
              label="Hash"
              value={room?.serverSeedHash}
              onCopy={copyText}
            />
            <HashChip label="Seed" value={room?.serverSeed} onCopy={copyText} />
          </div>
        </div>

        {(phase === "lobby" ||
          !room ||
          room.status === "finished" ||
          room.status === "cancelled") && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={
                busy ||
                (room != null && room.status === "countdown" && !room.canBuy)
              }
              onClick={() => void ensureAndBuy(1)}
              className="flex-1 h-12 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-40 shadow-[0_8px_28px_rgba(34,211,238,0.25)]"
            >
              {tr("Buy ball", "Купить шарик")} ·{" "}
              {formatGram(room?.ballPrice ?? RACE_MIN_BALL)}
            </button>
            <button
              type="button"
              disabled={
                busy ||
                (room != null && room.status === "countdown" && !room.canBuy)
              }
              onClick={() => void ensureAndBuy(3)}
              className="h-12 px-4 rounded-2xl border border-white/12 bg-white/[0.04] text-sm font-semibold btn-press disabled:opacity-40"
            >
              ×3
            </button>
          </div>
        )}

        {phase === "lock" && (
          <div className="text-center text-[12px] text-amber-300/90 py-2">
            {tr("Buys closed — race starting", "Покупки закрыты — старт гонки")}
          </div>
        )}

        {room?.status === "open" &&
          room.isHost &&
          room.uniquePlayers < 2 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCancel()}
              className="w-full h-10 rounded-xl text-[12px] text-white/40 border border-white/10 btn-press"
            >
              {t("cancel")}
            </button>
          )}

        {room && room.balls.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-white/35">
              {tr("In the ring", "В кольце")}
            </div>
            {Object.entries(
              room.balls.reduce<
                Record<
                  string,
                  { name: string; n: number; color: string; mine: boolean }
                >
              >((acc, b) => {
                const k = String(b.telegramId);
                if (!acc[k])
                  acc[k] = {
                    name: b.username,
                    n: 0,
                    color: b.color,
                    mine: b.telegramId === telegramId,
                  };
                acc[k].n += 1;
                return acc;
              }, {})
            ).map(([id, u]) => (
              <div
                key={id}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 border border-white/[0.06] bg-white/[0.02]",
                  u.mine && "border-cyan-400/30 bg-cyan-500/[0.07]"
                )}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: u.color,
                    boxShadow: `0 0 10px ${u.color}`,
                  }}
                />
                <span className="flex-1 text-[13px] truncate">
                  @{u.name}
                  {u.mine ? ` (${tr("you", "вы")})` : ""}
                </span>
                <span className="text-[12px] text-white/45 tabular-nums">
                  ×{u.n}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const trackTop = ringY + 48;
  const trackBot = H * 0.9;
  const segH = (trackBot - trackTop) / Math.max(segs.length, 1);
  const pegs: Peg[] = [];
  const walls: Wall[] = [];
  const leftX = W * 0.06;
  const rightX = W * 0.94;

  // soft side rails only
  walls.push(
    { x1: leftX, y1: trackTop, x2: leftX, y2: trackBot },
    { x1: rightX, y1: trackTop, x2: rightX, y2: trackBot }
  );

  segs.forEach((kind, si) => {
    const y0 = trackTop + si * segH;
    const y1 = y0 + segH;
    const midY = (y0 + y1) / 2;

    if (kind === "pegs" || kind === "sieve") {
      // Plinko pins — open, strong bounce
      const rows = kind === "sieve" ? 5 : 4;
      for (let r = 0; r < rows; r++) {
        const cols = 5 + (r % 2);
        const yy = y0 + 14 + (r / Math.max(rows - 1, 1)) * (segH - 28);
        for (let c = 0; c < cols; c++) {
          const u = cols === 1 ? 0.5 : c / (cols - 1);
          const inset = 0.14 + (r % 2) * 0.04;
          pegs.push({
            x: W * (inset + u * (1 - 2 * inset)),
            y: yy,
            r: kind === "sieve" ? 3.5 : 4.5,
            kind: "peg",
          });
        }
      }
    } else if (kind === "bumpers") {
      // large + crosses (MyBalls style)
      const spots = [
        [0.28, 0.3],
        [0.72, 0.3],
        [0.5, 0.58],
        [0.3, 0.85],
        [0.7, 0.85],
      ];
      for (const [ux, uy] of spots) {
        const cx = W * ux;
        const cy = y0 + uy * segH;
        const arm = Math.min(26, segH * 0.2);
        walls.push(
          { x1: cx - arm, y1: cy, x2: cx + arm, y2: cy },
          { x1: cx, y1: cy - arm, x2: cx, y2: cy + arm }
        );
        pegs.push({ x: cx, y: cy, r: arm, kind: "cross" });
      }
    } else if (kind === "funnel") {
      walls.push(
        { x1: leftX, y1: y0 + 6, x2: W * 0.4, y2: y1 - 8 },
        { x1: rightX, y1: y0 + 6, x2: W * 0.6, y2: y1 - 8 }
      );
    } else if (kind === "lanes") {
      // platform shelves with gaps (not full walls)
      walls.push(
        { x1: leftX + 4, y1: midY - 10, x2: W * 0.42, y2: midY - 10 },
        { x1: W * 0.58, y1: midY + 18, x2: rightX - 4, y2: midY + 18 }
      );
      pegs.push({ x: W * 0.25, y: midY + 4, r: 9, kind: "label1" });
      pegs.push({ x: W * 0.75, y: midY + 32, r: 9, kind: "label3" });
    } else if (kind === "zigzag") {
      // soft diagonal guides — sparse
      walls.push(
        { x1: leftX + 8, y1: y0 + 12, x2: W * 0.55, y2: midY },
        { x1: rightX - 8, y1: midY, x2: W * 0.45, y2: y1 - 12 }
      );
    } else if (kind === "tunnel") {
      // incomplete arcs as peg samples
      for (let i = 0; i < 2; i++) {
        const cx = W * (0.32 + i * 0.36);
        const cy = midY;
        const rr = Math.min(42, segH * 0.35);
        pegs.push({ x: cx, y: cy, r: rr, kind: "arc" });
        for (let k = 0; k < 12; k++) {
          const ang = -0.35 + (k / 11) * Math.PI * 1.5;
          pegs.push({
            x: cx + Math.cos(ang) * rr,
            y: cy + Math.sin(ang) * rr,
            r: 4,
            kind: "arc_edge",
          });
        }
      }
    } else if (kind === "ramps") {
      // sparse bumpers
      for (let i = 0; i < 4; i++) {
        pegs.push({
          x: W * (0.22 + (i / 3) * 0.56),
          y: y0 + 20 + (i % 2) * (segH * 0.4),
          r: 9,
          kind: "bumper",
        });
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
  const R = 9;
  let x = W * 0.5 + (seed - 0.5) * 28;
  let y = ringY + 2;
  let vx = (seed - 0.5) * 2.4 + ((seat % 5) - 2) * 0.35;
  let vy = 1.5 + seed * 0.55;
  const g = 0.27;
  const air = 0.9988;
  const points: { x: number; y: number }[] = [{ x, y }];

  // rotating crosses: store centers + arm length from pegs kind cross
  const crosses = pegs.filter((p) => p.kind === "cross");
  // static walls only (non-cross - crosses are dynamic)
  // walls that form crosses were pushed as horizontal+vertical lines through center -
  // skip walls that are near a cross center (handled dynamically)
  const isCrossWall = (w: Wall) => {
    for (const c of crosses) {
      const mx = (w.x1 + w.x2) / 2;
      const my = (w.y1 + w.y2) / 2;
      if (Math.hypot(mx - c.x, my - c.y) < c.r * 0.3) return true;
    }
    return false;
  };
  const staticWalls = walls.filter((w) => !isCrossWall(w));

  const collideSeg = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thick: number,
    rest: number
  ) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.max(
      0,
      Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (len * len))
    );
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    let ox = x - px;
    let oy = y - py;
    let dist = Math.hypot(ox, oy);
    if (dist < 1e-4) {
      ox = -dy / len;
      oy = dx / len;
      dist = 1;
    }
    const rad = R + thick * 0.5;
    if (dist < rad) {
      const nx = ox / dist;
      const ny = oy / dist;
      x += nx * (rad - dist);
      y += ny * (rad - dist);
      const vn = vx * nx + vy * ny;
      if (vn < 0) {
        vx -= (1 + rest) * vn * nx;
        vy -= (1 + rest) * vn * ny;
        // slight spin kick
        vx += (-ny) * 0.08;
        vy += nx * 0.08;
      }
    }
  };

  for (let step = 0; step < 1800; step++) {
    // rotation angle grows over simulation time
    const ang = step * 0.035;

    for (let sub = 0; sub < 3; sub++) {
      vy += g / 3;
      vx *= air;
      vy *= air;
      x += vx / 3;
      y += vy / 3;

      if (x - R < leftX) {
        x = leftX + R;
        if (vx < 0) vx = -vx * 0.6;
      }
      if (x + R > rightX) {
        x = rightX - R;
        if (vx > 0) vx = -vx * 0.6;
      }

      for (const w of staticWalls) {
        const isFlat = Math.abs(w.y2 - w.y1) < 2.5 && Math.abs(w.x2 - w.x1) > 10;
        const thick = isFlat ? 12 : 6;
        const rest = isFlat ? 0.65 : 0.72;
        collideSeg(w.x1, w.y1, w.x2, w.y2, thick, rest);
        if (isFlat) {
          // keep sliding off shelves
          const my = (w.y1 + w.y2) / 2;
          if (Math.abs(y - my) < R + 8 && Math.abs(x - (w.x1 + w.x2) / 2) < Math.abs(w.x2 - w.x1) / 2) {
            if (vy < 0.2) vy = 0.18;
            if (Math.abs(vx) < 0.12) vx += seed > 0.5 ? 0.28 : -0.28;
          }
        }
      }

      // rotating crosses
      for (const c of crosses) {
        const arm = c.r;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        // arm 1
        collideSeg(
          c.x - arm * ca,
          c.y - arm * sa,
          c.x + arm * ca,
          c.y + arm * sa,
          arm * 0.28,
          0.8
        );
        // arm 2 perpendicular
        collideSeg(
          c.x - arm * -sa,
          c.y - arm * ca,
          c.x + arm * -sa,
          c.y + arm * ca,
          arm * 0.28,
          0.8
        );
      }

      for (const p of pegs) {
        if (
          p.kind === "cross" ||
          p.kind === "arc" ||
          p.kind === "label1" ||
          p.kind === "label3"
        )
          continue;
        const pr =
          p.kind === "arc_edge" ? 4 : p.kind === "bumper" ? 9 : p.r;
        const dx = x - p.x;
        const dy = y - p.y;
        const dist = Math.hypot(dx, dy) || 1e-4;
        const minD = R + pr;
        if (dist < minD) {
          const nx = dx / dist;
          const ny = dy / dist;
          x += nx * (minD - dist);
          y += ny * (minD - dist);
          const vn = vx * nx + vy * ny;
          if (vn < 0) {
            const rest = p.kind === "peg" ? 0.82 : 0.76;
            vx -= (1 + rest) * vn * nx;
            vy -= (1 + rest) * vn * ny;
            vx += (seed - 0.5) * 0.35;
            if (vy < 0.22) vy = 0.22 + seed * 0.12;
          }
        }
      }
    }

    if (vy > 7) vy = 7;
    if (Math.abs(vx) > 5) vx *= 0.9;

    if (y > trackBot - 3) {
      y = trackBot - 3;
      points.push({ x, y });
      break;
    }
    points.push({ x, y });
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
  let tt = Math.min(1, Math.max(0, t * (1 - bias * 0.15) - bias * 0.02));
  tt = tt * tt * (3 - 2 * tt);
  if (path.length < 2) return path[0] || { x: 0, y: 0 };
  const f = tt * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(f));
  const u = f - i;
  const u2 = u * u * (3 - 2 * u);
  return {
    x: path[i].x + (path[i + 1].x - path[i].x) * u2,
    y: path[i].y + (path[i + 1].y - path[i].y) * u2,
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
  const clipId = `av-${Math.round(cx * 10)}-${Math.round(cy * 10)}`;
  // fixed same size for all balls
  const R = 9;
  return (
    <g>
      {highlight && (
        <polygon
          points={`${cx},${cy - R - 6} ${cx - 4.5},${cy - R - 1} ${cx + 4.5},${cy - R - 1}`}
          fill="#FFEB3B"
        />
      )}
      <circle cx={cx} cy={cy} r={R} fill="#00E676" />
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.3"
      />
      {photoUrl ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle cx={cx} cy={cy} r={R - 1.2} />
            </clipPath>
          </defs>
          <image
            href={photoUrl}
            x={cx - (R - 1.2)}
            y={cy - (R - 1.2)}
            width={(R - 1.2) * 2}
            height={(R - 1.2) * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={R * 0.95}
          fontWeight="800"
        >
          {initial}
        </text>
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

  const ringY = isLobby ? H * 0.48 : H * 0.12;
  const ringR = isLobby ? 110 : 72;
  // hole closed in lobby; opens after timer
  const holeHalfDeg = phase === "release" ? 32 : phase === "fall" || phase === "finish" ? 55 : 0;

  const track = useMemo(() => buildTrack(mapId, W, H, H * 0.16), [mapId]);

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
    const g = 0.38;
    const damp = 0.993;
    const wallRest = 0.82;
    const ballRest = 0.88;

    const tick = (now: number) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      const ph = phaseRef.current;
      const open = ph === "release" || ph === "fall" || ph === "finish";
      const onTrack = ph === "fall" || ph === "finish";

      if (onTrack) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const steps = Math.max(2, Math.min(8, Math.ceil(dt / 0.006)));
      const h = dt / steps;
      const cx = W / 2;
      const cy = ringY;
      const hole = open ? ((phaseRef.current === "release" ? 32 : 48) * Math.PI) / 180 : 0;
      const balls = simRef.current.map((b) => ({ ...b }));

      for (let s = 0; s < steps; s++) {
        for (const b of balls) {
          b.vy += g * h * 60;
          b.vx *= Math.pow(damp, h * 60);
          b.vy *= Math.pow(damp, h * 60);
          b.x += b.vx * h * 60;
          b.y += b.vy * h * 60;

          const dx = b.x - cx;
          const dy = b.y - cy;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const maxD = ringR - b.r - 1.5;
          let inHole = false;
          if (open) {
            const a = Math.atan2(dy, dx);
            const bottom = Math.PI / 2;
            let dA = a - bottom;
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            inHole = Math.abs(dA) < hole / 2 && dist > maxD * 0.55;
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
              const tx = -ny;
              const ty = nx;
              const vt = b.vx * tx + b.vy * ty;
              b.vx -= vt * tx * 0.1;
              b.vy -= vt * ty * 0.1;
            }
          }
          if (!open && b.y > cy + maxD) {
            b.y = cy + maxD;
            if (b.vy > 0) b.vy *= -wallRest;
          }
        }

        // multi-pass ball-ball
        for (let pass = 0; pass < 4; pass++) {
          for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
              const a = balls[i];
              const b = balls[j];
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.hypot(dx, dy) || 0.0001;
              const minD = a.r + b.r;
              if (dist >= minD) continue;
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = minD - dist;
              const corr = overlap * 0.55;
              a.x -= nx * corr;
              a.y -= ny * corr;
              b.x += nx * corr;
              b.y += ny * corr;
              const va = a.vx * nx + a.vy * ny;
              const vb = b.vx * nx + b.vy * ny;
              const rel = va - vb;
              if (rel > 0) continue;
              const jImp = (-(1 + ballRest) * rel) / 2;
              a.vx -= jImp * nx;
              a.vy -= jImp * ny;
              b.vx += jImp * nx;
              b.vy += jImp * ny;
            }
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

  const easeFall = fallProgress * fallProgress * (3 - 2 * fallProgress);
  const camY = isLobby ? 0 : phase === "release" ? 6 : 8 + easeFall * 70;
  const camScale = isLobby
    ? 1.05
    : phase === "release"
      ? 1.0
      : 0.92 - easeFall * 0.04;
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
          "relative bg-[#0A0E2A] will-change-transform overflow-hidden",
          isLobby ? "aspect-square" : "aspect-[9/16]"
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

        {phase === "release" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div
              className="text-[72px] font-black text-white/30"
              style={{
                animation: "raceGo 1.5s ease-out forwards",
                textShadow: "0 0 36px rgba(79,195,247,0.4)",
              }}
            >
              GO
            </div>
            <style>{`@keyframes raceGo{0%{opacity:0;transform:scale(.7)}30%{opacity:1;transform:scale(1.05)}100%{opacity:0;transform:scale(1.2)}}`}</style>
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
          </defs>

          {!isLobby && track.walls.map((w, i) => {
              const isSide =
                Math.abs(w.x1 - w.x2) < 2 && Math.abs(w.y1 - w.y2) > 50;
              const isFlat = Math.abs(w.y1 - w.y2) < 3;
              return (
                <line
                  key={`w-${i}`}
                  x1={w.x1}
                  y1={w.y1}
                  x2={w.x2}
                  y2={w.y2}
                  stroke={accent}
                  strokeWidth={isSide ? 1.5 : isFlat ? 12 : 7}
                  strokeLinecap="round"
                  opacity={isSide ? 0.15 : 0.9}
                />
              );
            })}

          {!isLobby && track.pegs.map((pg, i) => {
              if (pg.kind === "cross") {
                const arm = pg.r;
                const th = Math.max(6, arm * 0.28);
                // spin: match sim ~0.035 rad/step over ~path; use fallProgress * turns
                const rotDeg =
                  (phase === "fall" || phase === "finish"
                    ? fallProgress * 360 * 2.2
                    : phase === "release"
                      ? 20
                      : 0) + i * 18;
                return (
                  <g
                    key={`p-${i}`}
                    transform={`rotate(${rotDeg} ${pg.x} ${pg.y})`}
                  >
                    <line
                      x1={pg.x - arm}
                      y1={pg.y}
                      x2={pg.x + arm}
                      y2={pg.y}
                      stroke={accent}
                      strokeWidth={th}
                      strokeLinecap="round"
                      opacity="0.95"
                    />
                    <line
                      x1={pg.x}
                      y1={pg.y - arm}
                      x2={pg.x}
                      y2={pg.y + arm}
                      stroke={accent}
                      strokeWidth={th}
                      strokeLinecap="round"
                      opacity="0.95"
                    />
                    <circle
                      cx={pg.x}
                      cy={pg.y}
                      r={th * 0.55}
                      fill={accent}
                      opacity="0.85"
                    />
                  </g>
                );
              }
              if (pg.kind === "arc") {
                const r = pg.r;
                const a0 = -0.35;
                const a1 = Math.PI * 1.5;
                const x1 = pg.x + Math.cos(a0) * r;
                const y1 = pg.y + Math.sin(a0) * r;
                const x2 = pg.x + Math.cos(a1) * r;
                const y2 = pg.y + Math.sin(a1) * r;
                return (
                  <path
                    key={`p-${i}`}
                    d={`M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`}
                    fill="none"
                    stroke={accent}
                    strokeWidth="8"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                );
              }
              if (pg.kind === "arc_edge") return null;
              if (pg.kind === "label1" || pg.kind === "label3") {
                return (
                  <text
                    key={`p-${i}`}
                    x={pg.x}
                    y={pg.y}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.8)"
                    fontSize="14"
                    fontWeight="800"
                  >
                    {pg.kind === "label1" ? "1" : "3"}
                  </text>
                );
              }
              return (
                <circle
                  key={`p-${i}`}
                  cx={pg.x}
                  cy={pg.y}
                  r={pg.r}
                  fill={accent}
                  opacity="0.9"
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
              Купи шарик — он в кольце толкается с другими.
              <br />
              После таймера внизу откроется дырка — старт гонки.
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
          const dur = 22000;
          const tick = (now: number) => {
            const raw = Math.min(1, (now - start) / dur);
            const p =
              raw < 0.5
                ? 2 * raw * raw
                : 1 - Math.pow(-2 * raw + 2, 2) / 2;
            setFallProgress(p);
            if (raw < 1) {
              fallRaf.current = requestAnimationFrame(tick);
            } else {
              setFallProgress(1);
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
        }, 1600);
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

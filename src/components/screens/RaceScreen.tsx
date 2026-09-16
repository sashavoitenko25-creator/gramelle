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

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
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
type Wall = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thick?: number;
  rest?: number;
  fric?: number;
  funnel?: boolean;
};

type SimBall = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  seat: number;
  finishRank: number | null;
  telegramId: number;
  username: string;
  photoUrl: string | null;
  dead?: boolean;
};

type PathPoint = { x: number; y: number; dead?: boolean };

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function HashChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-cyan-200/85">
      <span className="text-white/40 uppercase tracking-wide">{label}</span>
      <span className="truncate max-w-[88px]">{value}</span>
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
    <button
      type="button"
      onClick={() => {
        haptic("light");
        onDeposit?.();
      }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[12px] font-semibold"
    >
      <span className="text-emerald-300">{formatGram(balance)}</span>
      <span className="text-white/40 text-[10px]">GRAM</span>
      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[12px] leading-none">
        +
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Track builder — exact section order from prompt
───────────────────────────────────────────────────────────── */
function buildTrack(mapId: string | null, W: number, H: number, ringY: number) {
  const map = RACE_MAPS.find((m) => m.id === mapId) || RACE_MAPS[0];
  const segs = map.segments;
  const trackTop = ringY + 36;
  const trackBot = H * 0.93;
  const segH = (trackBot - trackTop) / Math.max(segs.length, 1);
  const pegs: Peg[] = [];
  const walls: Wall[] = [];
  const leftX = W * 0.03;
  const rightX = W * 0.97;
  let antigravY = -1;
  let antigravR = 0;

  // soft side rails (nearly invisible)
  walls.push(
    { x1: leftX, y1: trackTop, x2: leftX, y2: trackBot, thick: 2, rest: 0.5 },
    { x1: rightX, y1: trackTop, x2: rightX, y2: trackBot, thick: 2, rest: 0.5 }
  );

  segs.forEach((kind, si) => {
    const y0 = trackTop + si * segH;
    const midY = y0 + segH * 0.5;

    if (kind === "start") {
      // open space — GO zone only
      return;
    }

    if (kind === "platforms") {
      // divider + shelves "1" / "3"
      walls.push({
        x1: W * 0.5,
        y1: y0 + 10,
        x2: W * 0.5,
        y2: y0 + segH * 0.85,
        thick: 5,
        rest: 0.7,
      });
      // left platform (1)
      walls.push({
        x1: leftX + 4,
        y1: midY + 8,
        x2: W * 0.46,
        y2: midY + 8,
        thick: 14,
        rest: 0.65,
        fric: 0.18,
      });
      pegs.push({ x: W * 0.25, y: midY + 22, r: 1, kind: "label1" });
      // right platform (3)
      walls.push({
        x1: W * 0.54,
        y1: midY + 8,
        x2: rightX - 4,
        y2: midY + 8,
        thick: 14,
        rest: 0.65,
        fric: 0.18,
      });
      pegs.push({ x: W * 0.75, y: midY + 22, r: 1, kind: "label3" });
      // a few starter pins
      for (let i = 0; i < 4; i++) {
        pegs.push({
          x: W * (0.2 + i * 0.2),
          y: y0 + 18 + (i % 2) * 12,
          r: W * 0.01,
          kind: "dot",
        });
      }
    } else if (kind === "crosses") {
      // large + crosses, staggered rows
      const size = W * 0.175;
      const positions = [
        [0.28, 0.22],
        [0.72, 0.22],
        [0.5, 0.5],
        [0.28, 0.78],
        [0.72, 0.78],
      ];
      for (const [ux, uy] of positions) {
        const cx = W * ux;
        const cy = y0 + uy * segH;
        const arm = size / 2;
        walls.push(
          {
            x1: cx - arm,
            y1: cy,
            x2: cx + arm,
            y2: cy,
            thick: size * 0.13,
            rest: 0.78,
          },
          {
            x1: cx,
            y1: cy - arm,
            x2: cx,
            y2: cy + arm,
            thick: size * 0.13,
            rest: 0.78,
          }
        );
        pegs.push({ x: cx, y: cy, r: arm, kind: "cross" });
      }
    } else if (kind === "dots") {
      // Plinko field
      const rows = 6;
      const cols = 8;
      const d = W * 0.02;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const odd = r % 2;
          const u = (c + odd * 0.5) / (cols - 0.5);
          // slight curve + gaps
          if ((r + c) % 11 === 0) continue;
          pegs.push({
            x: W * (0.1 + u * 0.8),
            y: y0 + 14 + (r / (rows - 1)) * (segH - 28),
            r: d,
            kind: "dot",
          });
        }
      }
    } else if (kind === "arcs") {
      // incomplete thick rings ~280°
      for (let i = 0; i < 4; i++) {
        const cx = W * (0.28 + (i % 2) * 0.44);
        const cy = y0 + 28 + Math.floor(i / 1.2) * (segH * 0.38);
        const rr = W * 0.155;
        pegs.push({ x: cx, y: cy, r: rr, kind: "arc" });
        // collision samples along ~280°
        const a0 = -0.4;
        const a1 = Math.PI * 1.55;
        for (let k = 0; k < 14; k++) {
          const ang = a0 + (k / 13) * (a1 - a0);
          pegs.push({
            x: cx + Math.cos(ang) * rr,
            y: cy + Math.sin(ang) * rr,
            r: W * 0.022,
            kind: "arc_edge",
          });
        }
      }
    } else if (kind === "bombs") {
      for (let i = 0; i < 3; i++) {
        pegs.push({
          x: W * (0.3 + i * 0.2),
          y: midY + ((i % 2) - 0.5) * 20,
          r: W * 0.028,
          kind: "bomb",
        });
      }
    } else if (kind === "antigrav") {
      antigravY = midY;
      antigravR = segH * 0.45;
      pegs.push({ x: W * 0.5, y: midY, r: antigravR, kind: "antigrav" });
    } else if (kind === "funnel") {
      // V funnel — low bounce
      walls.push(
        {
          x1: leftX,
          y1: y0 + 6,
          x2: W * 0.42,
          y2: trackBot - 26,
          thick: 10,
          rest: 0.35,
          fric: 0.08,
          funnel: true,
        },
        {
          x1: rightX,
          y1: y0 + 6,
          x2: W * 0.58,
          y2: trackBot - 26,
          thick: 10,
          rest: 0.35,
          fric: 0.08,
          funnel: true,
        }
      );
    }
  });

  return {
    map,
    pegs,
    walls,
    trackTop,
    trackBot,
    leftX,
    rightX,
    antigravY,
    antigravR,
    segH,
  };
}

/* ─────────────────────────────────────────────────────────────
   Path simulation — restitution ~0.8, continuous-ish substeps
───────────────────────────────────────────────────────────── */
function simulatePath(
  ballId: string,
  seat: number,
  W: number,
  ringY: number,
  trackBot: number,
  leftX: number,
  rightX: number,
  pegs: Peg[],
  walls: Wall[],
  antigravY: number,
  antigravR: number
): PathPoint[] {
  const seed = hash01(ballId + ":" + seat);
  const R = W * 0.025; // ~5% diameter → radius 2.5%
  let x = W * 0.5 + (seed - 0.5) * W * 0.55;
  let y = ringY + 4;
  let vx = (seed - 0.5) * 2.4 + ((seat % 7) - 3) * 0.35;
  let vy = 1.6 + seed * 0.5;
  // physics material from prompt
  const g = 0.28; // ~heavy feel
  const air = 0.999; // linear drag ~0.05–0.1
  const ballRest = 0.8;
  const points: PathPoint[] = [{ x, y }];
  let dead = false;

  const resolve = () => {
    if (x - R < leftX) {
      x = leftX + R;
      if (vx < 0) vx = -vx * ballRest * 0.7;
    }
    if (x + R > rightX) {
      x = rightX - R;
      if (vx > 0) vx = -vx * ballRest * 0.7;
    }

    for (const w of walls) {
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const len = Math.hypot(dx, dy) || 1;
      const t = Math.max(
        0,
        Math.min(1, ((x - w.x1) * dx + (y - w.y1) * dy) / (len * len))
      );
      const px = w.x1 + t * dx;
      const py = w.y1 + t * dy;
      let ox = x - px;
      let oy = y - py;
      let dist = Math.hypot(ox, oy);
      if (dist < 1e-4) {
        ox = -dy / len;
        oy = dx / len;
        dist = 1;
      }
      const half = (w.thick ?? 4) * 0.5;
      const rad = R + half;
      if (dist < rad) {
        const nx = ox / dist;
        const ny = oy / dist;
        x += nx * (rad - dist);
        y += ny * (rad - dist);
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          const rest = w.rest ?? 0.7;
          const fric = w.fric ?? 0.15;
          // impulse
          vx -= (1 + rest) * vn * nx;
          vy -= (1 + rest) * vn * ny;
          // friction on tangent
          const tx = -ny;
          const ty = nx;
          const vt = vx * tx + vy * ty;
          vx -= vt * tx * fric;
          vy -= vt * ty * fric;
          if (!w.funnel && Math.abs(dy) < 3 && ny < -0.3) {
            // resting on shelf — keep sliding
            if (vy < 0.2) vy = 0.15;
            if (Math.abs(vx) < 0.12) vx += seed > 0.5 ? 0.25 : -0.25;
          }
        }
      }
    }

    for (const p of pegs) {
      if (
        p.kind === "cross" ||
        p.kind === "arc" ||
        p.kind === "label1" ||
        p.kind === "label3" ||
        p.kind === "antigrav"
      )
        continue;

      if (p.kind === "bomb") {
        const dx = x - p.x;
        const dy = y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < R + p.r) {
          dead = true;
          return;
        }
        continue;
      }

      const pr = p.r;
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
          // high bounciness Plinko feel
          const rest = p.kind === "dot" ? 0.82 : 0.75;
          vx -= (1 + rest) * vn * nx;
          vy -= (1 + rest) * vn * ny;
          vx += (seed - 0.5) * 0.35;
        }
      }
    }

    // anti-gravity zone force
    if (antigravY > 0) {
      const dy = y - antigravY;
      if (Math.abs(dy) < antigravR) {
        const f = 1 - Math.abs(dy) / antigravR;
        vy -= 0.35 * f; // upward force
      }
    }
  };

  for (let step = 0; step < 2200 && !dead; step++) {
    // 3 substeps ≈ continuous detection
    for (let s = 0; s < 3; s++) {
      vy += g / 3;
      vx *= air;
      vy *= air;
      x += vx / 3;
      y += vy / 3;
      resolve();
      if (dead) break;
    }
    if (vy > 7) vy = 7;
    if (Math.abs(vx) > 5) vx *= 0.92;

    points.push({ x, y, dead: false });
    if (y > trackBot - 3) {
      y = trackBot - 3;
      points.push({ x, y });
      break;
    }
  }

  if (dead) {
    points.push({ x, y, dead: true });
  }

  return points.length > 2
    ? points
    : [
        { x: W / 2, y: ringY },
        { x: W / 2, y: trackBot },
      ];
}

function samplePath(
  path: PathPoint[],
  t: number,
  rank: number,
  total: number
): PathPoint {
  const bias = (rank - 1) / Math.max(total, 1);
  let tt = Math.min(1, Math.max(0, t * (1 - bias * 0.12) - bias * 0.015));
  tt = tt * tt * (3 - 2 * tt); // smoothstep
  if (path.length < 2) return path[0] || { x: 0, y: 0 };
  // stop at death point
  let last = path.length - 1;
  for (let i = 0; i < path.length; i++) {
    if (path[i].dead) {
      last = i;
      break;
    }
  }
  const f = tt * last;
  const i = Math.min(last - 1, Math.floor(f));
  const u = f - i;
  const u2 = u * u * (3 - 2 * u);
  const a = path[i];
  const b = path[Math.min(i + 1, last)];
  return {
    x: a.x + (b.x - a.x) * u2,
    y: a.y + (b.y - a.y) * u2,
    dead: b.dead || a.dead,
  };
}

/* ─────────────────────────────────────────────────────────────
   Ball visual — green + white rim + avatar (prompt style)
───────────────────────────────────────────────────────────── */
function AvatarBall({
  cx,
  cy,
  username,
  photoUrl,
  highlight,
  dead,
}: {
  cx: number;
  cy: number;
  username: string;
  photoUrl: string | null;
  highlight?: boolean;
  dead?: boolean;
}) {
  if (dead) return null;
  const initial = (username || "?").replace(/^@/, "").charAt(0).toUpperCase();
  const clipId = `av-${Math.round(cx * 10)}-${Math.round(cy * 10)}`;
  const R = 9; // fixed ~5% of 320
  return (
    <g opacity={1}>
      {/* body — bright green */}
      <circle cx={cx} cy={cy} r={R} fill="#00E676" />
      {/* white rim 1–1.5px */}
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke="rgba(255,255,255,0.92)"
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
          y={cy + 3.8}
          textAnchor="middle"
          fill="#fff"
          fontSize="10"
          fontWeight="800"
          style={{ pointerEvents: "none" }}
        >
          {initial}
        </text>
      )}
      {highlight && (
        <circle
          cx={cx}
          cy={cy}
          r={R + 2.5}
          fill="none"
          stroke="rgba(255,235,59,0.55)"
          strokeWidth="1.2"
        />
      )}
    </g>
  );
}

/* ─────────────────────────────────────────────────────────────
   RaceStage — ring lobby + free-fall course
───────────────────────────────────────────────────────────── */
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
  const H = 900; // long vertical course
  const isLobby = phase === "lobby" || phase === "lock";
  const holeOpen =
    phase === "release" || phase === "fall" || phase === "finish";

  const ringY = isLobby ? H * 0.22 : H * 0.06;
  const ringR = isLobby ? 88 : 62;

  const track = useMemo(
    () => buildTrack(mapId, W, H, H * 0.06),
    [mapId]
  );

  const [sim, setSim] = useState<SimBall[]>([]);
  const simRef = useRef<SimBall[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [holeAnim, setHoleAnim] = useState(0);
  const holeAnimRef = useRef(0);
  const holeHalfDeg = holeAnim * 58;

  // smooth hole open
  useEffect(() => {
    if (phase === "release" || phase === "fall" || phase === "finish") {
      const start = performance.now();
      const dur = 1500;
      let raf = 0;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = t * t * (3 - 2 * t);
        holeAnimRef.current = e;
        setHoleAnim(e);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      if (holeAnimRef.current < 0.99) raf = requestAnimationFrame(tick);
      else {
        setHoleAnim(1);
        holeAnimRef.current = 1;
      }
      return () => cancelAnimationFrame(raf);
    }
    holeAnimRef.current = 0;
    setHoleAnim(0);
  }, [phase]);

  // spawn balls into ring
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
        const ang = seed * Math.PI * 2 + i * 0.7;
        const rad = ringR * (0.12 + seed * 0.4);
        next.push({
          id: b.id,
          username: b.username,
          photoUrl: b.photoUrl,
          telegramId: b.telegramId,
          seat: b.seat,
          finishRank: b.finishRank,
          x: W / 2 + Math.cos(ang) * rad,
          y: ringY + Math.sin(ang) * rad * 0.85,
          vx: Math.cos(ang + 1.2) * (1.1 + seed),
          vy: Math.sin(ang + 0.4) * (0.7 + seed * 0.5) - 0.2,
          r: 9,
        });
      }
    });
    simRef.current = next;
    setSim(next);
  }, [ballsMeta.map((b) => b.id).join("|"), ringY, ringR]);

  // ring physics (lobby + release)
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const G = 0.32;
    const DAMP = 0.992;
    const WALL_REST = 0.78;
    const BALL_REST = 0.82;
    const FRIC = 0.12;

    const tick = (now: number) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      const steps = Math.max(2, Math.min(8, Math.ceil(dt / 0.006)));
      const h = dt / steps;

      const balls = simRef.current.map((b) => ({ ...b }));
      const open =
        phaseRef.current === "release" ||
        phaseRef.current === "fall" ||
        phaseRef.current === "finish";
      const holeHalf = open
        ? (holeAnimRef.current * 58 * Math.PI) / 180
        : 0;
      const cx0 = W / 2;
      const cy0 = ringY;

      for (let s = 0; s < steps; s++) {
        for (const b of balls) {
          if (b.dead) continue;
          b.vy += G * h * 60;
          b.vx *= Math.pow(DAMP, h * 60);
          b.vy *= Math.pow(DAMP, h * 60);
          b.x += b.vx * h * 60;
          b.y += b.vy * h * 60;

          const dx = b.x - cx0;
          const dy = b.y - cy0;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const maxD = ringR - b.r - 0.4;

          let inHole = false;
          if (open && holeHalf > 0) {
            const a = Math.atan2(dy, dx);
            let dA = a - Math.PI / 2;
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            inHole = Math.abs(dA) < holeHalf && dist > maxD * 0.5;
          }

          if (dist > maxD && !inHole) {
            const nx = dx / dist;
            const ny = dy / dist;
            b.x = cx0 + nx * maxD;
            b.y = cy0 + ny * maxD;
            const vn = b.vx * nx + b.vy * ny;
            if (vn > 0) {
              b.vx -= (1 + WALL_REST) * vn * nx;
              b.vy -= (1 + WALL_REST) * vn * ny;
              const tx = -ny;
              const ty = nx;
              const vt = b.vx * tx + b.vy * ty;
              b.vx -= vt * tx * FRIC;
              b.vy -= vt * ty * FRIC;
            }
          }
        }

        // ball–ball (4 passes)
        for (let pass = 0; pass < 4; pass++) {
          for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
              const a = balls[i];
              const b = balls[j];
              if (a.dead || b.dead) continue;
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
              const jImp = (-(1 + BALL_REST) * rel) / 2;
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

    if (isLobby || phase === "release") {
      raf = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(raf);
  }, [isLobby, phase, ringY, ringR]);

  // precomputed fall paths
  const paths = useMemo(() => {
    const out: Record<string, PathPoint[]> = {};
    ballsMeta.forEach((b) => {
      out[b.id] = simulatePath(
        b.id,
        b.seat,
        W,
        H * 0.06,
        track.trackBot,
        track.leftX,
        track.rightX,
        track.pegs,
        track.walls,
        track.antigravY,
        track.antigravR
      );
    });
    return out;
  }, [ballsMeta, track]);

  // camera follows lead ball
  const leadId = followBallId || ballsMeta[0]?.id;
  const leadPath = leadId ? paths[leadId] : undefined;
  const leadPos =
    leadPath && leadPath.length > 1 && (phase === "fall" || phase === "finish")
      ? samplePath(
          leadPath,
          fallProgress,
          ballsMeta.find((b) => b.id === leadId)?.finishRank ?? 1,
          ballsMeta.length
        )
      : null;

  const camY = isLobby
    ? 0
    : phase === "release"
      ? 10
      : leadPos
        ? Math.max(-10, Math.min(H * 0.6, leadPos.y - H * 0.28))
        : 12 + fallProgress * 80;
  const camScale = isLobby ? 1 : 0.95;

  // anomaly banner timing (mid fall)
  const showAntiOn =
    phase === "fall" && fallProgress > 0.55 && fallProgress < 0.72;
  const showAntiOff =
    phase === "fall" && fallProgress >= 0.72 && fallProgress < 0.78;

  const accent = track.map.accent;
  const holeRad = (holeHalfDeg * Math.PI) / 180;
  const arcStart = Math.PI / 2 + Math.max(holeRad, 0.001);
  const arcEnd = Math.PI / 2 - Math.max(holeRad, 0.001) + Math.PI * 2;

  const polar = (a: number, rad: number) => ({
    x: W / 2 + Math.cos(a) * rad,
    y: ringY + Math.sin(a) * rad,
  });
  const ringPath = (() => {
    if (holeHalfDeg < 1) {
      return `M ${W / 2 + ringR} ${ringY} A ${ringR} ${ringR} 0 1 1 ${W / 2 - ringR} ${ringY} A ${ringR} ${ringR} 0 1 1 ${W / 2 + ringR} ${ringY}`;
    }
    const s = polar(arcStart, ringR);
    const e = polar(arcEnd, ringR);
    const large = holeHalfDeg < 90 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${ringR} ${ringR} 0 ${large} 1 ${e.x} ${e.y}`;
  })();

  return (
    <div className="relative w-full max-w-[360px] mx-auto rounded-[22px] overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <div
        className="relative will-change-transform overflow-hidden aspect-[9/16]"
        style={{
          background:
            "linear-gradient(180deg, #12082a 0%, #0A0E2A 35%, #050510 100%)",
          transform: `scale(${camScale}) translateY(${-camY * 0.7}px)`,
          transformOrigin: "50% 0%",
          transition:
            phase === "fall" || phase === "finish"
              ? "transform 80ms linear"
              : "transform 1.2s cubic-bezier(.33,.9,.25,1)",
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMin meet"
        >
          <defs>
            <radialGradient id="antiG">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern
              id="checkFinish"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <rect width="5" height="5" fill="#111" />
              <rect x="5" y="5" width="5" height="5" fill="#111" />
              <rect x="5" width="5" height="5" fill="#eee" />
              <rect y="5" width="5" height="5" fill="#eee" />
            </pattern>
          </defs>

          {/* ambient particles */}
          {Array.from({ length: 18 }).map((_, i) => (
            <circle
              key={`pt-${i}`}
              cx={(hash01("p" + i) * W)}
              cy={(hash01("q" + i) * H * 0.9 + fallProgress * 40) % H}
              r={0.8 + (i % 3) * 0.4}
              fill={i % 2 ? "#00E676" : "#fff"}
              opacity={0.12 + (i % 5) * 0.03}
            />
          ))}

          {/* walls / platforms */}
          {track.walls.map((w, i) => {
            const isSide =
              Math.abs(w.x1 - w.x2) < 2 && Math.abs(w.y1 - w.y2) > 40;
            if (isSide) {
              return (
                <line
                  key={`w-${i}`}
                  x1={w.x1}
                  y1={w.y1}
                  x2={w.x2}
                  y2={w.y2}
                  stroke={accent}
                  strokeWidth="1"
                  opacity={0.1}
                />
              );
            }
            const isFlat = Math.abs(w.y1 - w.y2) < 3;
            return (
              <line
                key={`w-${i}`}
                x1={w.x1}
                y1={w.y1}
                x2={w.x2}
                y2={w.y2}
                stroke={w.funnel ? "#1e3a5f" : accent}
                strokeWidth={w.thick ?? (isFlat ? 14 : 8)}
                strokeLinecap="round"
                opacity={isLobby ? 0.4 : 0.95}
                filter={w.funnel ? undefined : "url(#glow)"}
              />
            );
          })}

          {/* pegs / crosses / arcs / bombs */}
          <g opacity={isLobby ? 0.4 : 1}>
            {track.pegs.map((pg, i) => {
              if (pg.kind === "bomb") {
                return (
                  <g key={`p-${i}`}>
                    <circle
                      cx={pg.x}
                      cy={pg.y}
                      r={pg.r + 1}
                      fill="#1a1a1a"
                      stroke="#64748b"
                      strokeWidth="1"
                    />
                    <text
                      x={pg.x}
                      y={pg.y + 4}
                      textAnchor="middle"
                      fontSize={pg.r * 1.4}
                    >
                      💣
                    </text>
                  </g>
                );
              }
              if (pg.kind === "cross") {
                const arm = pg.r;
                const th = arm * 0.26;
                return (
                  <g key={`p-${i}`} filter="url(#glow)">
                    <line
                      x1={pg.x - arm}
                      y1={pg.y}
                      x2={pg.x + arm}
                      y2={pg.y}
                      stroke={accent}
                      strokeWidth={th}
                      strokeLinecap="round"
                    />
                    <line
                      x1={pg.x}
                      y1={pg.y - arm}
                      x2={pg.x}
                      y2={pg.y + arm}
                      stroke={accent}
                      strokeWidth={th}
                      strokeLinecap="round"
                    />
                  </g>
                );
              }
              if (pg.kind === "arc") {
                const r = pg.r;
                const a0 = -0.4;
                const a1 = Math.PI * 1.55;
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
                    strokeWidth={W * 0.045}
                    strokeLinecap="round"
                    filter="url(#glow)"
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
                    fill="rgba(255,255,255,0.85)"
                    fontSize="16"
                    fontWeight="800"
                  >
                    {pg.kind === "label1" ? "1" : "3"}
                  </text>
                );
              }
              if (pg.kind === "antigrav") {
                return (
                  <circle
                    key={`p-${i}`}
                    cx={pg.x}
                    cy={pg.y}
                    r={pg.r}
                    fill="url(#antiG)"
                    stroke="#c084fc"
                    strokeWidth="1.2"
                    strokeDasharray="6 4"
                    opacity="0.55"
                  />
                );
              }
              // dots
              return (
                <circle
                  key={`p-${i}`}
                  cx={pg.x}
                  cy={pg.y}
                  r={pg.r}
                  fill={accent}
                  filter="url(#glow)"
                />
              );
            })}
          </g>

          {/* finish checkered */}
          <g opacity={isLobby ? 0.35 : 1}>
            <rect
              x={W * 0.38}
              y={H * 0.93}
              width={W * 0.24}
              height={16}
              fill="url(#checkFinish)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.8"
              rx="2"
            />
          </g>

          {/* ring */}
          <path
            d={ringPath}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth={isLobby ? 5 : 4}
            strokeLinecap="round"
            opacity={0.95}
          />
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4FC3F7" />
              <stop offset="50%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          {/* hole glow when open */}
          {holeHalfDeg > 2 && (
            <ellipse
              cx={W / 2}
              cy={ringY + ringR * 0.92}
              rx={ringR * Math.sin(holeRad) * 1.1}
              ry={6}
              fill="rgba(79,195,247,0.25)"
            />
          )}

          {/* lobby / release balls */}
          {(phase === "lobby" ||
            phase === "lock" ||
            phase === "release") &&
            sim.map((b) => (
              <AvatarBall
                key={b.id}
                cx={b.x}
                cy={b.y}
                username={b.username}
                photoUrl={b.photoUrl}
                highlight={
                  b.id === followBallId || b.telegramId === telegramId
                }
              />
            ))}

          {/* falling balls + separation */}
          {(phase === "fall" || phase === "finish") &&
            (() => {
              const R = 9;
              const pts = ballsMeta.map((b, i) => {
                const rank = b.finishRank ?? i + 1;
                const path = paths[b.id] || [];
                const pos = samplePath(
                  path,
                  fallProgress,
                  rank,
                  ballsMeta.length
                );
                return {
                  b,
                  cx: pos.x,
                  cy: pos.y,
                  dead: !!pos.dead,
                };
              });
              for (let pass = 0; pass < 3; pass++) {
                for (let i = 0; i < pts.length; i++) {
                  for (let j = i + 1; j < pts.length; j++) {
                    const a = pts[i];
                    const b = pts[j];
                    if (a.dead || b.dead) continue;
                    const dx = b.cx - a.cx;
                    const dy = b.cy - a.cy;
                    const dist = Math.hypot(dx, dy) || 0.0001;
                    const minD = R * 2;
                    if (dist >= minD) continue;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const push = (minD - dist) * 0.5;
                    a.cx -= nx * push;
                    a.cy -= ny * push;
                    b.cx += nx * push;
                    b.cy += ny * push;
                  }
                }
              }
              return pts.map(({ b, cx, cy, dead }) => {
                const isFollow =
                  b.id === followBallId || b.telegramId === telegramId;
                return (
                  <g key={b.id}>
                    {isFollow && !dead && (
                      <polygon
                        points={`${cx},${cy - 15} ${cx - 5},${cy - 8} ${cx + 5},${cy - 8}`}
                        fill="#FFEB3B"
                      />
                    )}
                    <AvatarBall
                      cx={cx}
                      cy={cy}
                      username={b.username}
                      photoUrl={b.photoUrl}
                      highlight={isFollow}
                      dead={dead}
                    />
                    {dead && (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={14}
                          fill="rgba(180,180,180,0.25)"
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={8}
                          fill="rgba(200,200,200,0.15)"
                        />
                      </g>
                    )}
                  </g>
                );
              });
            })()}
        </svg>

        {/* map name */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-black/50 border border-white/10 text-[10px] font-semibold text-white/70">
          {track.map.name.ru}
        </div>

        {/* GO */}
        {phase === "release" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div
              className="text-[80px] font-black text-white/30 tracking-tight"
              style={{
                animation: "raceGo 1.5s ease-out forwards",
                textShadow: "0 0 40px rgba(79,195,247,0.45)",
              }}
            >
              GO
            </div>
          </div>
        )}

        {/* anomaly banners */}
        {showAntiOn && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-purple-900/70 border border-purple-400/30 backdrop-blur-md flex items-center gap-2 whitespace-nowrap">
            <span className="text-lg">🌙</span>
            <span className="text-[12px] font-semibold text-white/90">
              Anomaly activated{" "}
              <span className="text-red-400">Anti</span>{" "}
              <span className="text-red-400">Gravity</span>
            </span>
          </div>
        )}
        {showAntiOff && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md flex items-center gap-2 whitespace-nowrap">
            <span className="text-lg opacity-60">🌙</span>
            <span className="text-[12px] font-semibold text-white/70">
              Anomaly deactivated{" "}
              <span className="text-red-400/80">Anti Gravity</span>
            </span>
          </div>
        )}

        {/* winner banner */}
        {phase === "finish" && room?.winnerBallId && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40 px-3 py-2 rounded-2xl bg-emerald-600/90 border border-emerald-300/30 flex items-center gap-2 shadow-lg max-w-[92%]">
            {(() => {
              const w = ballsMeta.find((b) => b.id === room.winnerBallId);
              if (!w) return null;
              return (
                <>
                  {w.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.photoUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-white font-bold">
                      {(w.username || "?")[0]}
                    </div>
                  )}
                  <div className="text-[12px] font-semibold text-white leading-tight">
                    <div>
                      @{w.username?.replace(/^@/, "") || "winner"} won
                    </div>
                    <div className="text-emerald-100">
                      {formatGram(room.pot * 0.95)} GRAM
                    </div>
                  </div>
                  <div className="ml-1 px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950 text-[11px] font-black">
                    X
                    {(
                      (room.pot * 0.95) /
                      Math.max(room.ballPrice, 0.01)
                    ).toFixed(2)}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {isLobby && ballsMeta.length === 0 && (
          <div className="absolute inset-x-6 top-[38%] z-20 text-center text-[12px] text-white/45 leading-relaxed pointer-events-none">
            Купи шарик — он в круге толкается с другими.
            <br />
            После таймера дырка плавно откроется — свободное падение.
          </div>
        )}

        <style>{`@keyframes raceGo{0%{opacity:0;transform:scale(.6)}25%{opacity:1;transform:scale(1.05)}100%{opacity:0;transform:scale(1.25)}}`}</style>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main screen — lobby / buy / history (Gramelle style)
───────────────────────────────────────────────────────────── */
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
          const dur = 28000;
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
        }, 1800);
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

  if (showHist) {
    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="text-[15px] font-semibold">{t("history")}</div>
          <BalancePill
            balance={balance}
            onDeposit={onDeposit}
            haptic={haptic}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 space-y-2">
          {history.length === 0 && (
            <div className="text-center text-white/40 text-sm py-10">
              {tr("No races yet", "Пока нет гонок")}
            </div>
          )}
          {history.map((h) => (
            <div
              key={h.roomId}
              className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5 text-[12px]"
            >
              <div className="flex justify-between text-white/70">
                <span>#{h.gameNo ?? "—"}</span>
                <span className="text-emerald-300">
                  {formatGram(h.pot)} GRAM
                </span>
              </div>
              <div className="text-white/40 mt-0.5 truncate">
                {h.won
                  ? tr(`Won ${formatGram(h.payout)} GRAM`, `Выигрыш ${formatGram(h.payout)} GRAM`)
                  : h.result || tr("Finished", "Завершено")}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pot = room?.pot ?? 0;
  const ballCount = room?.balls?.length ?? 0;
  const players = room
    ? new Set(room.balls.map((b) => b.telegramId)).size
    : 0;
  const secs = room?.secsLeft;

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {/* header */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold">
              {tr("Race", "Гонка")}
            </span>
            <span className="text-[12px] font-bold text-amber-300">
              {formatGram(pot)} GRAM
            </span>
          </div>
          <div className="text-[11px] text-white/40">
            {room?.status === "countdown"
              ? tr("Countdown", "Обратный отсчёт")
              : room?.status === "racing" || room?.status === "finished"
                ? tr("Live race", "Идёт гонка")
                : tr("Live lobby — buy a ball", "Live-лобби — купи шарик")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openHistory()}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60"
            aria-label="history"
          >
            ↺
          </button>
          <BalancePill
            balance={balance}
            onDeposit={onDeposit}
            haptic={haptic}
          />
        </div>
      </div>

      {/* stage */}
      <div className="px-3 mt-1 flex-1 flex flex-col items-center">
        <RaceStage
          room={room}
          phase={phase}
          followBallId={followBallId}
          telegramId={telegramId}
          fallProgress={fallProgress}
        />
      </div>

      {/* footer stats + buy */}
      <div className="px-4 mt-3 space-y-2">
        <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2 flex items-center justify-between text-[11px] text-white/55">
          <span>
            {ballCount} {tr("balls", "шар.")} · {players}{" "}
            {tr("players", "игр.")}
            {secs != null && room?.status === "countdown"
              ? ` · ${secs}s`
              : ""}
          </span>
          <div className="flex gap-1.5">
            {room?.serverSeedHash && (
              <HashChip
                label="HASH"
                value={room.serverSeedHash.slice(0, 10)}
              />
            )}
            {room?.serverSeed && (
              <HashChip label="SEED" value={room.serverSeed.slice(0, 10)} />
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || room?.buyLocked}
            onClick={() => void ensureAndBuy(1)}
            className="flex-1 h-12 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-40 shadow-[0_8px_28px_rgba(34,211,238,0.25)]"
          >
            {tr("Buy ball", "Купить шарик")} · {formatGram(RACE_MIN_BALL)}
          </button>
          <button
            type="button"
            disabled={busy || room?.buyLocked}
            onClick={() => void ensureAndBuy(3)}
            className="h-12 px-4 rounded-2xl bg-white/8 border border-white/12 text-sm font-semibold disabled:opacity-40"
          >
            ×3
          </button>
        </div>

        {room && room.status === "open" && room.hostTelegramId === telegramId && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onCancel()}
            className="w-full text-center text-[12px] text-white/35 py-1"
          >
            {tr("Cancel lobby", "Отменить лобби")}
          </button>
        )}
      </div>
    </div>
  );
}

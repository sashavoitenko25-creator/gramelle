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
};

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
  // long vertical course — camera scrolls down
  const trackTop = ringY + 40;
  const trackBot = H * 0.92;
  const segH = (trackBot - trackTop - 40) / Math.max(segs.length, 1);
  const pegs: Peg[] = [];
  const walls: Wall[] = [];
  const leftX = W * 0.04;
  const rightX = W * 0.96;

  // invisible soft side bounds only
  walls.push(
    { x1: leftX, y1: trackTop, x2: leftX, y2: trackBot },
    { x1: rightX, y1: trackTop, x2: rightX, y2: trackBot }
  );

  segs.forEach((kind, si) => {
    const y0 = trackTop + si * segH;
    const midY = y0 + segH * 0.5;

    if (kind === "platforms") {
      // MyBalls: thick blue shelves with side gaps + numbered zones
      const levels = 2;
      for (let lv = 0; lv < levels; lv++) {
        const yy = y0 + 20 + lv * (segH * 0.42);
        const gapLeft = lv % 2 === 0;
        if (gapLeft) {
          // gap on left — platform on right
          walls.push({ x1: W * 0.42, y1: yy, x2: rightX - 6, y2: yy });
          pegs.push({ x: W * 0.72, y: yy + 14, r: 1, kind: "label" });
        } else {
          walls.push({ x1: leftX + 6, y1: yy, x2: W * 0.58, y2: yy });
          pegs.push({ x: W * 0.28, y: yy + 14, r: 1, kind: "label" });
        }
      }
    } else if (kind === "crosses") {
      // large blue + crosses (balls fall through arms)
      const positions = [
        [0.28, 0.28],
        [0.72, 0.28],
        [0.5, 0.62],
        [0.28, 0.85],
        [0.72, 0.85],
      ];
      for (const [ux, uy] of positions) {
        const cx = W * ux;
        const cy = y0 + uy * segH;
        const arm = Math.min(28, segH * 0.18);
        walls.push(
          { x1: cx - arm, y1: cy, x2: cx + arm, y2: cy },
          { x1: cx, y1: cy - arm, x2: cx, y2: cy + arm }
        );
        pegs.push({ x: cx, y: cy, r: arm, kind: "cross" });
      }
    } else if (kind === "dots") {
      // dense blue pin grid — soft bumpers
      const rows = 5;
      const cols = 7;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const odd = r % 2;
          pegs.push({
            x: W * (0.12 + ((c + odd * 0.5) / (cols - 0.5)) * 0.76),
            y: y0 + 16 + (r / (rows - 1)) * (segH - 32),
            r: 3.5,
            kind: "dot",
          });
        }
      }
    } else if (kind === "arcs") {
      // incomplete C-rings — thick stroke arcs
      for (let i = 0; i < 3; i++) {
        const cx = W * (0.28 + (i % 2) * 0.44);
        const cy = y0 + 30 + Math.floor(i / 1.5) * (segH * 0.4);
        const rr = Math.min(48, segH * 0.28);
        pegs.push({ x: cx, y: cy, r: rr, kind: "arc" });
        // collision samples along arc (not full circle)
        for (let a = 0; a < 10; a++) {
          const ang = -0.3 + (a / 9) * Math.PI * 1.5;
          pegs.push({
            x: cx + Math.cos(ang) * rr,
            y: cy + Math.sin(ang) * rr,
            r: 4,
            kind: "arc_edge",
          });
        }
      }
    } else if (kind === "bomb") {
      for (let i = 0; i < 2; i++) {
        pegs.push({
          x: W * (0.35 + i * 0.3),
          y: midY + (i === 0 ? -10 : 18),
          r: 16,
          kind: "bomb",
        });
      }
    } else if (kind === "antigrav") {
      pegs.push({ x: W * 0.5, y: midY, r: 55, kind: "antigrav" });
    } else if (kind === "funnel") {
      // V funnel into finish
      walls.push(
        { x1: leftX, y1: y0 + 8, x2: W * 0.42, y2: trackBot - 28 },
        { x1: rightX, y1: y0 + 8, x2: W * 0.58, y2: trackBot - 28 }
      );
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
  let y = ringY + 6;
  let vx = (seed - 0.5) * 2.0 + ((seat % 7) - 3) * 0.3;
  let vy = 1.4 + seed * 0.4;
  const g = 0.22;
  const air = 0.999;
  const points: { x: number; y: number }[] = [{ x, y }];

  const resolveWall = () => {
    // side bounds
    if (x - R < leftX) {
      x = leftX + R;
      if (vx < 0) vx = -vx * 0.35;
    }
    if (x + R > rightX) {
      x = rightX - R;
      if (vx > 0) vx = -vx * 0.35;
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
      // thick platforms: collision radius includes half wall thickness
      const isFlat = Math.abs(dy) < 2.5 && Math.abs(dx) > 12;
      const wallHalf = isFlat ? 7 : 4;
      const rad = R + wallHalf;
      if (dist < rad) {
        const nx = ox / dist;
        const ny = oy / dist;
        // full push-out — no sinking into texture
        x += nx * (rad - dist);
        y += ny * (rad - dist);
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          if (isFlat && ny < -0.4) {
            // rest on platform, slide
            vy *= 0.15;
            vx *= 0.97;
            vx += (seed - 0.5) * 0.06;
            if (Math.abs(vx) < 0.15) vx += (seed > 0.5 ? 0.2 : -0.2);
          } else {
            vx -= 1.2 * vn * nx;
            vy -= 0.9 * vn * ny;
            vx *= 0.94;
            if (vy < 0.35) vy = 0.35 + seed * 0.1;
          }
        }
      }
    }
    for (const p of pegs) {
      if (p.kind === "label" || p.kind === "cross" || p.kind === "arc") continue;
      if (p.kind === "antigrav") {
        const dx = x - p.x;
        const dy = y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < p.r) {
          vy -= (1 - dist / p.r) * 0.26;
          vx += (seed - 0.5) * 0.04;
        }
        continue;
      }
      const pr =
        p.kind === "dot" ? 3.5 : p.kind === "arc_edge" ? 4.5 : p.kind === "bomb" ? 15 : p.r;
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
          const soft = p.kind === "bomb" ? 0.65 : 0.38;
          vx -= (1 + soft) * vn * nx;
          vy -= (0.7 + soft * 0.35) * vn * ny;
          vx += (seed - 0.5) * 0.2;
          if (vy < 0.3) vy = 0.3 + seed * 0.1;
        }
      }
    }
  };

  for (let step = 0; step < 1800; step++) {
    for (let sub = 0; sub < 3; sub++) {
      vy += g / 3;
      vx *= air;
      x += vx / 3;
      y += vy / 3;
      resolveWall();
    }
    if (vy > 6.2) vy = 6.2;
    if (Math.abs(vx) > 4.2) vx *= 0.9;

    if (y > trackBot - 4) {
      y = trackBot - 4;
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
  // rank only slightly delays later finishers (visual, order still from server)
  const bias = (rank - 1) / Math.max(total, 1);
  let tt = t * (1 - bias * 0.18) - bias * 0.02;
  tt = Math.min(1, Math.max(0, tt));
  // smoothstep for softer motion along path
  tt = tt * tt * (3 - 2 * tt);
  if (path.length < 2) return path[0] || { x: 0, y: 0 };
  const f = tt * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(f));
  const u = f - i;
  // hermite-ish smooth between points
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
  const clipId = `av-${Math.round(cx * 10)}-${Math.round(cy * 10)}-${r}`;
  // fixed visual size — same for everyone (MyBalls style)
  const R = 9;
  return (
    <g>
      {/* subtle warm ring for followed ball — not blue */}
      {highlight && (
        <circle
          cx={cx}
          cy={cy}
          r={R + 3}
          fill="none"
          stroke="rgba(251,191,36,0.55)"
          strokeWidth="1.5"
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={R + 0.8}
        fill="#0a0a10"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.9"
      />
      {photoUrl ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle cx={cx} cy={cy} r={R} />
            </clipPath>
          </defs>
          <image
            href={photoUrl}
            x={cx - R}
            y={cy - R}
            width={R * 2}
            height={R * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <g>
          <circle cx={cx} cy={cy} r={R} fill="#1e293b" />
          <text
            x={cx}
            y={cy + 3.5}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="9"
            fontWeight="700"
          >
            {initial}
          </text>
        </g>
      )}
    </g>
  );
}

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
  const H = 720;
  const isLobby = phase === "lobby" || phase === "lock";
  const holeOpen =
    phase === "release" || phase === "fall" || phase === "finish";

  // lobby: ring upper-center + track preview below; race: ring top
  const ringY = isLobby ? H * 0.3 : H * 0.11;
  const ringR = isLobby ? 96 : 70;
  const track = useMemo(() => buildTrack(mapId, W, H, H * 0.11), [mapId]);

  const [sim, setSim] = useState<SimBall[]>([]);
  const simRef = useRef<SimBall[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  // smooth hole open 0→1 after timer
  const [holeAnim, setHoleAnim] = useState(0);
  const holeAnimRef = useRef(0);
  const holeHalfDeg = holeAnim * 58;

  // smooth hole open when entering release
  useEffect(() => {
    if (phase === "release" || phase === "fall" || phase === "finish") {
      const start = performance.now();
      const dur = 1400; // ms to fully open
      let raf = 0;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = t * t * (3 - 2 * t);
        holeAnimRef.current = e;
        setHoleAnim(e);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      // if already open from previous, keep
      if (holeAnimRef.current < 0.99) {
        raf = requestAnimationFrame(tick);
      } else {
        setHoleAnim(1);
        holeAnimRef.current = 1;
      }
      return () => cancelAnimationFrame(raf);
    } else {
      holeAnimRef.current = 0;
      setHoleAnim(0);
    }
  }, [phase]);

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
        // spawn INSIDE the ring, spread around, gentle velocity
        const ang = seed * Math.PI * 2 + i * 0.7;
        const rad = ringR * (0.15 + seed * 0.35);
        next.push({
          id: b.id,
          username: b.username,
          photoUrl: b.photoUrl,
          telegramId: b.telegramId,
          seat: b.seat,
          finishRank: b.finishRank,
          x: W / 2 + Math.cos(ang) * rad,
          y: ringY + Math.sin(ang) * rad * 0.85,
          vx: Math.cos(ang + 1.2) * (1.2 + seed),
          vy: Math.sin(ang + 0.4) * (0.8 + seed * 0.5) - 0.3,
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
    // fixed-feel constants (per ~16ms frame)
    const G = 0.26;
    const DAMP = 0.991;
    const WALL_REST = 0.55;
    const BALL_REST = 0.82;
    const FRIC = 0.08;

    const tick = (now: number) => {
      // real seconds, clamped
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      if (dt < 0.001) dt = 0.001;

      const ph = phaseRef.current;
      const open = ph === "release" || ph === "fall" || ph === "finish";
      const onTrack = ph === "fall" || ph === "finish";

      if (onTrack) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const cx = W / 2;
      const cy = ringY;
      // hole half-angle in radians at bottom (PI/2)
      const holeHalf = open ? holeAnimRef.current * (58 * Math.PI) / 180 : 0;
      // scale forces so motion is similar at 60fps
      const steps = Math.max(2, Math.min(8, Math.ceil(dt / 0.006)));
      const h = dt / steps;

      let balls = simRef.current.map((b) => ({ ...b }));

      for (let s = 0; s < steps; s++) {
        // integrate
        for (const b of balls) {
          b.vy += G * h * 60; // ~frame-scale gravity
          b.vx *= Math.pow(DAMP, h * 60);
          b.vy *= Math.pow(DAMP, h * 60);
          b.x += b.vx * h * 60;
          b.y += b.vy * h * 60;
        }

        // ring containment
        for (const b of balls) {
          const dx = b.x - cx;
          const dy = b.y - cy;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const maxD = ringR - b.r - 0.5;

          // hole at bottom: angle ~ +PI/2 in atan2
          let inHole = false;
          if (open && holeHalf > 0) {
            const a = Math.atan2(dy, dx);
            let dA = a - Math.PI / 2;
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            // only allow exit when near the rim and inside hole sector
            inHole = Math.abs(dA) < holeHalf && dist > maxD * 0.55;
          }

          if (dist > maxD && !inHole) {
            const nx = dx / dist;
            const ny = dy / dist;
            b.x = cx + nx * maxD;
            b.y = cy + ny * maxD;
            const vn = b.vx * nx + b.vy * ny;
            if (vn > 0) {
              b.vx -= (1 + WALL_REST) * vn * nx;
              b.vy -= (1 + WALL_REST) * vn * ny;
            }
            // tangential friction so balls settle
            const vtx = b.vx - vn * nx;
            const vty = b.vy - vn * ny;
            b.vx -= vtx * FRIC * 2;
            b.vy -= vty * FRIC * 2;
          }

          // soft floor when closed
          if (!open) {
            const floorY = cy + maxD;
            if (b.y > floorY) {
              b.y = floorY;
              if (b.vy > 0) b.vy *= -WALL_REST;
              b.vx *= 0.97;
            }
          }

          // speed clamp
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > 9) {
            b.vx *= 9 / sp;
            b.vy *= 9 / sp;
          }
        }

        // ball-ball collisions (iterative for stability with many balls)
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
              // positional correction (split)
              const corr = overlap * 0.55;
              a.x -= nx * corr;
              a.y -= ny * corr;
              b.x += nx * corr;
              b.y += ny * corr;

              const va = a.vx * nx + a.vy * ny;
              const vb = b.vx * nx + b.vy * ny;
              const rel = va - vb;
              if (rel > 0) {
                // separating already after correction
                continue;
              }
              // equal mass impulse
              const jImp = (-(1 + BALL_REST) * rel) / 2;
              a.vx -= jImp * nx;
              a.vy -= jImp * ny;
              b.vx += jImp * nx;
              b.vy += jImp * ny;
              // light friction
              const tvx = a.vx - va * nx - (b.vx - vb * nx);
              const tvy = a.vy - va * ny - (b.vy - vb * ny);
              // skip complex friction; mild damping
              a.vx *= 0.998;
              a.vy *= 0.998;
              b.vx *= 0.998;
              b.vy *= 0.998;
            }
          }
        }
      }

      // drop balls that fully exited the ring during release
      if (open) {
        balls = balls.filter((b) => {
          const dx = b.x - cx;
          const dy = b.y - cy;
          const dist = Math.hypot(dx, dy);
          // still inside or just leaving
          if (dist < ringR + b.r * 2 && b.y < cy + ringR + 40) return true;
          // far below — let fall animation take over (keep in sim until phase changes)
          return b.y < cy + ringR + 120;
        });
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

  // follow lead ball vertically (MyBalls-style camera)
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
      ? 8
      : leadPos
        ? Math.max(-20, Math.min(H * 0.55, leadPos.y - H * 0.35))
        : 10 + fallProgress * 70;
  const camScale = isLobby
    ? 1.0
    : phase === "release"
      ? 1.05
      : 0.95;
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
        className="relative bg-[#05050a] will-change-transform overflow-hidden aspect-[3/4.6]"
        style={{
          transform: `scale(${camScale}) translateY(${-camY * 0.85}px)`,
          transformOrigin: "50% 0%",
          transition:
            phase === "fall" || phase === "finish"
              ? "transform 90ms linear"
              : "transform 1.2s cubic-bezier(.33,.9,.25,1)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1020] via-[#070712] to-[#030308]" />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% ${isLobby ? "50%" : "8%"}, ${accent}22, transparent 60%)`,
          }}
        />

        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-black/50 border border-white/10 text-[10px] font-semibold text-white/65">
          {track.map.name.ru}
        </div>
        {phase === "release" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div
              className="text-[72px] font-black text-white/25 tracking-tight"
              style={{
                animation: "raceGo 1.4s ease-out forwards",
                textShadow: "0 0 40px rgba(56,189,248,0.4)",
              }}
            >
              GO
            </div>
          </div>
        )}
        <style>{`@keyframes raceGo{0%{opacity:0;transform:scale(.6)}30%{opacity:1;transform:scale(1.05)}100%{opacity:0;transform:scale(1.2)}}`}</style>

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
            <radialGradient id="antiG">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </radialGradient>
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

          {track.walls.map((w, i) => {
              const isSide =
                Math.abs(w.x1 - w.x2) < 2 && Math.abs(w.y1 - w.y2) > 40;
              if (isSide) {
                // side bounds nearly invisible
                return (
                  <line
                    key={`w-${i}`}
                    x1={w.x1}
                    y1={w.y1}
                    x2={w.x2}
                    y2={w.y2}
                    stroke={accent}
                    strokeWidth="1"
                    opacity={isLobby ? 0.08 : 0.12}
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
                  stroke={accent}
                  strokeWidth={isFlat ? 14 : 8}
                  strokeLinecap="round"
                  opacity={isLobby ? 0.4 : 0.95}
                  style={{
                    filter: isLobby
                      ? undefined
                      : `drop-shadow(0 0 10px ${accent})`,
                  }}
                />
              );
            })}

          <g opacity={isLobby ? 0.45 : 1}>
          {track.pegs.map((pg, i) => {
              if (pg.kind === "bomb") {
                return (
                  <g key={`p-${i}`}>
                    <circle
                      cx={pg.x}
                      cy={pg.y}
                      r={pg.r + 2}
                      fill="rgba(15,20,30,0.9)"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                    />
                    <text
                      x={pg.x}
                      y={pg.y + 5}
                      textAnchor="middle"
                      fontSize="16"
                    >
                      💣
                    </text>
                  </g>
                );
              }
              if (pg.kind === "cross") {
                // thick glowing + already drawn as walls; center glow
                return (
                  <g key={`p-${i}`}>
                    <line
                      x1={pg.x - pg.r}
                      y1={pg.y}
                      x2={pg.x + pg.r}
                      y2={pg.y}
                      stroke={accent}
                      strokeWidth="10"
                      strokeLinecap="round"
                      opacity="0.95"
                      style={{ filter: `drop-shadow(0 0 8px ${accent})` }}
                    />
                    <line
                      x1={pg.x}
                      y1={pg.y - pg.r}
                      x2={pg.x}
                      y2={pg.y + pg.r}
                      stroke={accent}
                      strokeWidth="10"
                      strokeLinecap="round"
                      opacity="0.95"
                      style={{ filter: `drop-shadow(0 0 8px ${accent})` }}
                    />
                  </g>
                );
              }
              if (pg.kind === "arc") {
                // incomplete ring stroke
                const r = pg.r;
                const startA = -0.3;
                const endA = Math.PI * 1.2;
                const x1 = pg.x + Math.cos(startA) * r;
                const y1 = pg.y + Math.sin(startA) * r;
                const x2 = pg.x + Math.cos(endA) * r;
                const y2 = pg.y + Math.sin(endA) * r;
                const large = endA - startA > Math.PI ? 1 : 0;
                return (
                  <path
                    key={`p-${i}`}
                    d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
                    fill="none"
                    stroke={accent}
                    strokeWidth="9"
                    strokeLinecap="round"
                    opacity="0.92"
                    style={{ filter: `drop-shadow(0 0 10px ${accent})` }}
                  />
                );
              }
              if (pg.kind === "arc_edge" || pg.kind === "label") {
                return null;
              }
              if (pg.kind === "antigrav") {
                return (
                  <g key={`p-${i}`} opacity="0.55">
                    <circle
                      cx={pg.x}
                      cy={pg.y}
                      r={pg.r}
                      fill="url(#antiG)"
                      stroke="#c084fc"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                    />
                    <text
                      x={pg.x}
                      y={pg.y + 4}
                      textAnchor="middle"
                      fill="#e9d5ff"
                      fontSize="9"
                      fontWeight="700"
                    >
                      ANTI-G
                    </text>
                  </g>
                );
              }
              // dots / pegs — small cyan pins
              return (
                <circle
                  key={`p-${i}`}
                  cx={pg.x}
                  cy={pg.y}
                  r={pg.r}
                  fill={accent}
                  opacity="0.9"
                  style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
                />
              );
            })}
          </g>

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
                  r={9}
                  username={b.username}
                  photoUrl={b.photoUrl}
                  highlight={isFollow}
                />
              );
            })}

          {/* track fall */}
          {(phase === "fall" || phase === "finish") &&
            (() => {
              // sample all, then separate so balls don't clip each other
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
                const holeX = W / 2 + (hash01(b.id) - 0.5) * 20;
                const holeY = H * 0.11 - 20;
                const finY = track.trackBot;
                const e =
                  fallProgress *
                  fallProgress *
                  (3 - 2 * fallProgress);
                return {
                  b,
                  i,
                  cx:
                    path.length > 4
                      ? pos.x
                      : holeX + Math.sin(e * Math.PI * 2 + i) * 12 * (1 - e),
                  cy: path.length > 4 ? pos.y : holeY + (finY - holeY) * e,
                };
              });
              for (let pass = 0; pass < 3; pass++) {
                for (let i = 0; i < pts.length; i++) {
                  for (let j = i + 1; j < pts.length; j++) {
                    const a = pts[i];
                    const b = pts[j];
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
              return pts.map(({ b, cx, cy }) => {
                const isFollow =
                  b.id === followBallId || b.telegramId === telegramId;
                return (
                  <g key={b.id}>
                    {isFollow && (
                      <polygon
                        points={`${cx},${cy - 15} ${cx - 5},${cy - 8} ${cx + 5},${cy - 8}`}
                        fill="#fbbf24"
                      />
                    )}
                    <AvatarBall
                      cx={cx}
                      cy={cy}
                      r={9}
                      username={b.username}
                      photoUrl={b.photoUrl}
                      highlight={isFollow}
                    />
                  </g>
                );
              });
            })()}

          <g opacity={isLobby ? 0.4 : 1}>
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
        </svg>

        {ballsMeta.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-8">
            <div className="text-center text-[13px] text-white/40 leading-relaxed">
              Купи шарик — он в круге толкается с другими.
              <br />
              Трасса внизу. После таймера дырка плавно откроется — шарики выпадут.
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
            // ease-in-out so start/end soft, mid steady
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

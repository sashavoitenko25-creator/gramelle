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

function pegLayout(mapId: string | null, w: number, h: number) {
  const pegs: { x: number; y: number; r: number }[] = [];
  const style = RACE_MAPS.find((m) => m.id === mapId)?.pegs || "staggered";
  const top = h * 0.38;
  const bottom = h * 0.82;
  const rows = style === "dense" ? 9 : style === "funnel" ? 7 : 6;

  for (let row = 0; row < rows; row++) {
    const t = row / Math.max(rows - 1, 1);
    const y = top + t * (bottom - top);
    let cols = 5;
    let inset = 0.12;
    if (style === "funnel") {
      cols = 3 + Math.floor(t * 5);
      inset = 0.08 + t * 0.12;
    } else if (style === "dense") {
      cols = 7;
      inset = 0.08;
    } else if (style === "lanes") {
      cols = 4;
      inset = 0.18;
    } else if (style === "zigzag") {
      cols = 5;
      inset = 0.1 + (row % 2) * 0.06;
    } else {
      cols = 5 + (row % 2);
      inset = 0.1 + (row % 2) * 0.04;
    }
    for (let c = 0; c < cols; c++) {
      const u = cols === 1 ? 0.5 : c / (cols - 1);
      const x = w * (inset + u * (1 - 2 * inset));
      pegs.push({ x, y, r: style === "dense" ? 3.2 : 4 });
    }
  }
  return pegs;
}

/** Full-bleed race stage with camera */
function RaceStage({
  room,
  phase,
  followBallId,
  telegramId,
}: {
  room: RaceRoomPublic | null;
  phase: Phase;
  followBallId: string | null;
  telegramId: number;
}) {
  const balls = room?.balls || [];
  const n = Math.max(balls.length, 1);
  const mapId = room?.mapId || null;
  const mapMeta = RACE_MAPS.find((m) => m.id === mapId);

  // Camera: 0 = ring focus, 1 = track follow
  const cam =
    phase === "lobby" || phase === "lock"
      ? { scale: 1.15, ty: 0 }
      : phase === "release"
        ? { scale: 0.92, ty: 8 }
        : phase === "fall"
          ? { scale: 0.78, ty: 42 }
          : { scale: 0.72, ty: 55 };

  const W = 320;
  const H = 520;
  const pegs = useMemo(() => pegLayout(mapId, W, H), [mapId]);

  const followIdx = Math.max(
    0,
    balls.findIndex((b) => b.id === followBallId)
  );

  return (
    <div className="relative w-full overflow-hidden rounded-[28px] border border-white/[0.1] shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
      <div
        className="relative aspect-[3/4.2] bg-[#05050a] transition-transform duration-[1400ms] ease-out will-change-transform"
        style={{
          transform: `scale(${cam.scale}) translateY(${cam.ty}px)`,
          transformOrigin: "50% 18%",
        }}
      >
        {/* deep space bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1020] via-[#080814] to-[#030308]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgba(34,211,238,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_100%,rgba(168,85,247,0.14),transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />

        {/* map name */}
        {(phase === "release" || phase === "fall" || phase === "finish") &&
          mapMeta && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-black/50 border border-white/15 backdrop-blur-md text-[10px] font-semibold tracking-wide text-white/70">
              {mapMeta.name.ru}
            </div>
          )}

        {/* pot */}
        <div className="absolute top-3 right-3 z-30 px-2.5 py-1 rounded-full bg-black/45 border border-cyan-400/25 backdrop-blur-md text-[11px] font-bold tabular-nums text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
          {formatGram(room?.pot || 0)} <span className="text-white/35 font-medium">GRAM</span>
        </div>

        {/* SVG world */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="ballGlow" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="40%" stopColor="#fff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
            </radialGradient>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f472b6" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="finishGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.0" />
              <stop offset="50%" stopColor="#34d399" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.1" />
            </linearGradient>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* containment ring */}
          <g
            style={{
              transformOrigin: `${W / 2}px ${H * 0.22}px`,
              animation:
                phase === "lobby" || phase === "lock"
                  ? "race-spin 7s linear infinite"
                  : phase === "release"
                    ? "race-spin 2.2s linear infinite"
                    : "none",
            }}
          >
            <circle
              cx={W / 2}
              cy={H * 0.22}
              r={78}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="3.5"
              opacity="0.85"
              filter="url(#softGlow)"
            />
            <circle
              cx={W / 2}
              cy={H * 0.22}
              r={78}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
              strokeDasharray="6 10"
            />
            {/* aperture gap marker (top) */}
            <path
              d={`M ${W / 2 - 16} ${H * 0.22 - 78} A 78 78 0 0 1 ${W / 2 + 16} ${H * 0.22 - 78}`}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="5"
              strokeLinecap="round"
              opacity={phase === "release" || phase === "fall" || phase === "finish" ? 0.15 : 0.95}
              filter="url(#softGlow)"
            />
          </g>

          {/* curtain / gate at top */}
          <g>
            <rect
              x={W / 2 - 28}
              y={H * 0.22 - 96}
              width={56}
              height={22}
              rx={8}
              fill="url(#ringGrad)"
              opacity={
                phase === "release" || phase === "fall" || phase === "finish"
                  ? 0.12
                  : 0.9
              }
              style={{
                transform:
                  phase === "release" || phase === "fall" || phase === "finish"
                    ? "translateY(-28px)"
                    : "translateY(0)",
                transition: "transform 1.1s cubic-bezier(.2,.8,.2,1), opacity 0.8s",
              }}
            />
          </g>

          {/* balls in ring / falling */}
          {balls.map((b, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const rx = W / 2 + Math.cos(angle) * 52;
            const ry = H * 0.22 + Math.sin(angle) * 52;
            const rank = b.finishRank ?? i + 1;
            const fallT =
              phase === "fall" || phase === "finish"
                ? Math.min(1, 0.15 + (rank - 1) * 0.08)
                : 0;
            // fall path with slight horizontal drift from seat
            const drift = ((b.seat * 17) % 40) - 20;
            const fallX = W / 2 + drift * fallT;
            const fallY =
              H * 0.22 + fallT * (H * 0.55 + (rank - 1) * 6);
            const isFollow = b.id === followBallId || b.telegramId === telegramId;
            const cx =
              phase === "fall" || phase === "finish" || phase === "release"
                ? fallX
                : rx;
            const cy =
              phase === "fall" || phase === "finish"
                ? fallY
                : phase === "release"
                  ? H * 0.22 + 8
                  : ry;
            const r = isFollow ? 7.5 : 6;

            return (
              <g key={b.id} filter="url(#softGlow)">
                {isFollow && (phase === "fall" || phase === "finish") && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 6}
                    fill="none"
                    stroke={b.color}
                    strokeWidth="1.2"
                    opacity="0.45"
                  >
                    <animate
                      attributeName="r"
                      values={`${r + 4};${r + 10};${r + 4}`}
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.5;0.15;0.5"
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle cx={cx} cy={cy} r={r} fill={b.color} opacity="0.95">
                  {(phase === "lobby" || phase === "lock") && (
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from={`0 ${W / 2} ${H * 0.22}`}
                      to={`360 ${W / 2} ${H * 0.22}`}
                      dur="7s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
                <circle cx={cx - 1.5} cy={cy - 1.5} r={r * 0.35} fill="#fff" opacity="0.45" />
              </g>
            );
          })}

          {/* obstacle pegs — only after release */}
          {(phase === "release" || phase === "fall" || phase === "finish") &&
            pegs.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill="rgba(255,255,255,0.22)"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="0.5"
              />
            ))}

          {/* finish band */}
          <rect
            x={24}
            y={H * 0.88}
            width={W - 48}
            height={28}
            rx={10}
            fill="url(#finishGrad)"
            stroke="rgba(52,211,153,0.45)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          <text
            x={W / 2}
            y={H * 0.88 + 18}
            textAnchor="middle"
            fill="rgba(167,243,208,0.85)"
            fontSize="11"
            fontWeight="700"
            letterSpacing="3"
          >
            FINISH
          </text>
        </svg>

        {/* empty state */}
        {balls.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center px-6">
              <div className="text-[15px] font-semibold text-white/70 mb-1">
                Race Live
              </div>
              <div className="text-[12px] text-white/35 leading-relaxed">
                Купи шарик — он появится в кольце.
                <br />
                Со 2-го игрока пойдёт таймер.
              </div>
            </div>
          </div>
        )}
      </div>
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
    Awaited<ReturnType<typeof import("@/lib/raceApi").raceHistory>>["items"]
  >([]);
  const [phase, setPhase] = useState<Phase>("lobby");
  const animKey = useRef<string>("");

  const followBallId = useMemo(() => {
    if (!room) return null;
    const mine = room.balls.filter((b) => b.telegramId === telegramId);
    if (!mine.length) return room.balls[0]?.id ?? null;
    // follow best (lowest rank) or first mine
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

  // Phase machine from room status
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
        const t1 = setTimeout(() => setPhase("fall"), 1100);
        const t2 = setTimeout(() => {
          setPhase("finish");
          if (room.status === "racing") {
            void raceProcess(room.id).then((r) => {
              if (r.room) setRoom(r.room);
              onReloadBalance();
            });
          } else {
            onReloadBalance();
          }
        }, 9000);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      }
    }
  }, [room, onReloadBalance]);

  const ensureAndBuy = async (count: number) => {
    if (busy) return;
    const price = room?.ballPrice ?? RACE_MIN_BALL;
    const total = price * count;
    if (balance < total) {
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
  const canBuy =
    !room ||
    room.canBuy ||
    room.status === "finished" ||
    room.status === "cancelled" ||
    (!room.status && true);

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
                  <HashChip label="Hash" value={h.serverSeedHash} onCopy={copyText} />
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
      {/* top bar */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-tight">
            {tr("Race", "Гонка")}
          </div>
          <div className="text-[11px] text-white/40">
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
          className="w-9 h-9 rounded-xl glass border border-white/[0.08] flex items-center justify-center text-white/45 btn-press"
          aria-label={t("history")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
        />

        {/* status + fairness */}
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
            <HashChip label="Hash" value={room?.serverSeedHash} onCopy={copyText} />
            <HashChip label="Seed" value={room?.serverSeed} onCopy={copyText} />
          </div>
        </div>

        {/* buy controls */}
        {(phase === "lobby" || !room || room.status === "finished" || room.status === "cancelled") && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || (room != null && room.status === "countdown" && !room.canBuy)}
              onClick={() => void ensureAndBuy(1)}
              className="flex-1 h-12 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-40 shadow-[0_8px_28px_rgba(34,211,238,0.25)]"
            >
              {tr("Buy ball", "Купить шарик")} · {formatGram(room?.ballPrice ?? RACE_MIN_BALL)}
            </button>
            <button
              type="button"
              disabled={busy || (room != null && room.status === "countdown" && !room.canBuy)}
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

        {/* participants */}
        {room && room.balls.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-white/35 px-0.5">
              {tr("In the ring", "В кольце")}
            </div>
            {Object.entries(
              room.balls.reduce<Record<string, { name: string; n: number; color: string; mine: boolean }>>(
                (acc, b) => {
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
                },
                {}
              )
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
                  style={{ background: u.color, boxShadow: `0 0 10px ${u.color}` }}
                />
                <span className="flex-1 text-[13px] truncate">
                  @{u.name}
                  {u.mine ? ` (${tr("you", "вы")})` : ""}
                </span>
                <span className="text-[12px] text-white/45 tabular-nums">×{u.n}</span>
              </div>
            ))}
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>
  );
}

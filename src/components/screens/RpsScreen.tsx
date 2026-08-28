"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatGram, formatTime } from "@/lib/utils";
import {
  rpsCancel,
  rpsCreate,
  rpsHistory,
  rpsJoin,
  rpsList,
  rpsState,
  type RpsChoice,
  type RpsPublicRoom,
} from "@/lib/rpsApi";
import {
  ChoiceButton,
  ChoiceIcon,
  CHOICE_LABEL,
} from "@/components/rps/RpsIcons";
import { RPS_MIN_BET, RPS_MAX_BET, RPS_REVEAL_SEC } from "@/lib/rpsConstants";
import { playWinSound, playLoseSound } from "@/lib/sounds";

interface RpsScreenProps {
  balance: number;
  telegramId: number | null;
  username: string;
  photoUrl?: string | null;
  serverMode: boolean;
  onBack: () => void;
  onBalanceUpdate: (b: number) => void;
  onReloadBalance?: () => void;
  showToast: (msg: string) => void;
  haptic: (type?: "light" | "medium" | "heavy") => void;
  hapticSuccess: () => void;
  hapticError: () => void;
}

type View = "lobby" | "create" | "join" | "reveal" | "result" | "history";

const QUICK_AMOUNTS = [0.5, 1, 2, 5, 10, 25];
const CYCLE: RpsChoice[] = ["rock", "paper", "scissors"];

type HistItem = {
  id: string;
  room_id?: string;
  opponent: string;
  my_choice: RpsChoice;
  opponent_choice: RpsChoice;
  amount: number;
  result: "win" | "lose" | "draw";
  payout: number;
  server_seed?: string;
  server_seed_hash?: string;
  creator_choice_hash?: string;
  created_at: string;
};

/* ─── SFX ──────────────────────────────────────────────── */
let audioCtx: AudioContext | null = null;
function getAudio() {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx)
      audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    return audioCtx;
  } catch {
    return null;
  }
}
function beep(
  freq: number,
  dur = 0.06,
  gain = 0.05,
  type: OscillatorType = "sine"
) {
  const c = getAudio();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}
function playTick() {
  beep(380 + Math.random() * 120, 0.035, 0.03, "triangle");
}
function playLand() {
  beep(220, 0.1, 0.07, "sine");
  beep(440, 0.08, 0.04, "triangle");
}
function playCountdown() {
  beep(520, 0.12, 0.07, "sine");
}

/* ─── helpers ──────────────────────────────────────────── */
function Avatar({
  name,
  photoUrl,
  size = 36,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const letter = (name || "?").replace(/^@/, "").charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full overflow-hidden bg-gradient-to-br from-white/15 to-white/5 border border-white/15 flex items-center justify-center shrink-0 text-white/85 font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        letter
      )}
    </div>
  );
}

/** start…end — middle hidden */
function clipHash(h: string, head = 6, tail = 4) {
  if (!h) return "—";
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

function roomTag(id?: string | null) {
  if (!id) return "—";
  return id.replace(/-/g, "").slice(0, 4).toUpperCase();
}

function HashRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string | null | undefined;
  onCopy: (v: string) => void;
}) {
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className="w-full flex items-center gap-2 py-1.5 group text-left btn-press"
    >
      <span className="text-[10px] uppercase tracking-wider text-white/25 w-12 shrink-0">
        {label}
      </span>
      <span className="flex-1 text-[11px] font-mono text-white/45 truncate">
        {clipHash(value, 8, 6)}
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="text-white/25 group-hover:text-white/55 shrink-0"
      >
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
    </button>
  );
}

/* ─── Reel column (mini-game) ──────────────────────────── */
const ITEM_H = 72;
const VISIBLE = 3;
const REEL_H = ITEM_H * VISIBLE;

function ReelColumn({
  final,
  spinning,
  offset,
  accent,
}: {
  final: RpsChoice | null;
  spinning: boolean;
  offset: number; // px scroll
  accent: "fuchsia" | "cyan";
}) {
  // Build a long strip: cycle repeated + final at end
  const strip: RpsChoice[] = [];
  for (let i = 0; i < 24; i++) strip.push(CYCLE[i % 3]);
  if (final) strip.push(final);

  const border =
    accent === "fuchsia"
      ? "border-fuchsia-400/40 shadow-[0_0_32px_rgba(232,121,249,0.22)]"
      : "border-cyan-400/40 shadow-[0_0_32px_rgba(34,211,238,0.22)]";
  const glow =
    accent === "fuchsia"
      ? "from-fuchsia-500/20 to-violet-600/10"
      : "from-cyan-500/20 to-teal-600/10";

  return (
    <div
      className={cn(
        "relative w-[88px] rounded-[22px] border overflow-hidden bg-black/40",
        spinning ? "border-white/12" : border
      )}
      style={{ height: REEL_H }}
    >
      {!spinning && (
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-b pointer-events-none z-[1]",
            glow
          )}
        />
      )}
      {/* window gradients */}
      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/80 to-transparent z-[2] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/80 to-transparent z-[2] pointer-events-none" />
      {/* center marker */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[72px] border-y border-white/10 z-[2] pointer-events-none" />

      <div
        className="absolute left-0 right-0 will-change-transform"
        style={{
          transform: `translateY(${-offset}px)`,
          transition: spinning ? "none" : "transform 0.15s ease-out",
        }}
      >
        {strip.map((c, i) => (
          <div
            key={i}
            className="flex items-center justify-center"
            style={{ height: ITEM_H }}
          >
            <ChoiceIcon
              choice={c}
              className={cn(
                "w-9 h-9",
                spinning ? "text-white/50" : "text-white/90"
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Mini-game reveal:
 * 1) Countdown 3-2-1
 * 2) Dual reels spin (like slots) and land on each player's choice
 * Total ~10–12s aligned with revealAt
 */
function ReelReveal({
  room,
  onDone,
}: {
  room: RpsPublicRoom;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"countdown" | "spin" | "done">(
    "countdown"
  );
  const [count, setCount] = useState(3);
  const [leftOff, setLeftOff] = useState(0);
  const [rightOff, setRightOff] = useState(0);
  const [leftSpin, setLeftSpin] = useState(true);
  const [rightSpin, setRightSpin] = useState(true);
  const doneRef = useRef(false);
  const started = useRef(Date.now());

  const totalMs = useMemo(() => {
    if (room.revealAt) {
      const left = new Date(room.revealAt).getTime() - Date.now();
      return Math.max(5000, Math.min(RPS_REVEAL_SEC * 1000, left));
    }
    return RPS_REVEAL_SEC * 1000;
  }, [room.revealAt]);

  // Final offsets: land middle window on final choice
  // strip index: center shows item at offset/ITEM_H + 1 (middle of 3)
  const finalOffset = (choice: RpsChoice | null) => {
    // use late index in strip so there's room to spin
    const base = 18; // near end of 24-cycle
    const idx = choice ? base + CYCLE.indexOf(choice) : base;
    // center row = offset/ITEM_H + 1  →  offset = (idx - 1) * ITEM_H
    return (idx - 1) * ITEM_H;
  };

  useEffect(() => {
    started.current = Date.now();
    // Countdown 3-2-1 (~1.8s)
    let n = 3;
    setCount(3);
    playCountdown();
    const cd = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(cd);
        setPhase("spin");
      } else {
        setCount(n);
        playCountdown();
      }
    }, 600);

    return () => clearInterval(cd);
  }, []);

  useEffect(() => {
    if (phase !== "spin") return;

    const spinStart = Date.now();
    // leave ~1.2s after both land for "done"
    const spinBudget = Math.max(3500, totalMs - 1800 - 1200);
    const leftStopAt = spinBudget * 0.72;
    const rightStopAt = spinBudget * 0.92;

    let raf = 0;
    let lastTick = 0;
    let leftStopped = false;
    let rightStopped = false;

    const leftTarget = finalOffset(room.creatorChoice);
    const rightTarget = finalOffset(room.joinerChoice);

    // continuous scroll speeds
    let leftPos = 0;
    let rightPos = ITEM_H * 0.5;

    const loop = (now: number) => {
      const elapsed = now - spinStart;

      if (!leftStopped) {
        const speed = 18 + (1 - Math.min(1, elapsed / leftStopAt)) * 22;
        leftPos += speed;
        // wrap visually within cycle length for smoothness
        setLeftOff(leftPos % (ITEM_H * 12));
        if (elapsed >= leftStopAt) {
          leftStopped = true;
          setLeftSpin(false);
          setLeftOff(leftTarget);
          playLand();
        }
      }

      if (!rightStopped) {
        const speed = 16 + (1 - Math.min(1, elapsed / rightStopAt)) * 24;
        rightPos += speed;
        setRightOff(rightPos % (ITEM_H * 12));
        if (elapsed >= rightStopAt) {
          rightStopped = true;
          setRightSpin(false);
          setRightOff(rightTarget);
          playLand();
        }
      }

      if (now - lastTick > 70) {
        lastTick = now;
        if (!leftStopped || !rightStopped) playTick();
      }

      if (leftStopped && rightStopped) {
        if (!doneRef.current) {
          doneRef.current = true;
          setPhase("done");
          setTimeout(onDone, 1100);
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, room.creatorChoice, room.joinerChoice, totalMs, onDone]);

  return (
    <div className="flex flex-col items-center px-4 pt-5 select-none">
      <style>{`
        @keyframes rps-count-pop {
          0% { transform: scale(0.5); opacity: 0; }
          40% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {phase === "countdown" ? (
        <div className="flex flex-col items-center justify-center min-h-[280px]">
          <div
            key={count}
            className="text-[88px] font-bold text-white tracking-tighter leading-none"
            style={{ animation: "rps-count-pop 0.45s cubic-bezier(0.16,1,0.3,1)" }}
          >
            {count}
          </div>
          <div className="text-[12px] uppercase tracking-[0.25em] text-white/30 mt-4">
            Get ready
          </div>
        </div>
      ) : (
        <>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/35 mb-5">
            {phase === "done" ? "Result" : "Throw"}
          </div>

          <div className="flex items-end justify-center gap-5 w-full max-w-sm">
            {/* Left player */}
            <div className="flex flex-col items-center gap-2.5">
              <Avatar
                name={room.creatorUsername}
                photoUrl={room.creatorPhotoUrl}
                size={36}
              />
              <ReelColumn
                final={room.creatorChoice}
                spinning={leftSpin && phase === "spin"}
                offset={leftOff}
                accent="fuchsia"
              />
              <div className="text-[11px] text-white/40 truncate max-w-[88px]">
                @{room.creatorUsername}
              </div>
              {!leftSpin && room.creatorChoice && (
                <div className="text-[12px] font-semibold text-fuchsia-200">
                  {CHOICE_LABEL[room.creatorChoice]}
                </div>
              )}
            </div>

            <div className="pb-16 text-[13px] font-bold tracking-[0.2em] text-white/20">
              VS
            </div>

            {/* Right player */}
            <div className="flex flex-col items-center gap-2.5">
              <Avatar
                name={room.joinerUsername || "?"}
                photoUrl={room.joinerPhotoUrl}
                size={36}
              />
              <ReelColumn
                final={room.joinerChoice}
                spinning={rightSpin && phase === "spin"}
                offset={rightOff}
                accent="cyan"
              />
              <div className="text-[11px] text-white/40 truncate max-w-[88px]">
                @{room.joinerUsername || "…"}
              </div>
              {!rightSpin && room.joinerChoice && (
                <div className="text-[12px] font-semibold text-cyan-200">
                  {CHOICE_LABEL[room.joinerChoice]}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── History row ──────────────────────────────────────── */
function HistoryRow({
  h,
  tag,
}: {
  h: HistItem;
  tag: string;
}) {
  const isWin = h.result === "win";
  const isDraw = h.result === "draw";
  return (
    <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] px-3.5 py-3 flex items-center gap-3">
      <div className="text-[11px] font-mono text-white/25 w-10 shrink-0">
        #{tag}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
          <ChoiceIcon choice={h.my_choice} className="w-4 h-4 text-white/70" />
        </div>
        <span className="text-[10px] text-white/20">vs</span>
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
          <ChoiceIcon
            choice={h.opponent_choice}
            className="w-4 h-4 text-white/70"
          />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white/70 truncate">@{h.opponent}</div>
        <div className="text-[10px] text-white/28 mt-0.5">
          {formatTime(new Date(h.created_at))}
        </div>
      </div>
      <div
        className={cn(
          "text-[14px] font-semibold tabular-nums shrink-0",
          isWin
            ? "text-emerald-400"
            : isDraw
              ? "text-white/45"
              : "text-red-400/90"
        )}
      >
        {isWin
          ? `+${formatGram(h.payout)}`
          : isDraw
            ? `±${formatGram(h.amount)}`
            : `−${formatGram(h.amount)}`}
      </div>
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────────── */
export function RpsScreen({
  balance,
  telegramId,
  username,
  photoUrl,
  serverMode,
  onBack,
  onBalanceUpdate,
  onReloadBalance,
  showToast,
  haptic,
  hapticSuccess,
  hapticError,
}: RpsScreenProps) {
  const [view, setView] = useState<View>("lobby");
  const [rooms, setRooms] = useState<RpsPublicRoom[]>([]);
  const [mine, setMine] = useState<RpsPublicRoom | null>(null);
  const [active, setActive] = useState<RpsPublicRoom | null>(null);
  const [history, setHistory] = useState<HistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [choice, setChoice] = useState<RpsChoice>("rock");
  const [amount, setAmount] = useState(1);
  const [joinTarget, setJoinTarget] = useState<RpsPublicRoom | null>(null);
  const [joinChoice, setJoinChoice] = useState<RpsChoice>("paper");

  const viewRef = useRef(view);
  viewRef.current = view;

  const copyText = useCallback(
    (v: string) => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(v).then(() => {
          hapticSuccess();
          showToast("Copied");
        });
      } else {
        showToast(v);
      }
    },
    [hapticSuccess, showToast]
  );

  const loadHistory = useCallback(async () => {
    try {
      const res = await rpsHistory(50);
      setHistory((res.items || []) as HistItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await rpsList();
      setRooms(data.rooms || []);
      setMine(data.mine || null);
      const m = data.mine;
      if (m?.status === "playing") {
        setActive(m);
        if (viewRef.current !== "result" && viewRef.current !== "history") {
          setView("reveal");
        }
      } else if (m?.status === "finished" && viewRef.current === "reveal") {
        setActive(m);
        setView("result");
      }
    } catch {
      /* demo */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    loadHistory();
    const id = setInterval(refresh, 3500);
    return () => clearInterval(id);
  }, [refresh, loadHistory]);

  useEffect(() => {
    if (!active || view !== "reveal") return;
    const id = setInterval(async () => {
      try {
        const { room } = await rpsState(active.id);
        setActive(room);
        if (room.status === "finished") {
          setView("result");
          onReloadBalance?.();
          loadHistory();
        }
      } catch {
        /* ignore */
      }
    }, 1200);
    return () => clearInterval(id);
  }, [active?.id, view, onReloadBalance, loadHistory]);

  const handleCreate = async () => {
    if (busy) return;
    if (amount < RPS_MIN_BET || amount > RPS_MAX_BET) {
      showToast(`Bet ${RPS_MIN_BET}–${RPS_MAX_BET} GRAM`);
      return;
    }
    if (amount > balance) {
      showToast("Not enough balance");
      return;
    }
    setBusy(true);
    try {
      if (!serverMode) {
        showToast("Open in Telegram with server for real RPS");
        return;
      }
      const res = await rpsCreate(choice, amount);
      onBalanceUpdate(res.balance);
      setMine(res.room);
      setActive(res.room);
      setView("lobby");
      haptic("light");
      showToast("Room created");
      refresh();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (roomId?: string) => {
    const id = roomId || mine?.id || active?.id;
    if (!id || busy) return;
    setBusy(true);
    try {
      const res = await rpsCancel(id);
      onBalanceUpdate(res.balance);
      setMine(null);
      if (active?.id === id) setActive(null);
      haptic("light");
      showToast("Cancelled · refunded");
      refresh();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!joinTarget || busy) return;
    if (joinTarget.amount > balance) {
      showToast("Not enough balance");
      return;
    }
    setBusy(true);
    try {
      if (!serverMode) {
        showToast("Open in Telegram with server for real RPS");
        return;
      }
      if (mine?.status === "open" && mine.id !== joinTarget.id) {
        try {
          const c = await rpsCancel(mine.id);
          onBalanceUpdate(c.balance);
          setMine(null);
        } catch {
          /* ok */
        }
      }
      const res = await rpsJoin(joinTarget.id, joinChoice);
      onBalanceUpdate(res.balance);
      setActive(res.room);
      setJoinTarget(null);
      setView("reveal");
      haptic("medium");
      refresh();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Join failed");
    } finally {
      setBusy(false);
    }
  };

  const onRevealDone = useCallback(async () => {
    if (!active) return;
    try {
      const { room } = await rpsState(active.id);
      setActive(room);
      setView("result");
      onReloadBalance?.();
      loadHistory();
      const iWon =
        room.winnerTelegramId != null && room.winnerTelegramId === telegramId;
      const draw = room.winnerTelegramId == null;
      if (draw) haptic("medium");
      else if (iWon) {
        hapticSuccess();
        playWinSound();
      } else {
        haptic("medium");
        playLoseSound();
      }
    } catch {
      setView("result");
      onReloadBalance?.();
    }
  }, [
    active,
    telegramId,
    haptic,
    hapticSuccess,
    onReloadBalance,
    loadHistory,
  ]);

  const openRooms = rooms.filter(
    (r) => r.status === "open" && r.creatorTelegramId !== telegramId
  );

  const goLobby = () => {
    setJoinTarget(null);
    setView("lobby");
    refresh();
  };

  const headerTitle =
    view === "create"
      ? "Create room"
      : view === "join"
        ? "Join game"
        : view === "reveal"
          ? "Duel"
          : view === "result"
            ? "Result"
            : view === "history"
              ? "History"
              : "Rock Paper Scissors";

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {/* Header */}
      <div className="px-4 pt-3 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (view === "create" || view === "join" || view === "history")
              goLobby();
            else if (view === "result") {
              setActive(null);
              goLobby();
            } else if (view === "reveal") {
              /* locked in match */
            } else {
              onBack();
            }
          }}
          className="w-10 h-10 rounded-full glass border border-white/[0.09] flex items-center justify-center text-white/55 hover:text-white/90 transition btn-press shrink-0"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-tight leading-tight truncate">
            {headerTitle}
          </div>
        </div>

        {/* Balance — no dot */}
        <div className="flex items-center gap-1.5 h-9 px-3 rounded-full glass border border-white/[0.1] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <span className="text-[13px] font-semibold tabular-nums text-gradient-cyan">
            {formatGram(balance)}
          </span>
          <span className="text-[10px] text-white/35 font-medium">GRAM</span>
        </div>
      </div>

      {/* ── LOBBY ──────────────────────────────────────── */}
      {view === "lobby" && (
        <div className="px-4 flex-1 overflow-y-auto">
          {/* Create CTA */}
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setView("create");
            }}
            className="w-full relative overflow-hidden rounded-[22px] mb-4 btn-press active:scale-[0.98] transition-transform"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#6b21a8] via-[#86198f] to-[#9d174d]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(244,114,182,0.35),transparent_55%)]" />
            <div className="relative px-5 py-4 flex items-center gap-4">
              {/* Icon cluster */}
              <div className="relative w-14 h-14 shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-white"
                  >
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-lg bg-fuchsia-400/30 border border-white/20 flex items-center justify-center">
                  <ChoiceIcon
                    choice="scissors"
                    className="w-3.5 h-3.5 text-fuchsia-100"
                  />
                </div>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[16px] font-bold text-white tracking-tight">
                  Create room
                </div>
                <div className="text-[12px] text-white/55 mt-0.5">
                  Set stake · wait for opponent
                </div>
              </div>
            </div>
          </button>

          {/* My open room */}
          {mine?.status === "open" && (
            <div className="mb-4 rounded-[20px] border border-fuchsia-400/25 bg-fuchsia-500/[0.08] p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-fuchsia-500/20 border border-fuchsia-400/30 flex items-center justify-center">
                  {mine.creatorChoice && (
                    <ChoiceIcon
                      choice={mine.creatorChoice}
                      className="w-6 h-6 text-fuchsia-200"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-fuchsia-300/70 mb-0.5">
                    Your room · #{roomTag(mine.id)}
                  </div>
                  <div className="text-[15px] font-semibold tabular-nums">
                    {formatGram(mine.amount)}{" "}
                    <span className="text-[11px] text-white/40 font-normal">
                      GRAM
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleCancel(mine.id)}
                  className="h-9 px-3 rounded-xl text-[12px] font-medium bg-white/5 border border-white/10 text-white/70 hover:text-white btn-press"
                >
                  Cancel
                </button>
              </div>
              <div className="mt-2.5 flex items-center gap-2 text-[11px] text-white/35">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                Waiting · you can still join other rooms
              </div>
            </div>
          )}

          {/* Open rooms */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[11px] uppercase tracking-wider text-white/35">
              Open rooms
            </div>
            <div className="text-[11px] text-white/25 tabular-nums">
              {openRooms.length}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              <div className="skeleton h-[72px] w-full rounded-2xl" />
              <div className="skeleton h-[72px] w-full rounded-2xl" />
            </div>
          ) : openRooms.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-10 text-center">
              <div className="text-[14px] text-white/45 mb-1">No open rooms</div>
              <div className="text-[12px] text-white/28">
                Create one or wait for players
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {openRooms.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    haptic("light");
                    setJoinTarget(r);
                    setJoinChoice("paper");
                    setView("join");
                  }}
                  className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05] p-3.5 flex items-center gap-3 text-left transition btn-press"
                >
                  <Avatar
                    name={r.creatorUsername}
                    photoUrl={r.creatorPhotoUrl}
                    size={42}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate">
                      @{r.creatorUsername}
                    </div>
                    <div className="text-[11px] text-white/30 font-mono mt-0.5">
                      #{roomTag(r.id)} · {clipHash(r.creatorChoiceHash, 6, 4)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[16px] font-semibold text-gradient-cyan tabular-nums leading-none">
                      {formatGram(r.amount)}
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5">GRAM</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* History preview — last 5 */}
          <div className="flex items-center justify-between mb-2.5 mt-7">
            <div className="text-[11px] uppercase tracking-wider text-white/35">
              History
            </div>
            <button
              type="button"
              onClick={() => {
                haptic("light");
                loadHistory();
                setView("history");
              }}
              className="w-8 h-8 rounded-xl glass border border-white/[0.08] flex items-center justify-center text-white/45 hover:text-white/80 transition btn-press"
              aria-label="Full history"
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
          </div>

          {history.length === 0 ? (
            <div className="text-[12px] text-white/25 text-center py-4 mb-4">
              No games yet
            </div>
          ) : (
            <div className="space-y-1.5 pb-6">
              {history.slice(0, 5).map((h) => (
                <HistoryRow key={h.id} h={h} tag={roomTag(h.room_id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FULL HISTORY ───────────────────────────────── */}
      {view === "history" && (
        <div className="px-4 flex-1 overflow-y-auto">
          <div className="flex gap-1.5 p-1 rounded-2xl bg-black/35 border border-white/[0.06] mb-4">
            <div className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-center bg-white/10 text-white border border-white/12">
              All
            </div>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-16 text-[13px] text-white/35">
              No games yet
            </div>
          ) : (
            <div className="space-y-1.5 pb-6">
              {history.map((h) => (
                <HistoryRow key={h.id} h={h} tag={roomTag(h.room_id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE ─────────────────────────────────────── */}
      {view === "create" && (
        <div className="px-4 flex-1">
          <div className="text-[13px] text-white/40 mb-5 mt-1 text-center">
            Your move stays hidden until someone joins
          </div>

          <div className="flex justify-center gap-3.5 mb-8">
            {CYCLE.map((c) => (
              <ChoiceButton
                key={c}
                choice={c}
                selected={choice === c}
                onClick={() => {
                  haptic("light");
                  setChoice(c);
                }}
                size="lg"
              />
            ))}
          </div>

          <div className="text-[11px] uppercase tracking-wider text-white/35 mb-2">
            Stake
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  haptic("light");
                  setAmount(a);
                }}
                className={cn(
                  "h-9 px-3.5 rounded-xl text-[13px] font-medium border transition btn-press",
                  amount === a
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-transparent border-white/[0.08] text-white/40"
                )}
              >
                {a}
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={RPS_MIN_BET}
            max={RPS_MAX_BET}
            step="0.25"
            className="w-full h-12 rounded-2xl bg-white/[0.04] border border-white/[0.1] px-4 text-[16px] font-semibold tabular-nums outline-none focus:border-fuchsia-400/40 transition"
          />
          <div className="text-[11px] text-white/28 mt-2 mb-6">
            Opponent matches this stake · winner takes the pot
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleCreate}
            className="w-full h-12 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-40"
          >
            {busy ? "Creating…" : `Create · ${formatGram(amount)} GRAM`}
          </button>
        </div>
      )}

      {/* ── JOIN ───────────────────────────────────────── */}
      {view === "join" && joinTarget && (
        <div className="px-4 flex-1">
          <div className="rounded-[22px] border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4 mb-6 flex items-center gap-3.5">
            <Avatar
              name={joinTarget.creatorUsername}
              photoUrl={joinTarget.creatorPhotoUrl}
              size={48}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold truncate">
                @{joinTarget.creatorUsername}
              </div>
              <div className="text-[11px] text-white/30 font-mono mt-0.5">
                #{roomTag(joinTarget.id)} ·{" "}
                {clipHash(joinTarget.creatorChoiceHash, 6, 4)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[18px] font-bold text-gradient-cyan tabular-nums leading-none">
                {formatGram(joinTarget.amount)}
              </div>
              <div className="text-[10px] text-white/30 mt-1">GRAM</div>
            </div>
          </div>

          {mine?.status === "open" && (
            <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-200/80 text-center">
              Joining cancels your open room and refunds the stake
            </div>
          )}

          <div className="text-[13px] text-white/40 mb-4 text-center">
            Choose your move
          </div>
          <div className="flex justify-center gap-3.5 mb-8">
            {CYCLE.map((c) => (
              <ChoiceButton
                key={c}
                choice={c}
                selected={joinChoice === c}
                onClick={() => {
                  haptic("light");
                  setJoinChoice(c);
                }}
                size="lg"
              />
            ))}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleJoin}
            className="w-full h-12 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-40"
          >
            {busy
              ? "Joining…"
              : `Play · ${formatGram(joinTarget.amount)} GRAM`}
          </button>
        </div>
      )}

      {/* ── REVEAL ─────────────────────────────────────── */}
      {view === "reveal" && active && (
        <ReelReveal room={active} onDone={onRevealDone} />
      )}

      {/* ── RESULT ─────────────────────────────────────── */}
      {view === "result" && active && (
        <div className="px-4 flex-1 flex flex-col items-center pt-6 overflow-y-auto">
          {(() => {
            const isDraw = active.winnerTelegramId == null;
            const iWon =
              !isDraw && active.winnerTelegramId === telegramId;
            const title = isDraw ? "Draw" : iWon ? "You won!" : "You lost";
            const payout = isDraw
              ? active.amount
              : iWon
                ? active.potAfterFee ?? active.amount * 1.9
                : 0;

            return (
              <>
                <div className="text-[11px] font-mono text-white/30 mb-2">
                  #{roomTag(active.id)}
                </div>
                <div
                  className={cn(
                    "text-[32px] font-bold tracking-tight mb-1.5",
                    isDraw
                      ? "text-white/85"
                      : iWon
                        ? "text-emerald-300 drop-shadow-[0_0_24px_rgba(52,211,153,0.35)]"
                        : "text-white/65"
                  )}
                >
                  {title}
                </div>
                <div
                  className={cn(
                    "text-[18px] font-semibold tabular-nums mb-7",
                    isDraw
                      ? "text-white/45"
                      : iWon
                        ? "text-emerald-400"
                        : "text-red-400/80"
                  )}
                >
                  {isDraw
                    ? `±${formatGram(payout)} GRAM`
                    : iWon
                      ? `+${formatGram(payout)} GRAM`
                      : `−${formatGram(active.amount)} GRAM`}
                </div>

                <div className="flex items-center gap-5 mb-7">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br from-fuchsia-500/20 to-violet-600/15 border border-fuchsia-400/35 flex items-center justify-center shadow-[0_0_32px_rgba(232,121,249,0.2)]">
                      {active.creatorChoice && (
                        <ChoiceIcon
                          choice={active.creatorChoice}
                          className="w-9 h-9 text-fuchsia-100"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-white/40 max-w-[80px] truncate">
                      @{active.creatorUsername}
                    </div>
                  </div>
                  <div className="text-white/20 text-xs font-bold tracking-widest">
                    VS
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br from-cyan-500/20 to-teal-600/15 border border-cyan-400/35 flex items-center justify-center shadow-[0_0_32px_rgba(34,211,238,0.2)]">
                      {active.joinerChoice && (
                        <ChoiceIcon
                          choice={active.joinerChoice}
                          className="w-9 h-9 text-cyan-100"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-white/40 max-w-[80px] truncate">
                      @{active.joinerUsername}
                    </div>
                  </div>
                </div>

                {/* Fairness — clipped + copy */}
                <div className="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 mb-6">
                  <div className="text-[9px] uppercase tracking-wider text-white/25 mb-1">
                    Provably fair · tap to copy
                  </div>
                  <HashRow
                    label="commit"
                    value={active.creatorChoiceHash}
                    onCopy={copyText}
                  />
                  <HashRow
                    label="seed"
                    value={active.serverSeed}
                    onCopy={copyText}
                  />
                  <HashRow
                    label="nonce"
                    value={active.creatorChoiceNonce}
                    onCopy={copyText}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActive(null);
                    setMine(null);
                    goLobby();
                    loadHistory();
                  }}
                  className="w-full max-w-sm h-12 rounded-2xl btn-primary text-sm font-semibold btn-press mb-6"
                >
                  Back to lobby
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

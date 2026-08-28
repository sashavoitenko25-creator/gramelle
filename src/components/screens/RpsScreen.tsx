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

type View = "lobby" | "create" | "join" | "reveal" | "result";

const QUICK_AMOUNTS = [0.5, 1, 2, 5, 10, 25];
const CYCLE: RpsChoice[] = ["rock", "paper", "scissors"];

/* ─── tiny SFX ─────────────────────────────────────────── */
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
function beep(freq: number, dur = 0.06, gain = 0.05, type: OscillatorType = "sine") {
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
  beep(420 + Math.random() * 80, 0.04, 0.035, "triangle");
}
function playClash() {
  beep(90, 0.12, 0.1, "sawtooth");
  beep(180, 0.18, 0.06, "triangle");
  beep(340, 0.08, 0.05, "sine");
}

/* ─── UI atoms ─────────────────────────────────────────── */
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

function shortHash(h: string, n = 10) {
  if (!h) return "—";
  return h.slice(0, n) + "…";
}

/* ─── Clash reveal animation ───────────────────────────── */
function ClashReveal({
  room,
  onDone,
}: {
  room: RpsPublicRoom;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"charge" | "clash" | "lock" | "done">(
    "charge"
  );
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(1);
  const [shake, setShake] = useState(false);
  const doneRef = useRef(false);
  const started = useRef(Date.now());

  const totalMs = useMemo(() => {
    if (room.revealAt) {
      const left = new Date(room.revealAt).getTime() - Date.now();
      return Math.max(4000, Math.min(RPS_REVEAL_SEC * 1000, left));
    }
    return RPS_REVEAL_SEC * 1000;
  }, [room.revealAt]);

  useEffect(() => {
    started.current = Date.now();
    let raf = 0;
    let lastTick = 0;
    let tickCount = 0;

    const loop = (now: number) => {
      const elapsed = now - started.current;
      const t = Math.min(1, elapsed / totalMs);

      // charge 0–0.72 · clash 0.72–0.82 · lock 0.82–1
      if (t < 0.72) {
        setPhase("charge");
        // interval accelerates then slightly slows near end of charge
        const pace = t < 0.5 ? 1 - t * 0.6 : 0.55 + (t - 0.5) * 0.8;
        const interval = 45 + pace * 160;
        if (now - lastTick > interval) {
          lastTick = now;
          tickCount += 1;
          setLeftIdx((i) => (i + 1) % 3);
          setRightIdx((i) => (i + 2) % 3);
          if (tickCount % 2 === 0) playTick();
        }
      } else if (t < 0.82) {
        if (phase !== "clash") {
          setPhase("clash");
          setShake(true);
          playClash();
          setTimeout(() => setShake(false), 400);
        }
      } else {
        setPhase("lock");
        if (t >= 1 && !doneRef.current) {
          doneRef.current = true;
          setPhase("done");
          setTimeout(onDone, 900);
          return;
        }
      }

      if (t < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMs, onDone]);

  const locked = phase === "lock" || phase === "done" || phase === "clash";
  const leftChoice = locked
    ? room.creatorChoice || CYCLE[leftIdx]
    : CYCLE[leftIdx];
  const rightChoice = locked
    ? room.joinerChoice || CYCLE[rightIdx]
    : CYCLE[rightIdx];

  const progress = Math.min(1, (Date.now() - started.current) / totalMs);

  return (
    <div
      className={cn(
        "flex flex-col items-center px-4 pt-4 select-none",
        shake && "animate-[rps-shake_0.35s_ease-out]"
      )}
    >
      <style>{`
        @keyframes rps-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px) rotate(-0.5deg); }
          40% { transform: translateX(6px) rotate(0.5deg); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(3px); }
        }
        @keyframes rps-pulse-ring {
          0% { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes rps-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes rps-impact {
          0% { transform: scale(0.4); opacity: 0; }
          40% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Status */}
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/35 mb-5">
        {phase === "charge"
          ? "Charging"
          : phase === "clash"
            ? "Clash"
            : "Reveal"}
      </div>

      {/* Arena */}
      <div className="relative w-full max-w-[340px] h-[220px] flex items-center justify-center">
        {/* ambient glow */}
        <div className="absolute inset-0 rounded-[40px] bg-gradient-to-b from-fuchsia-500/10 via-transparent to-cyan-500/10 blur-xl" />

        {/* center impact ring */}
        {(phase === "clash" || phase === "lock") && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div
              className="w-16 h-16 rounded-full border border-white/40"
              style={{ animation: "rps-pulse-ring 0.7s ease-out forwards" }}
            />
          </div>
        )}

        {/* VS core */}
        <div
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full flex items-center justify-center text-[11px] font-bold tracking-widest transition-all duration-300",
            phase === "clash"
              ? "bg-white text-black scale-125 shadow-[0_0_40px_rgba(255,255,255,0.5)]"
              : "bg-white/10 text-white/40 border border-white/15"
          )}
        >
          VS
        </div>

        {/* LEFT — creator */}
        <div
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-all duration-500",
            phase === "charge" && "animate-[rps-float_1.6s_ease-in-out_infinite]",
            phase === "clash" && "translate-x-6",
            locked && phase !== "clash" && "translate-x-0"
          )}
          style={{
            transform:
              phase === "clash"
                ? "translateY(-50%) translateX(28px)"
                : undefined,
          }}
        >
          <Avatar
            name={room.creatorUsername}
            photoUrl={room.creatorPhotoUrl}
            size={36}
          />
          <div
            className={cn(
              "w-[96px] h-[96px] rounded-[28px] border flex items-center justify-center transition-all duration-300",
              locked
                ? "bg-gradient-to-br from-fuchsia-500/25 to-violet-600/20 border-fuchsia-400/45 shadow-[0_0_48px_rgba(232,121,249,0.3)]"
                : "bg-white/[0.06] border-white/12 backdrop-blur-md"
            )}
            style={
              locked
                ? { animation: "rps-impact 0.45s cubic-bezier(0.16,1,0.3,1) both" }
                : undefined
            }
          >
            <ChoiceIcon
              choice={leftChoice}
              className={cn(
                "w-11 h-11 transition-all duration-150",
                locked ? "text-fuchsia-100" : "text-white/80"
              )}
            />
          </div>
          <div className="text-[11px] text-white/45 truncate max-w-[90px]">
            @{room.creatorUsername}
          </div>
          {locked && (
            <div className="text-[12px] font-semibold text-fuchsia-200">
              {CHOICE_LABEL[leftChoice]}
            </div>
          )}
        </div>

        {/* RIGHT — joiner */}
        <div
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-all duration-500",
            phase === "charge" &&
              "animate-[rps-float_1.6s_ease-in-out_infinite_0.3s]"
          )}
          style={{
            transform:
              phase === "clash"
                ? "translateY(-50%) translateX(-28px)"
                : undefined,
          }}
        >
          <Avatar
            name={room.joinerUsername || "?"}
            photoUrl={room.joinerPhotoUrl}
            size={36}
          />
          <div
            className={cn(
              "w-[96px] h-[96px] rounded-[28px] border flex items-center justify-center transition-all duration-300",
              locked
                ? "bg-gradient-to-br from-cyan-500/25 to-teal-600/20 border-cyan-400/45 shadow-[0_0_48px_rgba(34,211,238,0.3)]"
                : "bg-white/[0.06] border-white/12 backdrop-blur-md"
            )}
            style={
              locked
                ? { animation: "rps-impact 0.45s cubic-bezier(0.16,1,0.3,1) 0.05s both" }
                : undefined
            }
          >
            <ChoiceIcon
              choice={rightChoice}
              className={cn(
                "w-11 h-11 transition-all duration-150",
                locked ? "text-cyan-100" : "text-white/80"
              )}
            />
          </div>
          <div className="text-[11px] text-white/45 truncate max-w-[90px]">
            @{room.joinerUsername || "…"}
          </div>
          {locked && (
            <div className="text-[12px] font-semibold text-cyan-200">
              {CHOICE_LABEL[rightChoice]}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {phase === "charge" && (
        <div className="mt-8 w-48 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400 transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Main screen ──────────────────────────────────────── */
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
  const [history, setHistory] = useState<
    Array<{
      id: string;
      opponent: string;
      my_choice: RpsChoice;
      opponent_choice: RpsChoice;
      amount: number;
      result: "win" | "lose" | "draw";
      payout: number;
      created_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [choice, setChoice] = useState<RpsChoice>("rock");
  const [amount, setAmount] = useState(1);
  const [joinTarget, setJoinTarget] = useState<RpsPublicRoom | null>(null);
  const [joinChoice, setJoinChoice] = useState<RpsChoice>("paper");

  const viewRef = useRef(view);
  viewRef.current = view;

  const loadHistory = useCallback(async () => {
    try {
      const res = await rpsHistory(20);
      setHistory(res.items || []);
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
        if (viewRef.current !== "result") setView("reveal");
      } else if (m?.status === "finished" && viewRef.current === "reveal") {
        setActive(m);
        setView("result");
      }
      // open room: do NOT force waiting — user can browse lobby
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

  // Poll active room during reveal
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
      setView("lobby"); // stay in lobby — room lives as banner
      haptic("light");
      showToast("Room created · waiting for opponent");
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
      showToast("Room cancelled · refunded");
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
      // Auto-cancel own open room so user can freely join others
      if (mine?.status === "open" && mine.id !== joinTarget.id) {
        try {
          const c = await rpsCancel(mine.id);
          onBalanceUpdate(c.balance);
          setMine(null);
        } catch {
          /* may already be gone */
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
        room.winnerTelegramId != null &&
        room.winnerTelegramId === telegramId;
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

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (view === "create" || view === "join") goLobby();
            else if (view === "result") {
              setActive(null);
              goLobby();
            } else if (view === "reveal") {
              /* stay — match in progress */
            } else {
              onBack();
            }
          }}
          className="w-10 h-10 rounded-full glass border border-white/[0.09] flex items-center justify-center text-white/55 hover:text-white/90 transition btn-press shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-tight leading-tight">
            {view === "create"
              ? "Create room"
              : view === "join"
                ? "Join game"
                : view === "reveal"
                  ? "Duel"
                  : view === "result"
                    ? "Result"
                    : "Rock Paper Scissors"}
          </div>
        </div>

        {/* Balance pill — always visible */}
        <div className="flex items-center gap-1.5 h-9 px-3 rounded-full glass border border-white/[0.1] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
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
            <div className="relative px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-[16px] font-bold text-white tracking-tight">
                  Create room
                </div>
                <div className="text-[12px] text-white/55 mt-0.5">
                  Set stake · wait for opponent
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-white">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
            </div>
          </button>

          {/* My open room banner */}
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
                    Your room · open
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
                Waiting for opponent · you can join other rooms
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
                      {shortHash(r.creatorChoiceHash)}
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

          {/* History — Spin style +/- */}
          {history.length > 0 && (
            <>
              <div className="text-[11px] uppercase tracking-wider text-white/35 mb-2.5 mt-7">
                History
              </div>
              <div className="space-y-1.5 pb-6">
                {history.map((h) => {
                  const isWin = h.result === "win";
                  const isDraw = h.result === "draw";
                  return (
                    <div
                      key={h.id}
                      className="rounded-2xl bg-white/[0.025] border border-white/[0.06] px-3.5 py-3 flex items-center gap-3"
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                          <ChoiceIcon
                            choice={h.my_choice}
                            className="w-4 h-4 text-white/70"
                          />
                        </div>
                        <span className="text-[10px] text-white/25">vs</span>
                        <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                          <ChoiceIcon
                            choice={h.opponent_choice}
                            className="w-4 h-4 text-white/70"
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white/70 truncate">
                          @{h.opponent}
                        </div>
                        <div className="text-[10px] text-white/28 mt-0.5">
                          {formatTime(new Date(h.created_at))}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "text-[14px] font-semibold tabular-nums",
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
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CREATE ─────────────────────────────────────── */}
      {view === "create" && (
        <div className="px-4 flex-1">
          <div className="text-[13px] text-white/40 mb-5 mt-1 text-center">
            Your move is hidden until someone joins
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
                {shortHash(joinTarget.creatorChoiceHash, 12)}
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
              Joining will cancel your open room and refund the stake
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
        <ClashReveal room={active} onDone={onRevealDone} />
      )}

      {/* ── RESULT ─────────────────────────────────────── */}
      {view === "result" && active && (
        <div className="px-4 flex-1 flex flex-col items-center pt-6">
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
                    "text-[18px] font-semibold tabular-nums mb-8",
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

                <div className="flex items-center gap-5 mb-8">
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

                {/* Fairness strip */}
                <div className="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 mb-6 space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-white/25 mb-1">
                    Provably fair
                  </div>
                  <div className="text-[10px] font-mono text-white/35 break-all leading-relaxed">
                    {active.creatorChoiceHash}
                  </div>
                  {active.serverSeed && (
                    <div className="text-[10px] font-mono text-white/25 break-all leading-relaxed">
                      seed {shortHash(active.serverSeed, 20)}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActive(null);
                    setMine(null);
                    goLobby();
                    loadHistory();
                  }}
                  className="w-full max-w-sm h-12 rounded-2xl btn-primary text-sm font-semibold btn-press"
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

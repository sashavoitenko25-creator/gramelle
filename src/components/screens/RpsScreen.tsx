"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatGram } from "@/lib/utils";
import {
  rpsCancel,
  rpsCreate,
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

type View = "lobby" | "create" | "waiting" | "join" | "reveal" | "result";

const QUICK_AMOUNTS = [0.5, 1, 2, 5, 10, 25];

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
      className="rounded-full overflow-hidden bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-white/80 font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
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

function shortHash(h: string, n = 8) {
  if (!h) return "—";
  return h.slice(0, n) + "…";
}

/** Dramatic reveal: cycles choices faster then locks */
function RevealArena({
  room,
  telegramId,
  onDone,
}: {
  room: RpsPublicRoom;
  telegramId: number | null;
  onDone: () => void;
}) {
  const choices: RpsChoice[] = ["rock", "paper", "scissors"];
  const [tick, setTick] = useState(0);
  const [phase, setPhase] = useState<"spin" | "show" | "done">("spin");
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(1);
  const started = useRef(Date.now());
  const doneRef = useRef(false);

  const revealMs = useMemo(() => {
    if (room.revealAt) {
      const left = new Date(room.revealAt).getTime() - Date.now();
      return Math.max(3000, Math.min(RPS_REVEAL_SEC * 1000, left));
    }
    return RPS_REVEAL_SEC * 1000;
  }, [room.revealAt]);

  useEffect(() => {
    started.current = Date.now();
    let raf = 0;
    let last = 0;

    const loop = (now: number) => {
      const elapsed = now - started.current;
      const t = Math.min(1, elapsed / revealMs);

      // Interval shrinks over time (tension)
      const interval = 80 + (1 - t) * 220;
      if (now - last > interval) {
        last = now;
        setLeftIdx((i) => (i + 1) % 3);
        setRightIdx((i) => (i + 2) % 3);
        setTick((x) => x + 1);
      }

      if (t >= 1) {
        setPhase("show");
        setTimeout(() => {
          setPhase("done");
          if (!doneRef.current) {
            doneRef.current = true;
            onDone();
          }
        }, 1600);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [revealMs, onDone]);

  const leftChoice =
    phase === "spin"
      ? choices[leftIdx]
      : room.creatorChoice || choices[leftIdx];
  const rightChoice =
    phase === "spin"
      ? choices[rightIdx]
      : room.joinerChoice || choices[rightIdx];

  const progress = Math.min(
    1,
    (Date.now() - started.current) / revealMs
  );

  return (
    <div className="flex flex-col items-center px-4 pt-6">
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/35 mb-6">
        {phase === "spin" ? "Determining winner" : phase === "show" ? "Reveal" : "Result"}
      </div>

      <div className="flex items-center justify-center gap-4 w-full max-w-sm">
        {/* Creator */}
        <div className="flex flex-col items-center gap-3 flex-1">
          <Avatar
            name={room.creatorUsername}
            photoUrl={room.creatorPhotoUrl}
            size={44}
          />
          <div className="text-[12px] text-white/55 truncate max-w-[100px]">
            @{room.creatorUsername}
          </div>
          <div
            className={cn(
              "w-[100px] h-[100px] rounded-3xl border flex items-center justify-center transition-all duration-300",
              phase === "spin"
                ? "bg-white/[0.06] border-white/15 scale-100"
                : "bg-fuchsia-500/15 border-fuchsia-400/40 scale-105 shadow-[0_0_40px_rgba(232,121,249,0.25)]"
            )}
          >
            <ChoiceIcon
              choice={leftChoice}
              className={cn(
                "w-12 h-12 text-white/90 transition-transform",
                phase === "spin" && "animate-pulse"
              )}
            />
          </div>
          {phase !== "spin" && (
            <div className="text-[13px] font-medium text-fuchsia-200 fade-in">
              {CHOICE_LABEL[leftChoice]}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="text-[22px] font-bold text-white/25 tracking-widest">
            VS
          </div>
          {phase === "spin" && (
            <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-fuchsia-400 to-cyan-400 transition-all duration-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Joiner */}
        <div className="flex flex-col items-center gap-3 flex-1">
          <Avatar
            name={room.joinerUsername || "?"}
            photoUrl={room.joinerPhotoUrl}
            size={44}
          />
          <div className="text-[12px] text-white/55 truncate max-w-[100px]">
            @{room.joinerUsername || "…"}
          </div>
          <div
            className={cn(
              "w-[100px] h-[100px] rounded-3xl border flex items-center justify-center transition-all duration-300",
              phase === "spin"
                ? "bg-white/[0.06] border-white/15"
                : "bg-cyan-500/15 border-cyan-400/40 scale-105 shadow-[0_0_40px_rgba(34,211,238,0.25)]"
            )}
          >
            <ChoiceIcon
              choice={rightChoice}
              className={cn(
                "w-12 h-12 text-white/90 transition-transform",
                phase === "spin" && "animate-pulse"
              )}
            />
          </div>
          {phase !== "spin" && (
            <div className="text-[13px] font-medium text-cyan-200 fade-in">
              {CHOICE_LABEL[rightChoice]}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-[12px] text-white/30 tabular-nums">
        {phase === "spin"
          ? `~${Math.max(0, Math.ceil((revealMs - (Date.now() - started.current)) / 1000))}s`
          : ""}
      </div>
    </div>
  );
}

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
  const [recent, setRecent] = useState<RpsPublicRoom[]>([]);
  const [mine, setMine] = useState<RpsPublicRoom | null>(null);
  const [active, setActive] = useState<RpsPublicRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Create form
  const [choice, setChoice] = useState<RpsChoice>("rock");
  const [amount, setAmount] = useState(1);
  const [joinTarget, setJoinTarget] = useState<RpsPublicRoom | null>(null);
  const [joinChoice, setJoinChoice] = useState<RpsChoice>("paper");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await rpsList();
      setRooms(data.rooms || []);
      setRecent(data.recent || []);
      setMine(data.mine || null);

      if (data.mine) {
        if (data.mine.status === "open") {
          setActive(data.mine);
          setView("waiting");
        } else if (data.mine.status === "playing") {
          setActive(data.mine);
          setView("reveal");
        } else if (data.mine.status === "finished") {
          setActive(data.mine);
          setView("result");
        }
      }
    } catch {
      /* demo empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  // Poll single room during waiting / reveal
  useEffect(() => {
    if (!active || (view !== "waiting" && view !== "reveal")) return;
    const id = setInterval(async () => {
      try {
        const { room } = await rpsState(active.id);
        setActive(room);
        if (room.status === "playing" && view === "waiting") {
          setView("reveal");
        }
        if (room.status === "finished") {
          setView("result");
          if (typeof room.potAfterFee === "number") {
            // balance will be refreshed by parent via onBalanceUpdate from result actions
          }
        }
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => clearInterval(id);
  }, [active?.id, view]);

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
        setBusy(false);
        return;
      }
      const res = await rpsCreate(choice, amount);
      onBalanceUpdate(res.balance);
      setActive(res.room);
      setMine(res.room);
      setView("waiting");
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

  const handleCancel = async () => {
    if (!active || busy) return;
    setBusy(true);
    try {
      const res = await rpsCancel(active.id);
      onBalanceUpdate(res.balance);
      setActive(null);
      setMine(null);
      setView("lobby");
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
        setBusy(false);
        return;
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
      hapticSuccess();
    } catch {
      setView("result");
      onReloadBalance?.();
    }
  }, [active, hapticSuccess, onReloadBalance]);

  const openRooms = rooms.filter(
    (r) => r.status === "open" && r.creatorTelegramId !== telegramId
  );

  // ─── RENDER ─────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (view === "create" || view === "join") {
              setView("lobby");
              setJoinTarget(null);
            } else if (view === "result") {
              setActive(null);
              setMine(null);
              setView("lobby");
              refresh();
            } else if (view === "waiting" || view === "reveal") {
              // stay — or go lobby but keep room
              onBack();
            } else {
              onBack();
            }
          }}
          className="w-10 h-10 rounded-full glass border border-white/[0.09] flex items-center justify-center text-white/55 hover:text-white/90 transition btn-press"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-semibold tracking-tight">
            Rock · Paper · Scissors
          </div>
          <div className="text-[11px] text-white/40 flex items-center gap-2 mt-0.5">
            <span className="tabular-nums">{formatGram(balance)} GRAM</span>
            <span className="text-white/20">·</span>
            <span>1v1 · house 5%</span>
          </div>
        </div>
        {view === "lobby" && (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setView("create");
            }}
            className="h-9 px-3.5 rounded-xl btn-primary text-[12px] font-semibold btn-press"
          >
            Create
          </button>
        )}
      </div>

      {/* LOBBY */}
      {view === "lobby" && (
        <div className="px-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 mt-4">
              <div className="skeleton h-20 w-full rounded-2xl" />
              <div className="skeleton h-20 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              {mine && mine.status === "open" && (
                <button
                  type="button"
                  onClick={() => {
                    setActive(mine);
                    setView("waiting");
                  }}
                  className="w-full mb-4 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-4 text-left btn-press"
                >
                  <div className="text-[10px] uppercase tracking-wider text-fuchsia-300/80 mb-1">
                    Your open room
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[15px] font-semibold">
                      {formatGram(mine.amount)} GRAM
                    </div>
                    <div className="text-[12px] text-white/45">Waiting…</div>
                  </div>
                </button>
              )}

              <div className="text-[11px] uppercase tracking-wider text-white/35 mb-2 mt-1">
                Open rooms · {openRooms.length}
              </div>

              {openRooms.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
                  <div className="text-[14px] text-white/50 mb-1">No open rooms</div>
                  <div className="text-[12px] text-white/30">
                    Create one and wait for an opponent
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
                      className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:border-white/15 p-3.5 flex items-center gap-3 text-left transition btn-press"
                    >
                      <Avatar
                        name={r.creatorUsername}
                        photoUrl={r.creatorPhotoUrl}
                        size={40}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium truncate">
                          @{r.creatorUsername}
                        </div>
                        <div className="text-[11px] text-white/35 mt-0.5">
                          Hash {shortHash(r.creatorChoiceHash)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[15px] font-semibold text-gradient-cyan tabular-nums">
                          {formatGram(r.amount)}
                        </div>
                        <div className="text-[10px] text-white/35">GRAM</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {recent.length > 0 && (
                <>
                  <div className="text-[11px] uppercase tracking-wider text-white/35 mb-2 mt-6">
                    Recent
                  </div>
                  <div className="space-y-1.5 pb-4">
                    {recent.slice(0, 8).map((r) => {
                      const winner =
                        r.winnerTelegramId == null
                          ? "Draw"
                          : r.winnerTelegramId === r.creatorTelegramId
                            ? "@" + r.creatorUsername
                            : "@" + (r.joinerUsername || "?");
                      return (
                        <div
                          key={r.id}
                          className="rounded-xl bg-white/[0.025] border border-white/[0.05] px-3 py-2.5 flex items-center gap-2"
                        >
                          <div className="flex -space-x-1.5">
                            {r.creatorChoice && (
                              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                <ChoiceIcon
                                  choice={r.creatorChoice}
                                  className="w-3.5 h-3.5 text-white/70"
                                />
                              </div>
                            )}
                            {r.joinerChoice && (
                              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                <ChoiceIcon
                                  choice={r.joinerChoice}
                                  className="w-3.5 h-3.5 text-white/70"
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-[12px] text-white/55 truncate">
                            {winner}
                          </div>
                          <div className="text-[12px] tabular-nums text-white/70">
                            {formatGram(r.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* CREATE */}
      {view === "create" && (
        <div className="px-4 flex-1">
          <div className="text-[13px] text-white/45 mb-4 mt-2">
            Pick your move · it stays secret until someone joins
          </div>

          <div className="flex justify-center gap-3 mb-8">
            {(["rock", "paper", "scissors"] as RpsChoice[]).map((c) => (
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
                onClick={() => setAmount(a)}
                className={cn(
                  "h-9 px-3.5 rounded-xl text-[13px] font-medium border transition btn-press",
                  amount === a
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-transparent border-white/[0.08] text-white/45"
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
            className="w-full h-12 rounded-2xl bg-white/[0.04] border border-white/[0.1] px-4 text-[16px] font-semibold tabular-nums outline-none focus:border-fuchsia-400/40"
          />
          <div className="text-[11px] text-white/30 mt-1.5 mb-6">
            Opponent must match this amount · Winner gets ~{(1.9).toFixed(1)}×
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleCreate}
            className="w-full h-12 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-40"
          >
            {busy ? "Creating…" : `Create room · ${formatGram(amount)} GRAM`}
          </button>
        </div>
      )}

      {/* WAITING */}
      {view === "waiting" && active && (
        <div className="px-4 flex-1 flex flex-col items-center pt-10">
          <div className="w-20 h-20 rounded-3xl bg-fuchsia-500/15 border border-fuchsia-400/30 flex items-center justify-center mb-5 shadow-[0_0_48px_rgba(232,121,249,0.2)]">
            {active.creatorChoice && (
              <ChoiceIcon
                choice={active.creatorChoice}
                className="w-10 h-10 text-fuchsia-200"
              />
            )}
          </div>
          <div className="text-[18px] font-semibold mb-1">Waiting for opponent</div>
          <div className="text-[13px] text-white/45 mb-1">
            Stake {formatGram(active.amount)} GRAM
          </div>
          <div className="text-[11px] text-white/30 font-mono mb-8">
            commit {shortHash(active.creatorChoiceHash, 12)}
          </div>

          <div className="pulse-soft w-2 h-2 rounded-full bg-emerald-400 mb-8" />

          <button
            type="button"
            disabled={busy}
            onClick={handleCancel}
            className="h-11 px-6 rounded-2xl btn-secondary text-[13px] btn-press"
          >
            Cancel & refund
          </button>
        </div>
      )}

      {/* JOIN */}
      {view === "join" && joinTarget && (
        <div className="px-4 flex-1">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 mb-6 flex items-center gap-3">
            <Avatar
              name={joinTarget.creatorUsername}
              photoUrl={joinTarget.creatorPhotoUrl}
              size={44}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium truncate">
                @{joinTarget.creatorUsername}
              </div>
              <div className="text-[12px] text-white/40 mt-0.5">
                Hash {shortHash(joinTarget.creatorChoiceHash)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[17px] font-semibold text-gradient-cyan">
                {formatGram(joinTarget.amount)}
              </div>
              <div className="text-[10px] text-white/35">GRAM</div>
            </div>
          </div>

          <div className="text-[13px] text-white/45 mb-4 text-center">
            Choose your move
          </div>
          <div className="flex justify-center gap-3 mb-8">
            {(["rock", "paper", "scissors"] as RpsChoice[]).map((c) => (
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

      {/* REVEAL */}
      {view === "reveal" && active && (
        <RevealArena
          room={active}
          telegramId={telegramId}
          onDone={onRevealDone}
        />
      )}

      {/* RESULT */}
      {view === "result" && active && (
        <div className="px-4 flex-1 flex flex-col items-center pt-8">
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
                    "text-[28px] font-bold tracking-tight mb-2",
                    isDraw
                      ? "text-white/80"
                      : iWon
                        ? "text-emerald-300"
                        : "text-white/70"
                  )}
                >
                  {title}
                </div>
                <div className="text-[15px] text-white/50 mb-8 tabular-nums">
                  {isDraw
                    ? `Refunded ${formatGram(payout)} GRAM`
                    : iWon
                      ? `+${formatGram(payout)} GRAM`
                      : `−${formatGram(active.amount)} GRAM`}
                </div>

                <div className="flex items-center gap-6 mb-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-400/30 flex items-center justify-center">
                      {active.creatorChoice && (
                        <ChoiceIcon
                          choice={active.creatorChoice}
                          className="w-8 h-8 text-fuchsia-200"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-white/40">
                      @{active.creatorUsername}
                    </div>
                  </div>
                  <div className="text-white/25 text-sm font-medium">vs</div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
                      {active.joinerChoice && (
                        <ChoiceIcon
                          choice={active.joinerChoice}
                          className="w-8 h-8 text-cyan-200"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-white/40">
                      @{active.joinerUsername}
                    </div>
                  </div>
                </div>

                {/* Fairness */}
                <div className="w-full max-w-sm rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 mb-6 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                    Provably fair
                  </div>
                  <div className="text-[10px] font-mono text-white/40 break-all">
                    commit {active.creatorChoiceHash}
                  </div>
                  {active.serverSeed && (
                    <div className="text-[10px] font-mono text-white/40 break-all">
                      seed {active.serverSeed}
                    </div>
                  )}
                  {active.creatorChoiceNonce && (
                    <div className="text-[10px] font-mono text-white/40 break-all">
                      nonce {active.creatorChoiceNonce}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActive(null);
                    setMine(null);
                    setView("lobby");
                    refresh();
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

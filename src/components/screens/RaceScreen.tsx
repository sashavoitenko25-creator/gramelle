"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatGram } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { useTelegram } from "@/hooks/useTelegram";
import { RACE_MIN_BALL } from "@/lib/raceConstants";
import {
  raceBuy,
  raceCancel,
  raceCreate,
  raceHistory,
  raceList,
  raceProcess,
  raceState,
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

type View = "lobby" | "room" | "history";

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
  const short = value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className="w-full flex items-center justify-between gap-2 text-left"
    >
      <span className="text-[10px] uppercase tracking-wider text-white/35">{label}</span>
      <span className="text-[11px] font-mono text-cyan-300/80 truncate">{short}</span>
    </button>
  );
}

/** Premium ring + track visualization */
function RaceArena({
  room,
  phase,
}: {
  room: RaceRoomPublic;
  phase: "idle" | "spin" | "open" | "fall" | "done";
}) {
  const balls = room.balls;
  const n = Math.max(balls.length, 1);

  return (
    <div className="relative w-full aspect-[3/4] max-h-[52vh] mx-auto">
      {/* ambient */}
      <div className="absolute inset-0 rounded-[28px] overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[#0a0a14] via-[#0c1020] to-[#06060a]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(34,211,238,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(167,139,250,0.1),transparent_50%)]" />

        {/* top gate / curtain */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[72px] h-[28px] overflow-hidden">
          <div
            className={cn(
              "absolute inset-0 rounded-b-2xl bg-gradient-to-b from-amber-300/90 to-amber-600/80 border border-amber-200/40 shadow-[0_0_24px_rgba(251,191,36,0.45)] transition-transform duration-1000 ease-in-out origin-top",
              phase === "open" || phase === "fall" || phase === "done"
                ? "translate-y-[-110%]"
                : "translate-y-0"
            )}
          />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* spinning containment ring */}
        <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[78%] aspect-square">
          <div
            className={cn(
              "absolute inset-0 rounded-full border-[3px] border-cyan-400/30 shadow-[0_0_40px_rgba(34,211,238,0.15),inset_0_0_40px_rgba(34,211,238,0.06)]",
              phase === "spin" || phase === "idle" ? "animate-[spin_8s_linear_infinite]" : "",
              phase === "open" ? "animate-[spin_2.5s_linear_infinite]" : ""
            )}
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0 8%, rgba(34,211,238,0.15) 8% 12%, transparent 12% 100%)",
            }}
          />
          <div className="absolute inset-[10%] rounded-full border border-white/[0.06]" />
          {/* orbiting balls */}
          {balls.map((b, i) => {
            const angle = (i / n) * 360;
            const delay = (i % 7) * 0.12;
            const rank = b.finishRank;
            const fallDelay =
              rank != null ? (rank - 1) * 0.35 : i * 0.15;
            return (
              <div
                key={b.id}
                className={cn(
                  "absolute left-1/2 top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full shadow-[0_0_12px_currentColor] transition-all duration-700",
                  phase === "fall" || phase === "done" ? "opacity-90" : "opacity-100"
                )}
                style={{
                  color: b.color,
                  background: `radial-gradient(circle at 30% 30%, #fff8, ${b.color})`,
                  boxShadow: `0 0 14px ${b.color}99`,
                  transform:
                    phase === "fall" || phase === "done"
                      ? `translate(-50%, ${120 + (rank != null ? rank * 28 : i * 20)}px) scale(0.95)`
                      : `rotate(${angle}deg) translateY(-42%) rotate(-${angle}deg)`,
                  transitionDelay:
                    phase === "fall" || phase === "done" ? `${fallDelay}s` : `${delay}s`,
                  animation:
                    phase === "spin" || phase === "idle"
                      ? `race-orbit 6s linear infinite`
                      : undefined,
                  // @ts-expect-error css var
                  "--orbit-angle": `${angle}deg`,
                }}
              />
            );
          })}
        </div>

        {/* pegs / obstacles */}
        <div className="absolute top-[48%] left-0 right-0 bottom-[18%] pointer-events-none">
          {[0, 1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="flex justify-center gap-5 mb-3"
              style={{ paddingLeft: row % 2 ? 18 : 0 }}
            >
              {Array.from({ length: 5 + (row % 2) }).map((_, j) => (
                <div
                  key={j}
                  className="w-2.5 h-2.5 rounded-full bg-white/25 shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                />
              ))}
            </div>
          ))}
        </div>

        {/* finish line */}
        <div className="absolute bottom-4 left-4 right-4 h-10 rounded-xl border border-dashed border-emerald-400/40 bg-emerald-500/10 flex items-center justify-center">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-emerald-300/80">
            FINISH
          </span>
        </div>

        {/* pot badge */}
        <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full glass border border-white/10 text-[11px] font-semibold text-cyan-200 tabular-nums">
          {formatGram(room.pot)} GRAM
        </div>
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
  const [view, setView] = useState<View>("lobby");
  const [rooms, setRooms] = useState<RaceRoomPublic[]>([]);
  const [recent, setRecent] = useState<RaceRoomPublic[]>([]);
  const [active, setActive] = useState<RaceRoomPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<
    Awaited<ReturnType<typeof raceHistory>>["items"]
  >([]);
  const [animPhase, setAnimPhase] = useState<
    "idle" | "spin" | "open" | "fall" | "done"
  >("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animStarted = useRef<string | null>(null);

  const copyText = useCallback(
    (v: string) => {
      void navigator.clipboard?.writeText(v);
      haptic("light");
      showToast(tr("Copied", "Скопировано"));
    },
    [haptic, showToast, tr]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await raceList();
      setRooms(res.rooms || []);
      setRecent(res.recent || []);
      if (res.mine && view === "lobby") {
        // keep lobby list; optional auto-enter not forced
      }
      if (active?.id) {
        const st = await raceState(active.id);
        setActive(st.room);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [active?.id, view]);

  useEffect(() => {
    void refresh();
    pollRef.current = setInterval(() => void refresh(), 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    const handler =
      view === "lobby"
        ? onBack
        : () => {
            setView("lobby");
            setActive(null);
            setAnimPhase("idle");
          };
    setBackButton(handler);
    return () => setBackButton(null);
  }, [view, onBack, setBackButton]);

  // Animation + auto process when countdown ends
  useEffect(() => {
    if (!active) return;
    if (active.status === "countdown" || active.status === "open") {
      setAnimPhase("spin");
    }
    if (
      active.status === "countdown" &&
      active.secsLeft != null &&
      active.secsLeft <= 0
    ) {
      void raceProcess(active.id)
        .then((r) => {
          if (r.room) setActive(r.room);
          onReloadBalance();
        })
        .catch(() => {});
    }
    if (active.status === "racing" || active.status === "finished") {
      const key = `${active.id}:${active.status}`;
      if (animStarted.current !== key) {
        animStarted.current = key;
        setAnimPhase("open");
        const t1 = setTimeout(() => setAnimPhase("fall"), 900);
        const t2 = setTimeout(() => {
          setAnimPhase("done");
          if (active.status === "racing") {
            void raceProcess(active.id).then((r) => {
              if (r.room) setActive(r.room);
              onReloadBalance();
            });
          }
        }, 4500);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      }
    }
  }, [active, onReloadBalance]);

  const onCreate = async () => {
    if (busy) return;
    if (balance < RACE_MIN_BALL) {
      onDeposit?.();
      return;
    }
    setBusy(true);
    try {
      const res = await raceCreate(RACE_MIN_BALL);
      onBalanceUpdate(res.balance);
      setActive(res.room);
      setView("room");
      hapticSuccess();
      void refresh();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onBuy = async (roomId: string, count = 1) => {
    if (busy) return;
    const cost = RACE_MIN_BALL * count;
    if (balance < cost) {
      onDeposit?.();
      return;
    }
    setBusy(true);
    try {
      const res = await raceBuy(roomId, count);
      onBalanceUpdate(res.balance);
      setActive(res.room);
      setView("room");
      hapticSuccess();
      void refresh();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async (roomId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await raceCancel(roomId);
      haptic("light");
      setActive(null);
      setView("lobby");
      onReloadBalance();
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
    setView("history");
  };

  const header = (
    <div className="px-4 pt-3 pb-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        {view !== "lobby" && (
          <div className="text-[15px] font-semibold tracking-tight truncate">
            {view === "history"
              ? t("history")
              : tr("Race", "Гонка")}
          </div>
        )}
      </div>
      <div className="flex items-center shrink-0">
        <div className="flex items-center h-9 rounded-full glass border border-white/[0.12] shadow-[0_4px_20px_rgba(0,0,0,0.3)] overflow-hidden">
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
              className="h-full px-2.5 flex items-center justify-center text-cyan-200/90 hover:text-cyan-100 hover:bg-cyan-400/15 border-l border-white/[0.1] transition-colors btn-press"
              aria-label="Deposit"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (view === "history") {
    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        {header}
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
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-[13px] font-semibold">
                      Race {h.gameNo != null ? `#${h.gameNo}` : ""}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      {h.myBalls} {tr("balls", "шар.")} · pot {formatGram(h.pot)}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      h.result === "win"
                        ? "text-emerald-400"
                        : h.result === "cancel"
                          ? "text-white/45"
                          : "text-rose-400/90"
                    )}
                  >
                    {h.result === "win"
                      ? `+${formatGram(h.payout)}`
                      : h.result === "cancel"
                        ? tr("Refund", "Возврат")
                        : `−${formatGram(h.spent)}`}
                  </div>
                </div>
                <div className="mt-2 rounded-xl bg-black/25 border border-white/10 px-2.5 py-1.5 space-y-1">
                  <HashRow label="Hash" value={h.serverSeedHash} onCopy={copyText} />
                  {h.serverSeed && (
                    <HashRow label="Seed" value={h.serverSeed} onCopy={copyText} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === "room" && active) {
    const winner = active.balls.find((b) => b.id === active.winnerBallId);
    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        {header}
        <div className="px-4 flex-1 overflow-y-auto space-y-3">
          <RaceArena room={active} phase={animPhase} />

          {/* status strip */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] text-white/50">
                {active.status === "open" &&
                  tr("Waiting for players…", "Ждём игроков…")}
                {active.status === "countdown" && (
                  <span className="text-amber-300 font-semibold tabular-nums">
                    {tr("Starts in", "Старт через")}{" "}
                    {active.secsLeft ?? "—"}s
                    {active.secsLeft != null &&
                      active.secsLeft <= 5 &&
                      ` · ${tr("buys locked", "покупки закрыты")}`}
                  </span>
                )}
                {(active.status === "racing" || animPhase === "fall") &&
                  tr("Balls are racing!", "Шарики летят!")}
                {active.status === "finished" && animPhase === "done" && (
                  <span className="text-emerald-300 font-semibold">
                    {tr("Winner", "Победитель")}: @{winner?.username || "—"}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-white/40">
                {active.ballCount} {tr("balls", "шар.")} · {active.uniquePlayers}{" "}
                {tr("players", "игр.")}
              </div>
            </div>
            <div className="mt-2 rounded-xl bg-black/25 border border-white/10 px-2.5 py-1.5 space-y-1">
              <HashRow label="Hash" value={active.serverSeedHash} onCopy={copyText} />
              {active.serverSeed && (
                <HashRow label="Seed" value={active.serverSeed} onCopy={copyText} />
              )}
            </div>
          </div>

          {/* my balls + buy */}
          {active.canBuy && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onBuy(active.id, 1)}
                className="flex-1 h-12 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-40"
              >
                {tr("Buy ball", "Купить шарик")} · {formatGram(active.ballPrice)}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onBuy(active.id, 3)}
                className="h-12 px-4 rounded-2xl btn-secondary border border-white/10 text-sm btn-press disabled:opacity-40"
              >
                ×3
              </button>
            </div>
          )}

          {active.status === "open" && active.isHost && active.uniquePlayers < 2 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCancel(active.id)}
              className="w-full h-11 rounded-2xl text-sm text-white/50 border border-white/10 btn-press"
            >
              {t("cancel")}
            </button>
          )}

          {/* ball list */}
          <div className="text-[11px] uppercase tracking-wider text-white/35 mb-1">
            {tr("Balls", "Шарики")}
          </div>
          <div className="space-y-1.5 pb-6">
            {active.balls.map((b) => (
              <div
                key={b.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2",
                  b.isMine && "border-cyan-400/25 bg-cyan-500/[0.06]"
                )}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ background: b.color, boxShadow: `0 0 10px ${b.color}` }}
                />
                <div className="flex-1 min-w-0 text-[13px] truncate">
                  @{b.username}
                  {b.isMine && (
                    <span className="text-cyan-300/80 text-[11px] ml-1">
                      ({tr("you", "вы")})
                    </span>
                  )}
                </div>
                {b.finishRank != null && (
                  <div className="text-[12px] font-semibold text-white/60 tabular-nums">
                    #{b.finishRank}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* LOBBY */
  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {header}
      <div className="px-4 flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={busy}
          className="w-full relative overflow-hidden rounded-[22px] mb-4 btn-press active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-700 via-violet-700 to-fuchsia-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(34,211,238,0.45),transparent_55%)]" />
          <div className="relative px-5 py-4 flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-white">
                <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
                <path d="M12 11v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <div className="text-[16px] font-bold text-white tracking-tight">
                {tr("Start Race", "Начать гонку")}
              </div>
              <div className="text-[12px] text-white/55 mt-0.5">
                {tr(
                  `Buy a ball from ${RACE_MIN_BALL} GRAM · winner takes the pot`,
                  `Шарик от ${RACE_MIN_BALL} GRAM · победитель забирает банк`
                )}
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[11px] uppercase tracking-wider text-white/35">
            {tr("Open races", "Открытые гонки")}
          </div>
          <button
            type="button"
            onClick={() => void openHistory()}
            className="w-8 h-8 rounded-xl glass border border-white/[0.08] flex items-center justify-center text-white/45 hover:text-white/80 transition btn-press"
            aria-label={t("history")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </button>
        </div>

        {loading && rooms.length === 0 ? (
          <div className="space-y-2">
            <div className="h-[72px] rounded-2xl bg-white/[0.04] animate-pulse" />
            <div className="h-[72px] rounded-2xl bg-white/[0.04] animate-pulse" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-10 text-center">
            <div className="text-[14px] text-white/45 mb-1">
              {tr("No open races", "Нет открытых гонок")}
            </div>
            <div className="text-[12px] text-white/28">
              {tr("Be the first to start", "Начни первым")}
            </div>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  haptic("light");
                  setActive(r);
                  setView("room");
                }}
                className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:border-white/14 p-3.5 flex items-center gap-3 text-left transition btn-press"
              >
                <div className="flex -space-x-1.5">
                  {r.balls.slice(0, 4).map((b) => (
                    <div
                      key={b.id}
                      className="w-3 h-3 rounded-full border border-black/40"
                      style={{ background: b.color }}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium truncate">
                    {r.ballCount} {tr("balls", "шар.")} · {r.uniquePlayers}{" "}
                    {tr("players", "игр.")}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    {r.status === "countdown"
                      ? `${tr("Starts in", "Старт через")} ${r.secsLeft ?? "—"}s`
                      : tr("Open", "Открыта")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[16px] font-semibold text-gradient-cyan tabular-nums leading-none">
                    {formatGram(r.pot)}
                  </div>
                  <div className="text-[10px] text-white/30 mt-0.5">GRAM</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <>
            <div className="text-[11px] uppercase tracking-wider text-white/35 mb-2.5 mt-6">
              {tr("Recent", "Недавние")}
            </div>
            <div className="space-y-1.5 pb-8">
              {recent.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 flex justify-between text-[12px]"
                >
                  <span className="text-white/50">
                    #{r.gameNo ?? "—"} · {r.ballCount} {tr("balls", "шар.")}
                  </span>
                  <span className="text-emerald-400/90 tabular-nums">
                    {formatGram(r.pot)} GRAM
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn, formatGram } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { useTelegram } from "@/hooks/useTelegram";
import {
  PVP_ROULETTE_MIN_BET,
  PVP_ROULETTE_MAX_BET,
  PVP_ROULETTE_SPIN_MS,
  PVP_ROULETTE_PREP_MS,
  PVP_ROULETTE_MIN_PLAYERS,
} from "@/lib/pvpRouletteConstants";
import {
  fetchPvpRouletteState,
  placePvpRouletteBetApi,
  type PvpRouletteBetPublic,
  type PvpRouletteStateResponse,
} from "@/lib/pvpRouletteApi";
import {
  playBetSound,
  playClickSound,
  playWinSound,
  playLoseSound,
  playSpinSound,
  startWheelSound,
  stopWheelSound,
  resumeAudio,
} from "@/lib/sounds";

interface PvpRouletteScreenProps {
  balance: number;
  telegramId: number;
  username: string;
  photoUrl?: string | null;
  onBack: () => void;
  onBalanceUpdate: (b: number) => void;
  onReloadBalance: () => void;
  onDeposit?: () => void;
  haptic: (t?: "light" | "medium" | "heavy") => void;
  hapticSuccess: () => void;
  hapticError: () => void;
  showToast: (msg: string) => void;
}

const CHIP_AMOUNTS = [0.25, 0.5, 1, 2, 5, 10, 25, 50];
const AVATAR_SIZE = 56;
const AVATAR_GAP = 10;
const STRIP_ITEM = AVATAR_SIZE + AVATAR_GAP;

function Avatar({
  url,
  name,
  size = AVATAR_SIZE,
  highlight,
  dim,
}: {
  url: string | null;
  name: string;
  size?: number;
  highlight?: boolean;
  dim?: boolean;
}) {
  const letter = (name || "?").charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "relative rounded-full flex-shrink-0 overflow-hidden",
        highlight && "ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.55)]",
        dim && "opacity-40 scale-90"
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-white font-bold text-lg">
          {letter}
        </div>
      )}
      <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/20 pointer-events-none" />
    </div>
  );
}

function buildStrip(bets: PvpRouletteBetPublic[], repeats = 8): PvpRouletteBetPublic[] {
  if (!bets.length) return [];
  const out: PvpRouletteBetPublic[] = [];
  for (let r = 0; r < repeats; r++) {
    for (const b of bets) out.push(b);
  }
  return out;
}

export function PvpRouletteScreen({
  balance,
  telegramId,
  username,
  photoUrl,
  onBack,
  onBalanceUpdate,
  onReloadBalance,
  onDeposit,
  haptic,
  hapticSuccess,
  hapticError,
  showToast,
}: PvpRouletteScreenProps) {
  const { lang } = useI18n();
  const isRu = lang === "ru";
  const tr = (en: string, ru: string) => (isRu ? ru : en);
  const { setBackButton } = useTelegram();

  const [state, setState] = useState<PvpRouletteStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [betting, setBetting] = useState(false);
  const [chip, setChip] = useState(1);
  const [customAmt, setCustomAmt] = useState("");
  const [showWinner, setShowWinner] = useState(false);
  const [displayMs, setDisplayMs] = useState(Date.now());
  const offsetRef = useRef(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const lastStatusRef = useRef<string>("");
  const lastResultIdRef = useRef<string>("");
  const spinningRef = useRef(false);

  useEffect(() => {
    setBackButton(() => onBack());
    return () => setBackButton(null);
  }, [onBack, setBackButton]);

  const syncClock = useCallback((serverMs?: number, serverNow?: string) => {
    if (serverMs) {
      offsetRef.current = serverMs - Date.now();
    } else if (serverNow) {
      offsetRef.current = new Date(serverNow).getTime() - Date.now();
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const s = await fetchPvpRouletteState({ presence: true });
      syncClock(s.serverMs, s.serverNow);
      setState(s);
      if (typeof s.balance === "number") onBalanceUpdate(s.balance);
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  }, [onBalanceUpdate, syncClock]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 1200);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      setDisplayMs(Date.now() + offsetRef.current);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const round = state?.round;
  const bets = state?.bets || [];
  const myBet = state?.myBet || 0;
  const totalBank = round?.totalBank || 0;
  const status = round?.status || "waiting";

  const countdownSec = useMemo(() => {
    if (status !== "betting" || !round?.betEndsAt) return null;
    const left = Math.max(0, new Date(round.betEndsAt).getTime() - displayMs);
    return Math.ceil(left / 1000);
  }, [status, round?.betEndsAt, displayMs]);

  // Spin animation: server gives resultIndex; we animate strip to land on it
  useEffect(() => {
    if (!round || status !== "spinning" || !bets.length) {
      if (status !== "spinning") {
        spinningRef.current = false;
        stopWheelSound();
        if (animRef.current) cancelAnimationFrame(animRef.current);
      }
      return;
    }
    if (spinningRef.current) return;
    spinningRef.current = true;

    const resultIndex =
      typeof round.resultIndex === "number" ? round.resultIndex : 0;
    // During spinning server may not have result_index yet until settle —
    // we still animate randomly then snap; after finished we know exact.
    // Better: wait until we have spin_ends_at and animate over remaining time.
    const spinEnds = round.spinEndsAt
      ? new Date(round.spinEndsAt).getTime()
      : displayMs + PVP_ROULETTE_SPIN_MS;
    const start = Date.now() + offsetRef.current;
    const duration = Math.max(800, spinEnds - start);

    resumeAudio();
    playSpinSound();
    startWheelSound(duration);

    const strip = stripRef.current;
    if (!strip) return;

    const n = bets.length;
    // Target: middle of strip cycle that lands winner under pointer
    const repeats = 8;
    const cycle = n * STRIP_ITEM;
    const extraLoops = 4 + Math.floor(Math.random() * 2);
    const targetInCycle = resultIndex * STRIP_ITEM;
    // Pointer is center; item center should align
    const finalOffset =
      extraLoops * cycle + targetInCycle - (strip.clientWidth / 2 - AVATAR_SIZE / 2);

    const from = 0;
    const to = finalOffset;
    const t0 = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const elapsed = now - t0;
      const p = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(p);
      // slight bounce at end
      const bounce =
        p > 0.92 ? Math.sin((p - 0.92) / 0.08 * Math.PI) * 6 * (1 - (p - 0.92) / 0.08) : 0;
      const x = from + (to - from) * eased + bounce;
      strip.style.transform = `translate3d(${-x}px,0,0)`;
      if (p < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        stopWheelSound();
        strip.style.transform = `translate3d(${-to}px,0,0)`;
      }
    };
    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      stopWheelSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, round?.id, round?.spinEndsAt]);

  // Winner modal + haptics when finished
  useEffect(() => {
    if (status === "finished" && round?.id && round.id !== lastResultIdRef.current) {
      lastResultIdRef.current = round.id;
      setShowWinner(true);
      const won = Number(round.winnerTelegramId) === Number(telegramId);
      if (won) {
        playWinSound();
        hapticSuccess();
      } else if (myBet > 0) {
        playLoseSound();
        hapticError();
      }
    }
    if (status === "waiting" || status === "betting") {
      setShowWinner(false);
    }
    lastStatusRef.current = status;
  }, [status, round?.id, round?.winnerTelegramId, telegramId, myBet, hapticSuccess, hapticError]);

  const stripBets = useMemo(() => buildStrip(bets, 10), [bets]);

  const placeBet = async () => {
    const raw = customAmt.trim() ? Number(customAmt) : chip;
    const amount = myBet > 0 ? +(myBet + raw).toFixed(4) : +raw.toFixed(4);
    if (!Number.isFinite(amount) || amount < PVP_ROULETTE_MIN_BET) {
      showToast(tr(`Min ${PVP_ROULETTE_MIN_BET}`, `Мин. ${PVP_ROULETTE_MIN_BET}`));
      return;
    }
    if (amount > PVP_ROULETTE_MAX_BET) {
      showToast(tr(`Max ${PVP_ROULETTE_MAX_BET}`, `Макс. ${PVP_ROULETTE_MAX_BET}`));
      return;
    }
    if (balance < (myBet > 0 ? amount - myBet : amount)) {
      showToast(tr("Not enough balance", "Недостаточно средств"));
      onDeposit?.();
      return;
    }
    setBetting(true);
    resumeAudio();
    playBetSound();
    haptic("medium");
    try {
      const res = await placePvpRouletteBetApi(amount);
      setState(res);
      if (typeof res.balance === "number") onBalanceUpdate(res.balance);
      setCustomAmt("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      showToast(msg);
      hapticError();
      onReloadBalance();
    } finally {
      setBetting(false);
    }
  };

  const canBet =
    (status === "waiting" || status === "betting") &&
    !betting &&
    (countdownSec == null || countdownSec > 0);

  const winnerBet =
    status === "finished" && typeof round?.resultIndex === "number"
      ? bets[round.resultIndex]
      : bets.find((b) => b.telegramId === round?.winnerTelegramId);

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top bg-[#07070c]">
      {/* Header */}
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">
              {tr("PvP Roulette", "PvP Рулетка")}
            </h1>
            <p className="text-[12px] text-white/40 mt-0.5">
              {tr("Avatars · winner takes bank −5%", "Аватарки · победитель забирает банк −5%")}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-white/40 uppercase tracking-wider">
              {tr("Balance", "Баланс")}
            </div>
            <div className="text-[16px] font-semibold text-amber-300 tabular-nums">
              {formatGram(balance)}
            </div>
          </div>
        </div>
      </div>

      {/* Bank + timer */}
      <div className="px-4 mb-3">
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">
              {tr("Bank", "Банк")}
            </div>
            <div className="text-[26px] font-black text-white tabular-nums leading-none mt-1">
              {formatGram(totalBank)}{" "}
              <span className="text-[14px] font-semibold text-white/40">GRAM</span>
            </div>
          </div>
          <div className="text-right">
            {status === "betting" && countdownSec != null && (
              <>
                <div className="text-[11px] text-white/40 uppercase tracking-wider">
                  {tr("Starts in", "Старт через")}
                </div>
                <div
                  className={cn(
                    "text-[28px] font-black tabular-nums leading-none mt-1",
                    countdownSec <= 5 ? "text-rose-400" : "text-cyan-300"
                  )}
                >
                  {countdownSec}s
                </div>
              </>
            )}
            {status === "waiting" && (
              <div className="text-[13px] text-white/50 max-w-[140px]">
                {tr(
                  `Need ${PVP_ROULETTE_MIN_PLAYERS}+ players`,
                  `Нужно ${PVP_ROULETTE_MIN_PLAYERS}+ игрока`
                )}
              </div>
            )}
            {status === "spinning" && (
              <div className="text-[15px] font-semibold text-amber-300 animate-pulse">
                {tr("Spinning…", "Крутим…")}
              </div>
            )}
            {(status === "finished" || status === "cancelled") && (
              <div className="text-[13px] text-white/50">
                {status === "cancelled"
                  ? tr("Cancelled", "Отменён")
                  : tr("Result", "Результат")}
              </div>
            )}
          </div>
        </div>
        {/* Progress bar for betting */}
        {status === "betting" && round?.betEndsAt && (
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-200"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    ((new Date(round.betEndsAt).getTime() - displayMs) /
                      (18 * 1000)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Strip */}
      <div className="relative mx-2 mb-4">
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 z-20 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          <div className="h-full w-[2px] bg-gradient-to-b from-amber-400/90 to-amber-400/20 mx-auto" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[12px] border-l-transparent border-r-transparent border-b-amber-400" />
        </div>
        <div className="overflow-hidden rounded-2xl bg-black/40 border border-white/10 py-4 mask-fade-x">
          <div
            ref={stripRef}
            className="flex items-center will-change-transform"
            style={{ gap: AVATAR_GAP, paddingLeft: 12 }}
          >
            {stripBets.length === 0 ? (
              <div className="w-full text-center text-white/30 text-sm py-6 px-4">
                {tr("Place a bet — your avatar joins the strip", "Сделайте ставку — аватарка появится на ленте")}
              </div>
            ) : (
              stripBets.map((b, i) => {
                const isWinner =
                  (status === "finished" || status === "spinning") &&
                  Number(b.telegramId) === Number(round?.winnerTelegramId);
                return (
                  <div
                    key={`${b.id}-${i}`}
                    className="flex flex-col items-center flex-shrink-0"
                    style={{ width: AVATAR_SIZE }}
                  >
                    <Avatar
                      url={b.avatarUrl}
                      name={b.username}
                      highlight={isWinner && status === "finished"}
                      dim={status === "finished" && !isWinner}
                    />
                    <div className="mt-1 text-[9px] text-white/50 truncate max-w-full">
                      {b.username}
                    </div>
                    <div className="text-[10px] font-semibold text-amber-200/90 tabular-nums">
                      {formatGram(b.amount)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        {/* Fairness hash */}
        {round?.serverSeedHash && (
          <div className="mt-2 flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(round.serverSeedHash);
                playClickSound();
                showToast(tr("Hash copied", "Hash скопирован"));
              }}
              className="text-[10px] font-mono text-cyan-200/70 px-2 py-1 rounded-lg bg-black/30 border border-white/10"
            >
              hash {round.serverSeedHash.slice(0, 10)}…
            </button>
            {round.serverSeed && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(round.serverSeed!);
                  playClickSound();
                  showToast(tr("Seed copied", "Seed скопирован"));
                }}
                className="text-[10px] font-mono text-emerald-200/70 px-2 py-1 rounded-lg bg-black/30 border border-white/10"
              >
                seed {round.serverSeed.slice(0, 8)}…
              </button>
            )}
          </div>
        )}
      </div>

      {/* Players list */}
      <div className="px-4 flex-1 min-h-0 overflow-y-auto">
        <div className="text-[11px] text-white/40 uppercase tracking-wider mb-2">
          {tr("Players", "Игроки")} · {bets.length}
        </div>
        <div className="flex flex-col gap-1.5">
          {bets.length === 0 && (
            <div className="text-sm text-white/30 py-4 text-center">
              {tr("No bets yet", "Ставок пока нет")}
            </div>
          )}
          {[...bets]
            .sort((a, b) => b.amount - a.amount)
            .map((b) => (
              <div
                key={b.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 bg-white/[0.03] border border-white/8",
                  Number(b.telegramId) === Number(telegramId) &&
                    "border-amber-400/30 bg-amber-400/5"
                )}
              >
                <Avatar url={b.avatarUrl} name={b.username} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-white truncate">
                    {b.username}
                    {Number(b.telegramId) === Number(telegramId) && (
                      <span className="ml-1 text-[10px] text-amber-300">you</span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/40">{b.pct}%</div>
                </div>
                <div className="text-[14px] font-semibold text-white tabular-nums">
                  {formatGram(b.amount)}
                </div>
              </div>
            ))}
        </div>

        {/* History */}
        {state?.history && state.history.length > 0 && (
          <div className="mt-5 mb-4">
            <div className="text-[11px] text-white/40 uppercase tracking-wider mb-2">
              {tr("Recent", "Недавние")}
            </div>
            <div className="flex flex-col gap-1">
              {state.history.slice(0, 8).map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-[12px] text-white/50 px-1"
                >
                  <span className="truncate max-w-[55%]">
                    {h.winnerUsername || "—"}
                  </span>
                  <span className="tabular-nums text-amber-200/70">
                    {formatGram(h.winnerAmount || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bet controls */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 pt-3 bg-gradient-to-t from-[#07070c] via-[#07070c]/95 to-transparent z-30">
        <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
          {CHIP_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setChip(a);
                setCustomAmt("");
                playClickSound();
                haptic("light");
              }}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-all",
                chip === a && !customAmt
                  ? "bg-amber-400/20 border-amber-400/50 text-amber-200"
                  : "bg-white/5 border-white/10 text-white/70"
              )}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            inputMode="decimal"
            placeholder={tr("Custom", "Своя")}
            value={customAmt}
            onChange={(e) => setCustomAmt(e.target.value)}
            className="w-24 rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-[14px] text-white outline-none focus:border-cyan-400/40"
          />
          <button
            type="button"
            disabled={!canBet}
            onClick={placeBet}
            className={cn(
              "flex-1 rounded-2xl py-3.5 text-[15px] font-bold transition-all",
              canBet
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-[0_4px_24px_rgba(245,158,11,0.35)] active:scale-[0.98]"
                : "bg-white/10 text-white/35 cursor-not-allowed"
            )}
          >
            {myBet > 0
              ? tr(
                  `Raise +${formatGram(customAmt ? Number(customAmt) || chip : chip)}`,
                  `Увеличить +${formatGram(customAmt ? Number(customAmt) || chip : chip)}`
                )
              : tr(
                  `Bet ${formatGram(customAmt ? Number(customAmt) || chip : chip)}`,
                  `Ставка ${formatGram(customAmt ? Number(customAmt) || chip : chip)}`
                )}
          </button>
        </div>
        {myBet > 0 && (
          <div className="text-center text-[12px] text-amber-200/70 mt-1.5">
            {tr("Your bet", "Ваша ставка")}: {formatGram(myBet)} GRAM
          </div>
        )}
      </div>

      {/* Winner modal */}
      {showWinner && status === "finished" && winnerBet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-3xl bg-[#12121a] border border-white/10 p-6 text-center shadow-2xl">
            <div className="text-[13px] text-white/40 uppercase tracking-wider mb-3">
              {tr("Winner", "Победитель")}
            </div>
            <div className="flex justify-center mb-3">
              <Avatar
                url={winnerBet.avatarUrl}
                name={winnerBet.username}
                size={72}
                highlight
              />
            </div>
            <div className="text-[20px] font-bold text-white mb-1">
              {winnerBet.username}
            </div>
            <div className="text-[28px] font-black text-amber-300 tabular-nums">
              +{formatGram(round?.winnerAmount || 0)}
            </div>
            <div className="text-[12px] text-white/40 mt-1">
              {tr("Bank", "Банк")} {formatGram(totalBank)} ·{" "}
              {tr("fee 5%", "комиссия 5%")}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowWinner(false);
                playClickSound();
              }}
              className="mt-5 w-full rounded-2xl py-3.5 font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-white active:scale-[0.98]"
            >
              {tr("Play again", "Играть снова")}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="text-white/60 text-sm animate-pulse">
            {tr("Loading…", "Загрузка…")}
          </div>
        </div>
      )}
    </div>
  );
}

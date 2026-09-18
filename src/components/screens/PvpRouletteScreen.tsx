"use client";

/**
 * Gramelle LIVE PvP Avatar Roulette — premium UI
 */

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
  PVP_ROULETTE_MIN_PLAYERS,
  PVP_ROULETTE_COUNTDOWN_SEC,
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

const AVATAR = 64;
const GAP = 12;
const STRIDE = AVATAR + GAP;
const STRIP_COPIES = 12;
const SPIN_MIN_LOOPS = 5;

const CHIPS = [0.25, 0.5, 1, 2, 5, 10, 25, 50, 100];

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function shortMiddle(s: string | null | undefined, head = 8, tail = 6) {
  if (!s) return "—";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function Avatar({
  url,
  name,
  size = AVATAR,
  ring = "default",
  glow = false,
  dim = false,
}: {
  url: string | null;
  name: string;
  size?: number;
  ring?: "default" | "gold" | "cyan" | "win";
  glow?: boolean;
  dim?: boolean;
}) {
  const letter = (name || "?").charAt(0).toUpperCase();
  const ringCls =
    ring === "win"
      ? "ring-[2.5px] ring-amber-400"
      : ring === "gold"
        ? "ring-2 ring-amber-400/70"
        : ring === "cyan"
          ? "ring-2 ring-cyan-400/60"
          : "ring-1 ring-white/20";

  return (
    <div
      className={cn(
        "relative rounded-full flex-shrink-0 overflow-hidden transition-all duration-500",
        ringCls,
        dim && "opacity-35 scale-[0.92] grayscale-[0.3]",
        glow && "shadow-[0_0_28px_rgba(251,191,36,0.65)]"
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="w-full h-full object-cover select-none"
          draggable={false}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white font-black"
          style={{
            fontSize: size * 0.38,
            background:
              "linear-gradient(145deg,#4c1d95 0%,#7c3aed 45%,#06b6d4 100%)",
          }}
        >
          {letter}
        </div>
      )}
      <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/15 pointer-events-none" />
      {ring === "win" && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-amber-400/25 to-transparent pointer-events-none" />
      )}
    </div>
  );
}

function buildStrip(bets: PvpRouletteBetPublic[]): PvpRouletteBetPublic[] {
  if (!bets.length) return [];
  const out: PvpRouletteBetPublic[] = [];
  for (let r = 0; r < STRIP_COPIES; r++) {
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
  const [amountStr, setAmountStr] = useState("1");
  const [showWinner, setShowWinner] = useState(false);
  const [displayMs, setDisplayMs] = useState(Date.now());
  const [wheelX, setWheelX] = useState(0);

  const offsetRef = useRef(0);
  const wheelXRef = useRef(0);
  const spinRaf = useRef<number | null>(null);
  const spunForRound = useRef<string | null>(null);
  const lastResultId = useRef<string>("");
  const balanceRef = useRef(balance);
  const bettingLock = useRef(false);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    setBackButton(() => onBack());
    return () => setBackButton(null);
  }, [onBack, setBackButton]);

  const writeX = useCallback((x: number) => {
    wheelXRef.current = x;
    setWheelX(x);
  }, []);

  const syncClock = useCallback((serverMs?: number, serverNow?: string) => {
    if (serverMs) offsetRef.current = serverMs - Date.now();
    else if (serverNow)
      offsetRef.current = new Date(serverNow).getTime() - Date.now();
  }, []);

  const load = useCallback(async () => {
    try {
      const s = await fetchPvpRouletteState({ presence: true });
      syncClock(s.serverMs, s.serverNow);
      setState(s);
      if (typeof s.balance === "number") {
        balanceRef.current = s.balance;
        onBalanceUpdate(s.balance);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [onBalanceUpdate, syncClock]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 1100);
    return () => clearInterval(id);
  }, [load]);

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
  const roundId = round?.id;

  const countdownSec = useMemo(() => {
    if (status !== "betting" || !round?.betEndsAt) return null;
    const left = Math.max(0, new Date(round.betEndsAt).getTime() - displayMs);
    return Math.ceil(left / 1000);
  }, [status, round?.betEndsAt, displayMs]);

  const countdownPct = useMemo(() => {
    if (status !== "betting" || !round?.betEndsAt) return 0;
    const left = Math.max(0, new Date(round.betEndsAt).getTime() - displayMs);
    return Math.min(100, (left / (PVP_ROULETTE_COUNTDOWN_SEC * 1000)) * 100);
  }, [status, round?.betEndsAt, displayMs]);

  useEffect(() => {
    if (!round || status !== "spinning" || !bets.length) {
      if (status !== "spinning") {
        stopWheelSound();
        if (spinRaf.current) {
          cancelAnimationFrame(spinRaf.current);
          spinRaf.current = null;
        }
      }
      return;
    }
    if (spunForRound.current === round.id) return;
    spunForRound.current = round.id;

    const resultIndex =
      typeof round.resultIndex === "number" && round.resultIndex >= 0
        ? round.resultIndex
        : 0;

    const startX = wheelXRef.current;
    const period = STRIDE * bets.length;
    let dest =
      resultIndex * STRIDE +
      SPIN_MIN_LOOPS * period +
      Math.floor(Math.random() * 2) * period;
    while (dest - startX < period * 3) dest += period;

    let dur = PVP_ROULETTE_SPIN_MS;
    if (round.spinEndsAt) {
      const left =
        new Date(round.spinEndsAt).getTime() - (Date.now() + offsetRef.current);
      dur = Math.max(1400, Math.min(PVP_ROULETTE_SPIN_MS, left - 60));
    }

    resumeAudio();
    playSpinSound();
    startWheelSound(dur);
    haptic("medium");

    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = easeOutExpo(p);
      const bounce =
        p > 0.94
          ? Math.sin(((p - 0.94) / 0.06) * Math.PI) * 4 * (1 - (p - 0.94) / 0.06)
          : 0;
      writeX(startX + (dest - startX) * e + bounce);
      if (p < 1) {
        spinRaf.current = requestAnimationFrame(step);
      } else {
        writeX(dest);
        spinRaf.current = null;
        stopWheelSound();
        hapticSuccess();
      }
    };
    spinRaf.current = requestAnimationFrame(step);

    return () => {
      if (spinRaf.current) cancelAnimationFrame(spinRaf.current);
      stopWheelSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, roundId, round?.spinEndsAt, round?.resultIndex, bets.length]);

  useEffect(() => {
    if (status === "betting" || status === "waiting") {
      if (spunForRound.current && spunForRound.current !== roundId) {
        spunForRound.current = null;
      }
      if (bets.length > 0) {
        const period = STRIDE * bets.length;
        const x = wheelXRef.current;
        const snapped = ((x % period) + period) % period;
        if (Math.abs(x - snapped) > 1) writeX(snapped);
      } else {
        writeX(0);
      }
    }
  }, [status, roundId, bets.length, writeX]);

  useEffect(() => {
    if (
      status === "finished" &&
      round?.id &&
      round.id !== lastResultId.current
    ) {
      lastResultId.current = round.id;
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
  }, [
    status,
    round?.id,
    round?.winnerTelegramId,
    telegramId,
    myBet,
    hapticSuccess,
    hapticError,
  ]);

  const stripBets = useMemo(() => buildStrip(bets), [bets]);

  const amount = (() => {
    if (!amountStr.trim()) return 0;
    const n = parseFloat(amountStr.replace(",", "."));
    return Number.isFinite(n) ? +n.toFixed(4) : 0;
  })();

  const setAmt = (n: number) => {
    if (n <= 0) setAmountStr("");
    else setAmountStr(String(+n.toFixed(4)));
  };

  const placeBet = async () => {
    if (bettingLock.current) return;
    if (status !== "waiting" && status !== "betting") {
      showToast(tr("Bets closed", "Ставки закрыты"));
      hapticError();
      return;
    }
    const nextTotal = myBet > 0 ? +(myBet + amount).toFixed(4) : amount;
    if (amount < PVP_ROULETTE_MIN_BET && myBet === 0) {
      showToast(`Min ${PVP_ROULETTE_MIN_BET} GRAM`);
      hapticError();
      return;
    }
    if (amount <= 0) {
      showToast(tr("Enter amount", "Введите сумму"));
      hapticError();
      return;
    }
    if (nextTotal > PVP_ROULETTE_MAX_BET) {
      showToast(`Max ${PVP_ROULETTE_MAX_BET} GRAM`);
      hapticError();
      return;
    }
    if (amount > balanceRef.current) {
      showToast(tr("Not enough balance", "Недостаточно средств"));
      onDeposit?.();
      hapticError();
      return;
    }

    bettingLock.current = true;
    setBetting(true);
    resumeAudio();
    playBetSound();
    haptic("medium");

    try {
      const res = await placePvpRouletteBetApi(nextTotal);
      setState(res);
      if (typeof res.balance === "number") {
        balanceRef.current = res.balance;
        onBalanceUpdate(res.balance);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error");
      hapticError();
      onReloadBalance();
      void load();
    } finally {
      bettingLock.current = false;
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

  const iWon =
    status === "finished" &&
    Number(round?.winnerTelegramId) === Number(telegramId);

  const statusLabel = (() => {
    if (status === "betting" && countdownSec != null) return `${countdownSec}s`;
    if (status === "waiting") return tr("Waiting", "Ожидание");
    if (status === "spinning") return tr("Spinning", "Крутим");
    if (status === "finished") return tr("Result", "Итог");
    if (status === "cancelled") return tr("Cancelled", "Отмена");
    return status;
  })();

  const onCopy = async (label: string, full: string) => {
    if (!full) return;
    const ok = await copyText(full);
    if (ok) {
      haptic("light");
      playClickSound();
      showToast(tr(`${label} copied`, `${label} скопирован`));
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] pb-[7.5rem] safe-top">
      <div className="px-4 pt-1 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-black tracking-tight text-white leading-none">
            {tr("PvP Roulette", "PvP Рулетка")}
          </h1>
          <p className="text-[12px] text-white/40 mt-1.5 leading-snug">
            {tr(
              "Avatars · winner takes bank −5%",
              "Аватарки · победитель забирает банк −5%"
            )}
          </p>
        </div>
        <div className="text-right shrink-0 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3 py-2">
          <div className="text-[9px] text-white/35 uppercase tracking-wider">
            {tr("Balance", "Баланс")}
          </div>
          <div className="text-[15px] font-bold text-amber-300 tabular-nums leading-tight mt-0.5">
            {formatGram(balance)}
          </div>
        </div>
      </div>

      <div className="mx-4 mb-2">
        <div className="relative overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#0a0c14]/90 px-4 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(251,191,36,0.12),transparent_50%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_100%_100%,rgba(34,211,238,0.08),transparent_50%)] pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold">
                {tr("Bank", "Банк")}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[28px] font-black text-white tabular-nums tracking-tight leading-none">
                  {formatGram(totalBank)}
                </span>
                <span className="text-[12px] font-semibold text-white/35">GRAM</span>
              </div>
              {myBet > 0 && (
                <div className="mt-1.5 text-[11px] text-cyan-300/90 font-medium">
                  {tr("Your bet", "Ваша ставка")}{" "}
                  <span className="tabular-nums font-bold">{formatGram(myBet)}</span>
                  {totalBank > 0 && (
                    <span className="text-white/35 ml-1">
                      · {((myBet / totalBank) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="text-right">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border text-[13px] font-bold tabular-nums",
                  status === "betting" &&
                    countdownSec != null &&
                    countdownSec <= 5
                    ? "bg-rose-500/15 border-rose-400/30 text-rose-300"
                    : status === "spinning"
                      ? "bg-amber-500/15 border-amber-400/30 text-amber-300 animate-pulse"
                      : status === "finished"
                        ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
                        : "bg-white/[0.06] border-white/10 text-white/70"
                )}
              >
                {status === "betting" && countdownSec != null && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                  </span>
                )}
                {statusLabel}
              </div>
              <div className="mt-1.5 text-[11px] text-white/35">
                {bets.length}{" "}
                {tr(
                  bets.length === 1 ? "player" : "players",
                  bets.length === 1 ? "игрок" : "игроков"
                )}
                {status === "waiting" && (
                  <span>
                    {" "}
                    · {tr("need", "нужно")} {PVP_ROULETTE_MIN_PLAYERS}+
                  </span>
                )}
              </div>
            </div>
          </div>
          {status === "betting" && (
            <div className="relative mt-3 h-1 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-amber-400 transition-[width] duration-200 ease-linear"
                style={{ width: `${countdownPct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mx-4 mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => void onCopy("Hash", round?.serverSeedHash || "")}
          className="flex-1 min-w-0 flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-left active:scale-[0.99]"
        >
          <span className="text-[9px] text-white/35 uppercase tracking-wider shrink-0">
            Hash
          </span>
          <span className="text-[10px] font-mono text-cyan-200/75 truncate">
            {shortMiddle(round?.serverSeedHash, 6, 4)}
          </span>
        </button>
        {round?.serverSeed ? (
          <button
            type="button"
            onClick={() => void onCopy("Seed", round.serverSeed || "")}
            className="flex-1 min-w-0 flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-left active:scale-[0.99]"
          >
            <span className="text-[9px] text-white/35 uppercase tracking-wider shrink-0">
              Seed
            </span>
            <span className="text-[10px] font-mono text-emerald-200/75 truncate">
              {shortMiddle(round.serverSeed, 6, 4)}
            </span>
          </button>
        ) : (
          <div className="flex-1 min-w-0 rounded-xl bg-white/[0.02] border border-white/[0.05] px-2.5 py-1.5 flex items-center gap-1.5 opacity-40">
            <span className="text-[9px] text-white/30 uppercase tracking-wider shrink-0">
              Seed
            </span>
            <span className="text-[10px] font-mono text-white/25">—</span>
          </div>
        )}
      </div>

      <div className="mx-3 mt-1 relative rounded-[28px] overflow-hidden border border-white/[0.1] bg-[#070b18] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(56,189,248,0.12),transparent_55%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_120%,rgba(167,139,250,0.1),transparent_50%)] pointer-events-none" />

        <div className="absolute left-1/2 top-1.5 z-30 -translate-x-1/2">
          <div className="w-0 h-0 border-l-[9px] border-r-[9px] border-t-[13px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]" />
        </div>
        <div className="absolute left-1/2 bottom-1.5 z-30 -translate-x-1/2 rotate-180">
          <div className="w-0 h-0 border-l-[9px] border-r-[9px] border-t-[13px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]" />
        </div>
        <div className="absolute left-1/2 top-0 bottom-0 w-px z-20 bg-gradient-to-b from-transparent via-amber-400/70 to-transparent pointer-events-none" />

        <div className="absolute left-0 top-0 bottom-0 w-10 z-20 bg-gradient-to-r from-[#070b18] to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-10 z-20 bg-gradient-to-l from-[#070b18] to-transparent pointer-events-none" />

        <div className="relative h-[132px] overflow-hidden">
          {stripBets.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-6">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-dashed border-white/15 flex items-center justify-center">
                <span className="text-white/25 text-xl">+</span>
              </div>
              <p className="text-[12px] text-white/30 text-center leading-snug">
                {tr(
                  "Place a bet — your avatar joins the strip",
                  "Сделайте ставку — аватарка появится на ленте"
                )}
              </p>
            </div>
          ) : (
            <div
              className="absolute top-1/2 left-1/2 flex items-end will-change-transform"
              style={{
                transform: `translate3d(calc(-${AVATAR / 2}px - ${wheelX}px), -50%, 0)`,
                gap: GAP,
              }}
            >
              {stripBets.map((b, i) => {
                const isWin =
                  (status === "finished" || status === "spinning") &&
                  Number(b.telegramId) === Number(round?.winnerTelegramId);
                const isMe = Number(b.telegramId) === Number(telegramId);
                return (
                  <div
                    key={`${b.id}-${i}`}
                    className="flex flex-col items-center flex-shrink-0"
                    style={{ width: AVATAR }}
                  >
                    <Avatar
                      url={b.avatarUrl}
                      name={b.username}
                      size={AVATAR}
                      ring={
                        isWin && status === "finished"
                          ? "win"
                          : isMe
                            ? "cyan"
                            : "default"
                      }
                      glow={isWin && status === "finished"}
                      dim={status === "finished" && !isWin}
                    />
                    <div
                      className={cn(
                        "mt-1.5 text-[9px] font-semibold tabular-nums leading-none",
                        isWin && status === "finished"
                          ? "text-amber-300"
                          : "text-white/45"
                      )}
                    >
                      {formatGram(b.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {bets.length > 0 && (
        <div className="mt-3 px-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[...bets]
              .sort((a, b) => b.amount - a.amount)
              .map((b) => {
                const isWin =
                  status === "finished" &&
                  Number(b.telegramId) === Number(round?.winnerTelegramId);
                const isMe = Number(b.telegramId) === Number(telegramId);
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-2 rounded-2xl px-2.5 py-2 border min-w-[132px]",
                      isWin
                        ? "bg-amber-500/10 border-amber-400/35"
                        : isMe
                          ? "bg-cyan-500/10 border-cyan-400/25"
                          : "bg-white/[0.03] border-white/[0.07]"
                    )}
                  >
                    <Avatar
                      url={b.avatarUrl}
                      name={b.username}
                      size={32}
                      ring={isWin ? "win" : isMe ? "cyan" : "default"}
                      glow={isWin}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-white/85 truncate leading-tight">
                        {b.username}
                        {isMe && (
                          <span className="ml-1 text-[9px] text-cyan-300/80">
                            you
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-[12px] font-bold tabular-nums text-white">
                          {formatGram(b.amount)}
                        </span>
                        <span className="text-[10px] text-white/35 tabular-nums">
                          {b.pct}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {state?.history && state.history.length > 0 && (
        <div className="mt-4 px-4 flex-1 min-h-0">
          <div className="text-[10px] text-white/35 uppercase tracking-[0.12em] font-semibold mb-2">
            {tr("Recent winners", "Недавние победители")}
          </div>
          <div className="flex flex-col gap-1">
            {state.history.slice(0, 6).map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/[0.02] border border-white/[0.04]"
              >
                <span className="text-[12px] text-white/55 truncate max-w-[55%]">
                  {h.winnerUsername || "—"}
                </span>
                <span className="text-[12px] font-semibold tabular-nums text-amber-200/80">
                  +{formatGram(h.winnerAmount || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="fixed bottom-16 left-0 right-0 z-30 px-3 pt-3 pb-2 bg-gradient-to-t from-[#06060a] via-[#06060a]/95 to-transparent">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2.5">
          {CHIPS.map((c) => {
            const active = amount === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setAmt(c);
                  playClickSound();
                  haptic("light");
                }}
                className={cn(
                  "flex-shrink-0 min-w-[48px] px-3 py-2 rounded-full text-[13px] font-bold border transition-all active:scale-95",
                  active
                    ? "bg-gradient-to-b from-amber-400/25 to-amber-500/10 border-amber-400/50 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.2)]"
                    : "bg-white/[0.04] border-white/[0.08] text-white/65 hover:border-white/15"
                )}
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 items-stretch">
          <div className="relative w-[88px] shrink-0">
            <input
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0"
              className="w-full h-full rounded-2xl bg-white/[0.05] border border-white/[0.1] px-3 text-[15px] font-semibold text-white tabular-nums outline-none focus:border-cyan-400/40 placeholder:text-white/25"
            />
          </div>
          <button
            type="button"
            disabled={!canBet}
            onClick={() => void placeBet()}
            className={cn(
              "flex-1 rounded-2xl text-[15px] font-black tracking-tight transition-all active:scale-[0.98]",
              canBet
                ? "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-[#1a1000] shadow-[0_8px_28px_rgba(245,158,11,0.4)]"
                : "bg-white/[0.07] text-white/30 cursor-not-allowed border border-white/[0.06]"
            )}
          >
            {myBet > 0
              ? tr(`Raise +${formatGram(amount || 0)}`, `+${formatGram(amount || 0)}`)
              : tr(`Bet ${formatGram(amount || 0)}`, `Ставка ${formatGram(amount || 0)}`)}
          </button>
        </div>
      </div>

      {showWinner && status === "finished" && winnerBet && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md px-4 pb-8 sm:pb-0"
          onClick={() => setShowWinner(false)}
        >
          <div
            className="w-full max-w-sm relative overflow-hidden rounded-[28px] border border-white/12 bg-[#0e1018] shadow-[0_32px_80px_rgba(0,0,0,0.65)] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(251,191,36,0.18),transparent_55%)] pointer-events-none" />
            <div className="relative">
              <div className="text-[11px] text-white/40 uppercase tracking-[0.16em] font-semibold mb-4">
                {iWon
                  ? tr("You won!", "Вы победили!")
                  : tr("Winner", "Победитель")}
              </div>
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-amber-400/30 blur-xl scale-150" />
                  <Avatar
                    url={winnerBet.avatarUrl}
                    name={winnerBet.username}
                    size={88}
                    ring="win"
                    glow
                  />
                </div>
              </div>
              <div className="text-[20px] font-black text-white mb-1">
                {winnerBet.username}
              </div>
              <div className="text-[32px] font-black text-amber-300 tabular-nums tracking-tight">
                +{formatGram(round?.winnerAmount || 0)}
              </div>
              <div className="text-[12px] text-white/40 mt-1.5">
                {tr("Bank", "Банк")} {formatGram(totalBank)} ·{" "}
                {tr("house 5%", "комиссия 5%")}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowWinner(false);
                  playClickSound();
                  haptic("light");
                }}
                className="mt-6 w-full rounded-2xl py-3.5 font-bold text-[15px] bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-[0_8px_28px_rgba(34,211,238,0.25)] active:scale-[0.98]"
              >
                {tr("Play again", "Играть снова")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && !state && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 pointer-events-none">
          <div className="text-white/50 text-sm animate-pulse">
            {tr("Loading…", "Загрузка…")}
          </div>
        </div>
      )}
    </div>
  );
}

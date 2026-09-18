"use client";

/**
 * Gramelle LIVE PvP Avatar Roulette
 * Layout mirrors RouletteScreen 1:1 (flow, pb-28, no fixed bet bar).
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

const AVATAR = 56;
const GAP = 10;
const STRIDE = AVATAR + GAP;
const STRIP_COPIES = 14;
const SPIN_MIN_LOOPS = 5;

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function shortMiddle(s: string | null | undefined, head = 6, tail = 4) {
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
  highlight = false,
  me = false,
}: {
  url: string | null;
  name: string;
  size?: number;
  highlight?: boolean;
  me?: boolean;
}) {
  const letter = (name || "?").charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "relative rounded-full flex-shrink-0 overflow-hidden border transition-all duration-300",
        highlight
          ? "border-amber-300/90 scale-[1.06]"
          : me
            ? "border-cyan-300/50"
            : "border-white/15"
      )}
      style={{
        width: size,
        height: size,
        boxShadow: highlight
          ? "0 0 28px rgba(251,191,36,0.55), inset 0 1px 0 rgba(255,255,255,0.2)"
          : "inset 0 1px 0 rgba(255,255,255,0.1)",
      }}
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
            fontSize: size * 0.36,
            background:
              "linear-gradient(145deg,#4c1d95 0%,#7c3aed 50%,#0891b2 100%)",
          }}
        >
          {letter}
        </div>
      )}
    </div>
  );
}

function buildStrip(bets: PvpRouletteBetPublic[]) {
  if (!bets.length) return [] as PvpRouletteBetPublic[];
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
  const [amountStr, setAmountStr] = useState("");
  const [lastAmount, setLastAmount] = useState(1);
  const [betting, setBetting] = useState(false);
  const [displayMs, setDisplayMs] = useState(Date.now());
  const [wheelX, setWheelX] = useState(0);
  const [showWinner, setShowWinner] = useState(false);

  const offsetRef = useRef(0);
  const wheelXRef = useRef(0);
  const spinRaf = useRef<number | null>(null);
  const spunForRound = useRef<string | null>(null);
  const lastResultId = useRef("");
  const balanceRef = useRef(balance);
  const betLock = useRef(false);

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

  const load = useCallback(async () => {
    try {
      const s = await fetchPvpRouletteState({ presence: true });
      if (s.serverMs) offsetRef.current = s.serverMs - Date.now();
      else if (s.serverNow)
        offsetRef.current = new Date(s.serverNow).getTime() - Date.now();
      setState(s);
      if (typeof s.balance === "number") {
        balanceRef.current = s.balance;
        onBalanceUpdate(s.balance);
      }
    } catch {
      /* */
    }
  }, [onBalanceUpdate]);

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

  const endsAt =
    status === "betting" && round?.betEndsAt
      ? new Date(round.betEndsAt).getTime()
      : 0;
  const remainSec = endsAt ? Math.max(0, (endsAt - displayMs) / 1000) : 0;

  /* spin */
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
      writeX(startX + (dest - startX) * easeOutExpo(p));
      if (p < 1) spinRaf.current = requestAnimationFrame(step);
      else {
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
      } else writeX(0);
    }
  }, [status, roundId, bets.length, writeX]);

  useEffect(() => {
    if (status === "finished" && round?.id && round.id !== lastResultId.current) {
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
    if (status === "waiting" || status === "betting") setShowWinner(false);
  }, [status, round?.id, round?.winnerTelegramId, telegramId, myBet, hapticSuccess, hapticError]);

  const strip = useMemo(() => buildStrip(bets), [bets]);

  const amount = (() => {
    if (!amountStr.trim()) return 0;
    const n = parseFloat(amountStr.replace(",", "."));
    return Number.isFinite(n) ? +n.toFixed(4) : 0;
  })();

  const setAmt = (n: number) => {
    if (n <= 0) setAmountStr("");
    else setAmountStr(String(+n.toFixed(4)));
  };

  const onCopy = async (label: string, full: string) => {
    if (!full) return;
    if (await copyText(full)) {
      haptic("light");
      playClickSound();
      showToast(tr(`${label} copied`, `${label} скопирован`));
    }
  };

  const placeBet = async () => {
    if (betLock.current) return;
    if (status !== "waiting" && status !== "betting") {
      showToast(tr("Bets closed", "Ставки закрыты"));
      hapticError();
      return;
    }
    const add = amount > 0 ? amount : lastAmount || PVP_ROULETTE_MIN_BET;
    const nextTotal = myBet > 0 ? +(myBet + add).toFixed(4) : add;
    if (add < PVP_ROULETTE_MIN_BET && myBet === 0) {
      showToast(`Min ${PVP_ROULETTE_MIN_BET} GRAM`);
      hapticError();
      return;
    }
    if (nextTotal > PVP_ROULETTE_MAX_BET) {
      showToast(`Max ${PVP_ROULETTE_MAX_BET} GRAM`);
      hapticError();
      return;
    }
    if (add > balanceRef.current) {
      showToast(tr("Not enough balance", "Недостаточно средств"));
      onDeposit?.();
      hapticError();
      return;
    }

    betLock.current = true;
    setBetting(true);
    setLastAmount(add);
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
      betLock.current = false;
      setBetting(false);
    }
  };

  const canBet =
    (status === "waiting" || status === "betting") &&
    !betting &&
    (status !== "betting" || remainSec > 0.4);

  const winnerBet =
    status === "finished" && typeof round?.resultIndex === "number"
      ? bets[round.resultIndex]
      : bets.find((b) => b.telegramId === round?.winnerTelegramId);

  const iWon =
    status === "finished" &&
    Number(round?.winnerTelegramId) === Number(telegramId);

  const hashFull = round?.serverSeedHash || "";
  const seedFull =
    (status === "finished" || status === "cancelled") && round?.serverSeed
      ? round.serverSeed
      : "";

  return (
    <div className="flex flex-col min-h-[100dvh] pb-40 safe-top">
      {/* Header — same as LIVE Roulette */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
            <span>{tr("PvP Roulette", "PvP Рулетка")}</span>
          </div>
        </div>
        <div className="flex items-center shrink-0">
          <div className="flex items-center h-9 rounded-full glass border border-white/[0.12] shadow-[0_4px_20px_rgba(0,0,0,0.3)] overflow-hidden">
            <div className="flex items-center gap-1.5 pl-3 pr-2">
              <span className="text-[13px] font-semibold tabular-nums text-gradient-cyan">
                {formatGram(balance)}
              </span>
              <span className="text-[10px] text-white/35 font-medium">GRAM</span>
            </div>
            <button
              type="button"
              onClick={() => {
                haptic("light");
                onDeposit?.();
              }}
              className="h-full px-2.5 flex items-center justify-center text-cyan-200/90 hover:text-cyan-100 hover:bg-cyan-400/15 border-l border-white/[0.1] transition-colors btn-press"
              aria-label="Deposit"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Hash + Seed */}
      <div className="mx-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => hashFull && void onCopy("Hash", hashFull)}
          className="flex-1 min-w-0 flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-left active:scale-[0.99]"
        >
          <span className="text-[9px] text-white/35 uppercase tracking-wider shrink-0">Hash</span>
          <span className="text-[10px] font-mono text-white/55 truncate">
            {shortMiddle(hashFull)}
          </span>
        </button>
        {seedFull ? (
          <button
            type="button"
            onClick={() => void onCopy("Seed", seedFull)}
            className="flex-1 min-w-0 flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-left active:scale-[0.99]"
          >
            <span className="text-[9px] text-white/35 uppercase tracking-wider shrink-0">Seed</span>
            <span className="text-[10px] font-mono text-white/55 truncate">
              {shortMiddle(seedFull)}
            </span>
          </button>
        ) : (
          <div className="flex-1 min-w-0 rounded-xl bg-white/[0.02] border border-white/[0.05] px-2.5 py-1.5 flex items-center gap-1.5 opacity-40">
            <span className="text-[9px] text-white/30 uppercase tracking-wider shrink-0">Seed</span>
            <span className="text-[10px] font-mono text-white/25">—</span>
          </div>
        )}
      </div>

      {/* Bank line */}
      <div className="mx-4 mt-2 flex items-center justify-between gap-2">
        <div className="text-[12px] text-white/45">
          {tr("Bank", "Банк")}{" "}
          <span className="text-white font-semibold tabular-nums">
            {formatGram(totalBank)}
          </span>
          <span className="text-white/30"> GRAM</span>
        </div>
        <div className="text-[12px] text-white/40">
          {bets.length}/{PVP_ROULETTE_MIN_PLAYERS}+
          {myBet > 0 && (
            <span className="ml-2 text-cyan-300/90">
              {tr("You", "Вы")} {formatGram(myBet)}
            </span>
          )}
        </div>
      </div>

      {/* WHEEL */}
      <div className="mx-3 mt-3 relative rounded-[28px] overflow-hidden border border-white/[0.1] bg-[#070b18] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(56,189,248,0.12),transparent_55%)] pointer-events-none" />

        <div className="absolute left-1/2 top-1.5 z-30 -translate-x-1/2">
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
        </div>
        <div className="absolute left-1/2 bottom-1.5 z-30 -translate-x-1/2 rotate-180">
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
        </div>
        <div className="absolute left-1/2 top-0 bottom-0 w-px z-20 bg-gradient-to-b from-transparent via-cyan-300/60 to-transparent pointer-events-none" />

        <div className="relative h-[120px] overflow-hidden">
          {strip.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[12px] text-white/30 px-6 text-center">
                {tr("Place a bet to join", "Сделайте ставку, чтобы войти")}
              </span>
            </div>
          ) : (
            <div
              className="absolute top-1/2 left-1/2 flex items-center"
              style={{
                transform: `translate3d(calc(-${AVATAR / 2}px - ${wheelX}px), -50%, 0)`,
                gap: GAP,
                willChange: "transform",
              }}
            >
              {strip.map((b, i) => {
                const isWin =
                  status === "finished" &&
                  Number(b.telegramId) === Number(round?.winnerTelegramId) &&
                  Math.abs(i * STRIDE - wheelX) < STRIDE * 1.5;
                return (
                  <div
                    key={`${b.id}-${i}`}
                    className="shrink-0 flex items-center justify-center"
                    style={{ width: AVATAR, height: AVATAR }}
                  >
                    <Avatar
                      url={b.avatarUrl}
                      name={b.username}
                      size={AVATAR}
                      highlight={isWin}
                      me={Number(b.telegramId) === Number(telegramId)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Overlay: countdown / result — same as color roulette */}
        <div className="absolute inset-0 flex items-center justify-center z-[25] pointer-events-none">
          {status === "betting" && (
            <div className="px-5 py-2.5 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md text-center min-w-[108px]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                {tr("Start", "Старт")}
              </div>
              <div className="text-[30px] font-bold tabular-nums text-white leading-none mt-0.5">
                {remainSec.toFixed(1)}
                <span className="text-[15px] text-white/40 font-semibold ml-0.5">s</span>
              </div>
            </div>
          )}
          {status === "waiting" && (
            <div className="px-5 py-2.5 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md text-center">
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                {tr("Waiting", "Ожидание")}
              </div>
              <div className="text-[14px] font-semibold text-white/80 mt-0.5">
                {tr(
                  `${PVP_ROULETTE_MIN_PLAYERS}+ players`,
                  `${PVP_ROULETTE_MIN_PLAYERS}+ игрока`
                )}
              </div>
            </div>
          )}
          {status === "finished" && winnerBet && (
            <div className="px-5 py-2.5 rounded-2xl bg-black/85 border border-white/20 backdrop-blur-md text-center">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                {tr("Result", "Результат")}
              </div>
              <div className="text-lg font-black tracking-wide mt-0.5 text-amber-300">
                {winnerBet.username}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="mx-4 mt-3 flex items-center gap-2">
        <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">
          {tr("Last", "История")}
        </span>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 py-1 items-center">
          {(state?.history ?? []).slice(0, 16).map((h) => (
            <div
              key={h.id}
              className="shrink-0 flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.08] pl-0.5 pr-2 py-0.5"
              title={h.winnerUsername || ""}
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-[9px] font-bold text-white">
                {(h.winnerUsername || "?").charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] text-white/50 tabular-nums">
                {formatGram(h.winnerAmount || 0)}
              </span>
            </div>
          ))}
          {(state?.history ?? []).length === 0 && (
            <span className="text-[11px] text-white/25">—</span>
          )}
        </div>
      </div>

      {/* Amount — same pattern as color roulette */}
      <div className="mx-4 mt-3">
        <input
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          inputMode="decimal"
          placeholder={tr("Amount", "Сумма")}
          disabled={!canBet && status !== "waiting"}
          className="w-full h-11 rounded-2xl bg-white/[0.05] border border-white/10 px-4 text-[15px] font-semibold text-white tabular-nums outline-none focus:border-cyan-400/40 placeholder:text-white/30 disabled:opacity-40"
        />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {(
            [
              [tr("Clear", "Сброс"), () => setAmt(0)],
              [tr("Last", "Прошлая"), () => setAmt(lastAmount)],
              ["+0.25", () => setAmt((amount || 0) + 0.25)],
              ["+1", () => setAmt((amount || 0) + 1)],
              ["+5", () => setAmt((amount || 0) + 5)],
              ["½", () => setAmt(amount / 2)],
              [
                "×2",
                () => setAmt(Math.min(PVP_ROULETTE_MAX_BET, (amount || 1) * 2)),
              ],
              [
                "Max",
                () =>
                  setAmt(
                    Math.min(PVP_ROULETTE_MAX_BET, balanceRef.current)
                  ),
              ],
            ] as const
          ).map(([label, fn]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => {
                haptic("light");
                fn();
              }}
              disabled={!canBet && status !== "waiting"}
              className="h-9 rounded-xl bg-white/[0.05] border border-white/10 text-[12px] font-medium text-white/70 active:scale-95 disabled:opacity-40"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bet button */}
      <div className="mx-4 mt-3 mb-2">
        <button
          type="button"
          disabled={!canBet}
          onClick={() => void placeBet()}
          className={cn(
            "w-full h-12 rounded-2xl text-[15px] font-bold tracking-tight transition active:scale-[0.98] disabled:opacity-40",
            canBet
              ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-[0_8px_28px_rgba(34,211,238,0.25)]"
              : "bg-white/[0.08] text-white/40 border border-white/10"
          )}
        >
          {myBet > 0
            ? tr(
                `Raise +${formatGram(amount || lastAmount || 0)}`,
                `Увеличить +${formatGram(amount || lastAmount || 0)}`
              )
            : tr(
                `Bet ${formatGram(amount || lastAmount || PVP_ROULETTE_MIN_BET)}`,
                `Ставка ${formatGram(amount || lastAmount || PVP_ROULETTE_MIN_BET)}`
              )}
        </button>
      </div>

      {/* Players list */}
      <div className="mx-4 mt-4 mb-2">
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
          {tr("Players", "Игроки")} · {bets.length}
        </div>
        <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
          {bets.length === 0 && (
            <div className="text-[12px] text-white/25 py-3 text-center">
              {tr("No bets yet", "Ставок пока нет")}
            </div>
          )}
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
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 border",
                    isWin
                      ? "bg-amber-500/10 border-amber-400/30"
                      : isMe
                        ? "bg-cyan-500/10 border-cyan-400/20"
                        : "bg-white/[0.03] border-white/[0.06]"
                  )}
                >
                  <Avatar
                    url={b.avatarUrl}
                    name={b.username}
                    size={32}
                    highlight={isWin}
                    me={isMe}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-white/80 truncate">
                      {b.username}
                      {isMe && (
                        <span className="ml-1 text-[10px] text-cyan-300/80">
                          you
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/35">{b.pct}%</div>
                  </div>
                  <div className="text-[13px] font-semibold tabular-nums text-white">
                    {formatGram(b.amount)}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* spacer under BottomNav */}
      <div className="h-6 shrink-0" aria-hidden />

      {/* Winner modal */}
      {showWinner && status === "finished" && winnerBet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-5"
          onClick={() => setShowWinner(false)}
        >
          <div
            className="w-full max-w-sm rounded-[24px] border border-white/12 bg-[#0c0e16] p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] text-white/40 uppercase tracking-[0.16em] mb-3">
              {iWon ? tr("You won!", "Вы победили!") : tr("Winner", "Победитель")}
            </div>
            <div className="flex justify-center mb-3">
              <Avatar
                url={winnerBet.avatarUrl}
                name={winnerBet.username}
                size={72}
                highlight
              />
            </div>
            <div className="text-[18px] font-bold text-white">{winnerBet.username}</div>
            <div className="text-[28px] font-black text-amber-300 tabular-nums mt-1">
              +{formatGram(round?.winnerAmount || 0)}
            </div>
            <div className="text-[12px] text-white/35 mt-1">
              {tr("Bank", "Банк")} {formatGram(totalBank)}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowWinner(false);
                playClickSound();
              }}
              className="mt-5 w-full h-11 rounded-2xl font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-white active:scale-[0.98]"
            >
              {tr("OK", "OK")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

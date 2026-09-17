"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useI18n } from "@/lib/i18n/context";
import { formatGram, cn } from "@/lib/utils";
import {
  ROULETTE_MIN_BET,
  ROULETTE_MAX_BET,
  ROULETTE_WHEEL,
  ROULETTE_MULT,
  type RouletteColor,
} from "@/lib/rouletteConstants";
import {
  fetchRouletteState,
  placeRouletteBetApi,
  type RouletteStateResponse,
} from "@/lib/rouletteApi";

interface RouletteScreenProps {
  balance: number;
  telegramId: number | null;
  username: string;
  onBack: () => void;
  onBalanceUpdate: (b: number) => void;
  onDeposit: () => void;
  haptic: (t?: "light" | "medium" | "heavy") => void;
  hapticSuccess: () => void;
  hapticError: () => void;
  showToast: (msg: string) => void;
}

const SLOT_W = 64;
const SLOT_GAP = 8;
const SLOT_STRIDE = SLOT_W + SLOT_GAP;

function colorBg(c: RouletteColor) {
  if (c === "red") return "from-[#7f1d1d] to-[#b91c1c]";
  if (c === "black") return "from-[#1e293b] to-[#0f172a]";
  return "from-[#064e3b] to-[#059669]";
}

function colorSolid(c: RouletteColor) {
  if (c === "red") return "#ef4444";
  if (c === "black") return "#334155";
  return "#10b981";
}

export function RouletteScreen({
  balance,
  telegramId,
  username,
  onBack,
  onBalanceUpdate,
  onDeposit,
  haptic,
  hapticSuccess,
  hapticError,
  showToast,
}: RouletteScreenProps) {
  const { t, lang } = useI18n();
  const { setBackButton } = useTelegram();
  const tr = (en: string, ru: string) => (lang === "ru" ? ru : en);

  const [state, setState] = useState<RouletteStateResponse | null>(null);
  const [amountStr, setAmountStr] = useState("1");
  const [lastAmount, setLastAmount] = useState(1);
  const [betting, setBetting] = useState(false);
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const animRef = useRef<number | null>(null);
  const lastRoundId = useRef<string | null>(null);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    setBackButton(() => onBack());
    return () => setBackButton(null);
  }, [onBack, setBackButton]);

  const load = useCallback(async () => {
    try {
      const data = await fetchRouletteState();
      setState(data);
      return data;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 1000);
    return () => clearInterval(id);
  }, [load]);

  const remainingSec = useMemo(() => {
    if (!state) return 0;
    const { round, serverNow } = state;
    const now = new Date(serverNow).getTime();
    let end = 0;
    if (round.status === "betting") end = new Date(round.betEndsAt).getTime();
    else if (round.status === "spinning" && round.spinEndsAt)
      end = new Date(round.spinEndsAt).getTime();
    else if (round.status === "settled" && round.resultEndsAt)
      end = new Date(round.resultEndsAt).getTime();
    return Math.max(0, (end - now) / 1000);
  }, [state]);

  // Wheel: repeat pattern many times for scroll
  const strip = useMemo(() => {
    const base = state?.wheel || ROULETTE_WHEEL;
    const out: RouletteColor[] = [];
    for (let i = 0; i < 12; i++) out.push(...base);
    return out;
  }, [state?.wheel]);

  const centerOffsetForSlot = useCallback(
    (slot: number, loops = 4) => {
      const n = ROULETTE_WHEEL.length;
      // viewport center aligns to middle of a slot
      const index = loops * n + slot;
      return index * SLOT_STRIDE;
    },
    []
  );

  // Animate spin when status → spinning
  useEffect(() => {
    if (!state) return;
    const { round } = state;

    if (
      round.status === "spinning" &&
      round.resultSlot != null &&
      (lastStatus.current !== "spinning" || lastRoundId.current !== round.id)
    ) {
      lastStatus.current = "spinning";
      lastRoundId.current = round.id;
      const target = centerOffsetForSlot(round.resultSlot, 5);
      const start = offset;
      const dist = target - start + SLOT_STRIDE * ROULETTE_WHEEL.length * 2;
      const finalTarget = start + dist;
      const duration = 4000;
      const t0 = performance.now();
      setSpinning(true);
      if (animRef.current) cancelAnimationFrame(animRef.current);

      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        // ease-out cubic
        const e = 1 - Math.pow(1 - p, 3);
        setOffset(start + (finalTarget - start) * e);
        if (p < 1) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          setSpinning(false);
          setOffset(finalTarget);
          hapticSuccess();
        }
      };
      animRef.current = requestAnimationFrame(tick);
    }

    if (round.status === "betting" && lastStatus.current !== "betting") {
      lastStatus.current = "betting";
      // soft reset strip position
      setOffset(centerOffsetForSlot(0, 2));
      setSpinning(false);
    }

    if (round.status === "settled") {
      lastStatus.current = "settled";
    }
  }, [state, centerOffsetForSlot, offset, hapticSuccess]);

  const amount = (() => {
    const n = parseFloat(amountStr.replace(",", "."));
    return Number.isFinite(n) ? +n.toFixed(4) : 0;
  })();

  const setAmt = (n: number) => {
    const v = Math.max(0, +n.toFixed(4));
    setAmountStr(String(v));
  };

  const onBet = async (color: RouletteColor) => {
    if (!telegramId) {
      showToast(tr("Login required", "Нужен вход"));
      return;
    }
    if (state?.round.status !== "betting") {
      showToast(tr("Bets closed", "Ставки закрыты"));
      hapticError();
      return;
    }
    if (amount < ROULETTE_MIN_BET) {
      showToast(tr(`Min ${ROULETTE_MIN_BET}`, `Мин. ${ROULETTE_MIN_BET}`));
      hapticError();
      return;
    }
    if (amount > balance) {
      showToast(tr("Insufficient balance", "Недостаточно средств"));
      hapticError();
      return;
    }
    setBetting(true);
    haptic("light");
    try {
      const res = await placeRouletteBetApi(color, amount);
      setLastAmount(amount);
      onBalanceUpdate(res.balance);
      setState(res);
      hapticSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error");
      hapticError();
    } finally {
      setBetting(false);
    }
  };

  const pools = state?.pools || { red: 0, black: 0, green: 0 };
  const myBets = state?.myBets || { red: 0, black: 0, green: 0 };
  const status = state?.round.status || "betting";
  const hash = state?.round.serverSeedHash?.slice(0, 10) || "—";

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {/* Header */}
      <div className="px-4 pt-3 flex items-center justify-between gap-2">
        <div className="text-[15px] font-semibold tracking-tight">LIVE</div>
        <button
          type="button"
          onClick={onDeposit}
          className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/5 border border-white/10 text-sm tabular-nums"
        >
          <span className="text-cyan-300 font-semibold">{formatGram(balance)}</span>
          <span className="text-white/40 text-xs">GRAM</span>
          <span className="text-cyan-400 font-bold">+</span>
        </button>
      </div>

      {/* Fairness */}
      <div className="mx-4 mt-2 flex items-center justify-between text-[10px] text-white/35 font-mono">
        <span>
          #{state?.round.id?.slice(0, 6) || "····"} · {hash}…
        </span>
        <span className="uppercase tracking-wider">
          {status === "betting"
            ? tr("Betting", "Ставки")
            : status === "spinning"
              ? tr("Spin", "Спин")
              : tr("Result", "Итог")}
        </span>
      </div>

      {/* Wheel */}
      <div className="relative mt-4 mx-2 overflow-hidden rounded-[24px] border border-white/10 bg-black/40">
        <div className="absolute left-1/2 top-1 z-20 -translate-x-1/2 text-cyan-300 text-xs">▼</div>
        <div className="absolute left-1/2 bottom-1 z-20 -translate-x-1/2 text-cyan-300 text-xs">▲</div>
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-cyan-400/40 z-10 pointer-events-none" />

        <div
          className="flex items-center py-4 will-change-transform"
          style={{
            transform: `translateX(calc(50% - ${SLOT_W / 2}px - ${offset}px))`,
            gap: SLOT_GAP,
          }}
        >
          {strip.map((c, i) => (
            <div
              key={i}
              className={cn(
                "shrink-0 rounded-2xl bg-gradient-to-br border border-white/15 flex items-center justify-center",
                colorBg(c),
                state?.round.resultSlot != null &&
                  status !== "betting" &&
                  i % ROULETTE_WHEEL.length === state.round.resultSlot &&
                  status === "settled"
                  ? "ring-2 ring-cyan-300 scale-105"
                  : ""
              )}
              style={{ width: SLOT_W, height: SLOT_W }}
            >
              <div
                className="w-7 h-7 rounded-lg border border-white/25"
                style={{ background: colorSolid(c), opacity: 0.95 }}
              />
            </div>
          ))}
        </div>

        {/* Center timer / status */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {status === "betting" && (
            <div className="px-4 py-2 rounded-2xl bg-black/70 border border-white/20 backdrop-blur-md text-center">
              <div className="text-[11px] text-white/50 uppercase tracking-widest">Start</div>
              <div className="text-2xl font-bold tabular-nums text-white">
                {remainingSec.toFixed(1)}s
              </div>
            </div>
          )}
          {status === "settled" && state?.round.resultColor && (
            <div className="px-4 py-2 rounded-2xl bg-black/70 border border-white/20 backdrop-blur-md text-center">
              <div className="text-[11px] text-white/50 uppercase tracking-widest">
                {tr("Result", "Результат")}
              </div>
              <div
                className="text-lg font-black uppercase"
                style={{ color: colorSolid(state.round.resultColor) }}
              >
                {state.round.resultColor} ×{ROULETTE_MULT[state.round.resultColor]}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History dots */}
      <div className="mx-4 mt-3 flex gap-1.5 overflow-x-auto no-scrollbar py-1">
        {(state?.history || []).map((h) => (
          <div
            key={h.id}
            className="w-3 h-3 rounded-full shrink-0 border border-white/20"
            style={{ background: colorSolid(h.color) }}
            title={h.color}
          />
        ))}
      </div>

      {/* Amount */}
      <div className="mx-4 mt-3">
        <input
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          inputMode="decimal"
          placeholder={tr("Enter bet amount…", "Сумма ставки…")}
          className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 px-4 text-center text-base tabular-nums outline-none focus:border-cyan-500/40"
          disabled={status !== "betting"}
        />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[
            { l: "Clear", a: () => setAmt(0) },
            { l: "Last", a: () => setAmt(lastAmount) },
            { l: "+0.1", a: () => setAmt(amount + 0.1) },
            { l: "+1", a: () => setAmt(amount + 1) },
            { l: "+10", a: () => setAmt(amount + 10) },
            { l: "½", a: () => setAmt(amount / 2) },
            { l: "×2", a: () => setAmt(Math.min(ROULETTE_MAX_BET, amount * 2 || 1)) },
            { l: "Max", a: () => setAmt(Math.min(ROULETTE_MAX_BET, balance)) },
          ].map((b) => (
            <button
              key={b.l}
              type="button"
              onClick={() => {
                haptic("light");
                b.a();
              }}
              className="h-9 rounded-xl bg-white/5 border border-white/10 text-[12px] font-medium text-white/70 active:scale-95"
              disabled={status !== "betting"}
            >
              {b.l}
            </button>
          ))}
        </div>
      </div>

      {/* Color buttons */}
      <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
        {(
          [
            { c: "red" as const, label: "RED", mult: 2 },
            { c: "green" as const, label: "GREEN", mult: 14 },
            { c: "black" as const, label: "BLACK", mult: 2 },
          ] as const
        ).map((btn) => (
          <button
            key={btn.c}
            type="button"
            disabled={betting || status !== "betting"}
            onClick={() => void onBet(btn.c)}
            className={cn(
              "relative overflow-hidden rounded-2xl border border-white/15 p-3 text-left active:scale-[0.98] transition disabled:opacity-50",
              btn.c === "red" && "bg-gradient-to-br from-red-700 to-red-900",
              btn.c === "green" && "bg-gradient-to-br from-emerald-600 to-emerald-900",
              btn.c === "black" && "bg-gradient-to-br from-slate-700 to-slate-900"
            )}
          >
            <div className="text-[11px] font-bold text-white/90">
              {btn.label} ×{btn.mult}
            </div>
            <div className="mt-1 text-[10px] text-white/50">
              {tr("Pool", "Банк")} {formatGram(pools[btn.c])}
            </div>
            <div className="text-[10px] text-cyan-200/80">
              {tr("You", "Вы")} {formatGram(myBets[btn.c])}
            </div>
          </button>
        ))}
      </div>

      {state?.round.serverSeed && status === "settled" && (
        <div className="mx-4 mt-3 text-[10px] text-white/30 font-mono break-all">
          seed: {state.round.serverSeed.slice(0, 24)}…
        </div>
      )}
    </div>
  );
}

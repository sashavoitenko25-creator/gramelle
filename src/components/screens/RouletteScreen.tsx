"use client";

/**
 * Gramelle LIVE Roulette
 * - Smooth countdown via rAF + server clock offset (no 1s jumps)
 * - Wheel spins once per round to server result_slot (HMAC fair)
 * - All clients share the same round via /api/roulette/state
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useI18n } from "@/lib/i18n/context";
import { formatGram, cn } from "@/lib/utils";
import {
  ROULETTE_MIN_BET,
  ROULETTE_MAX_BET,
  ROULETTE_WHEEL,
  ROULETTE_MULT,
  ROULETTE_SLOT_COUNT,
  ROULETTE_SPIN_MS,
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

const SLOT_W = 74;
const SLOT_GAP = 10;
const STRIDE = SLOT_W + SLOT_GAP;
const STRIP_COPIES = 20;
const SPIN_MIN_LOOPS = 5;

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function grad(c: RouletteColor) {
  if (c === "red")
    return "linear-gradient(160deg,#881337 0%,#e11d48 42%,#9f1239 100%)";
  if (c === "black")
    return "linear-gradient(160deg,#020617 0%,#1e293b 50%,#0f172a 100%)";
  return "linear-gradient(160deg,#064e3b 0%,#10b981 45%,#047857 100%)";
}

function hex(c: RouletteColor) {
  if (c === "red") return "#fb7185";
  if (c === "black") return "#94a3b8";
  return "#34d399";
}

function glow(c: RouletteColor) {
  if (c === "red") return "rgba(244,63,94,0.55)";
  if (c === "black") return "rgba(148,163,184,0.4)";
  return "rgba(52,211,153,0.55)";
}

export function RouletteScreen({
  balance,
  telegramId,
  onBack,
  onBalanceUpdate,
  onDeposit,
  haptic,
  hapticSuccess,
  hapticError,
  showToast,
}: RouletteScreenProps) {
  const { lang } = useI18n();
  const { setBackButton } = useTelegram();
  const tr = (en: string, ru: string) => (lang === "ru" ? ru : en);

  const [state, setState] = useState<RouletteStateResponse | null>(null);
  const [amountStr, setAmountStr] = useState("1");
  const [lastAmount, setLastAmount] = useState(1);
  const [betting, setBetting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Smooth display clock (ms, aligned to server)
  const [displayMs, setDisplayMs] = useState(() => Date.now());
  const offsetRef = useRef(0);

  // Wheel translation (px). Slot centers at i*STRIDE; pointer at 0 in local strip space after centering transform.
  const [wheelX, setWheelX] = useState(0);
  const wheelXRef = useRef(0);
  const spinRaf = useRef<number | null>(null);
  const idleRaf = useRef<number | null>(null);
  const spunForRound = useRef<string | null>(null);
  const statusRef = useRef<string>("betting");

  const writeX = (x: number) => {
    wheelXRef.current = x;
    setWheelX(x);
  };

  useEffect(() => {
    setBackButton(() => onBack());
    return () => setBackButton(null);
  }, [onBack, setBackButton]);

  // 60fps local clock
  useEffect(() => {
    let id = 0;
    const tick = () => {
      setDisplayMs(Date.now() + offsetRef.current);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const mergeState = useCallback((data: RouletteStateResponse) => {
    if (typeof data.serverMs === "number") {
      offsetRef.current = data.serverMs - Date.now();
    } else if (data.serverNow) {
      offsetRef.current = new Date(data.serverNow).getTime() - Date.now();
    }
    setState(data);
    setLoadError(null);
    statusRef.current = data.round.status;
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchRouletteState();
      mergeState(data);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Load failed";
      setLoadError(msg);
      return null;
    }
  }, [mergeState]);

  useEffect(() => {
    void load();
    const iv = window.setInterval(() => void load(), 800);
    return () => clearInterval(iv);
  }, [load]);

  const status = state?.round.status ?? "betting";
  const roundId = state?.round.id;

  const endsAt = useMemo(() => {
    if (!state) return 0;
    const r = state.round;
    if (r.status === "betting") return new Date(r.betEndsAt).getTime();
    if (r.status === "spinning" && r.spinEndsAt)
      return new Date(r.spinEndsAt).getTime();
    if (r.status === "settled" && r.resultEndsAt)
      return new Date(r.resultEndsAt).getTime();
    return 0;
  }, [state]);

  const remainSec = Math.max(0, (endsAt - displayMs) / 1000);

  const strip = useMemo(() => {
    const base =
      state?.wheel && state.wheel.length === ROULETTE_SLOT_COUNT
        ? state.wheel
        : ROULETTE_WHEEL;
    const out: RouletteColor[] = [];
    for (let i = 0; i < STRIP_COPIES; i++) out.push(...base);
    return out;
  }, [state?.wheel]);

  const targetX = useCallback((slot: number, loops: number) => {
    const idx = loops * ROULETTE_SLOT_COUNT + (slot % ROULETTE_SLOT_COUNT);
    return idx * STRIDE;
  }, []);

  // Idle crawl in betting
  useEffect(() => {
    if (status !== "betting") {
      if (idleRaf.current) {
        cancelAnimationFrame(idleRaf.current);
        idleRaf.current = null;
      }
      return;
    }
    let alive = true;
    const origin = wheelXRef.current;
    const t0 = performance.now();
    const step = (t: number) => {
      if (!alive) return;
      if (statusRef.current !== "betting") return;
      // ~22px/s gentle motion
      writeX(origin + ((t - t0) / 1000) * 22);
      idleRaf.current = requestAnimationFrame(step);
    };
    idleRaf.current = requestAnimationFrame(step);
    return () => {
      alive = false;
      if (idleRaf.current) cancelAnimationFrame(idleRaf.current);
    };
  }, [status, roundId]);

  // Spin to result once per round
  useEffect(() => {
    if (!state) return;
    const r = state.round;
    if (r.status !== "spinning" || r.resultSlot == null) return;
    if (spunForRound.current === r.id) return;

    spunForRound.current = r.id;
    if (idleRaf.current) {
      cancelAnimationFrame(idleRaf.current);
      idleRaf.current = null;
    }
    if (spinRaf.current) cancelAnimationFrame(spinRaf.current);

    const slot = r.resultSlot;
    const start = wheelXRef.current;
    let dest = targetX(slot, SPIN_MIN_LOOPS);
    // guarantee long travel
    const minTravel = STRIDE * ROULETTE_SLOT_COUNT * 4;
    while (dest - start < minTravel) dest += STRIDE * ROULETTE_SLOT_COUNT;

    const dur = Math.min(ROULETTE_SPIN_MS, 5200);
    const t0 = performance.now();
    haptic("medium");

    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = easeOutExpo(p);
      writeX(start + (dest - start) * e);
      if (p < 1) {
        spinRaf.current = requestAnimationFrame(step);
      } else {
        writeX(dest);
        spinRaf.current = null;
        hapticSuccess();
      }
    };
    spinRaf.current = requestAnimationFrame(step);

    return () => {
      if (spinRaf.current) cancelAnimationFrame(spinRaf.current);
    };
    // intentionally not depending on wheelX
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.round.id, state?.round.status, state?.round.resultSlot]);

  // Allow next spin after new betting round
  useEffect(() => {
    if (status === "betting" && roundId && spunForRound.current !== roundId) {
      // keep spunForRound until we see a new id different from spun
      if (spunForRound.current && spunForRound.current !== roundId) {
        spunForRound.current = null;
      }
    }
    if (status === "betting" && roundId) {
      // if we already spun a previous round, clear when id changes
      if (spunForRound.current && spunForRound.current !== roundId) {
        spunForRound.current = null;
      }
    }
  }, [status, roundId]);

  const amount = (() => {
    const n = parseFloat(amountStr.replace(",", "."));
    return Number.isFinite(n) ? +n.toFixed(4) : 0;
  })();

  const setAmt = (n: number) => setAmountStr(String(Math.max(0, +n.toFixed(4))));

  const onBet = async (color: RouletteColor) => {
    if (!telegramId) {
      showToast(tr("Login required", "Нужен вход"));
      return;
    }
    if (status !== "betting") {
      showToast(tr("Bets closed", "Ставки закрыты"));
      hapticError();
      return;
    }
    if (amount < ROULETTE_MIN_BET) {
      showToast(`Min ${ROULETTE_MIN_BET} GRAM`);
      hapticError();
      return;
    }
    if (amount > balance + 1e-9) {
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
      mergeState(res);
      hapticSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error");
      hapticError();
    } finally {
      setBetting(false);
    }
  };

  const pools = state?.pools ?? { red: 0, black: 0, green: 0 };
  const myBets = state?.myBets ?? { red: 0, black: 0, green: 0 };
  const resultColor = state?.round.resultColor;
  const resultSlot = state?.round.resultSlot;
  const hashShort = state?.round.serverSeedHash?.slice(0, 10) ?? "··········";

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-4 pt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[17px] font-bold tracking-tight">LIVE Roulette</div>
          <div className="text-[10px] text-white/35 font-mono truncate mt-0.5">
            #{state?.round.id?.slice(0, 8) ?? "········"} · {hashShort}
          </div>
        </div>
        <button
          type="button"
          onClick={onDeposit}
          className="flex items-center gap-1.5 pl-3 pr-2 h-9 rounded-full bg-white/[0.06] border border-white/10 shrink-0"
        >
          <span className="text-cyan-300 font-semibold text-sm tabular-nums">
            {formatGram(balance)}
          </span>
          <span className="text-white/35 text-[10px]">GRAM</span>
          <span className="w-5 h-5 rounded-full bg-cyan-500/25 text-cyan-200 flex items-center justify-center text-sm font-bold leading-none">
            +
          </span>
        </button>
      </div>

      {loadError && (
        <div className="mx-4 mt-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          {loadError}
          <button type="button" className="underline ml-2" onClick={() => void load()}>
            retry
          </button>
        </div>
      )}

      {/* WHEEL */}
      <div className="mx-3 mt-4 relative rounded-[28px] overflow-hidden border border-white/[0.1] bg-[#070b18] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(56,189,248,0.12),transparent_55%)] pointer-events-none" />

        {/* pointers */}
        <div className="absolute left-1/2 top-1.5 z-30 -translate-x-1/2">
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
        </div>
        <div className="absolute left-1/2 bottom-1.5 z-30 -translate-x-1/2 rotate-180">
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
        </div>
        <div className="absolute left-1/2 top-0 bottom-0 w-px z-20 bg-gradient-to-b from-transparent via-cyan-300/60 to-transparent pointer-events-none" />

        <div className="relative h-[120px] overflow-hidden">
          <div
            className="absolute top-1/2 left-1/2 flex items-center"
            style={{
              transform: `translate3d(calc(-${SLOT_W / 2}px - ${wheelX}px), -50%, 0)`,
              gap: SLOT_GAP,
              willChange: "transform",
            }}
          >
            {strip.map((c, i) => {
              const slotIdx = i % ROULETTE_SLOT_COUNT;
              const highlight =
                status === "settled" &&
                resultSlot != null &&
                slotIdx === resultSlot &&
                Math.abs(i * STRIDE - wheelX) < STRIDE * 1.5;

              return (
                <div
                  key={`${i}-${c}`}
                  className={cn(
                    "shrink-0 rounded-[18px] border flex items-center justify-center",
                    highlight ? "border-cyan-200/90 scale-[1.06]" : "border-white/12"
                  )}
                  style={{
                    width: SLOT_W,
                    height: SLOT_W,
                    background: grad(c),
                    boxShadow: highlight
                      ? `0 0 32px ${glow(c)}, inset 0 1px 0 rgba(255,255,255,0.2)`
                      : "inset 0 1px 0 rgba(255,255,255,0.1)",
                    transition: "box-shadow 0.25s ease, transform 0.25s ease",
                  }}
                >
                  <div
                    className="w-[34px] h-[34px] rounded-[12px] border border-white/20"
                    style={{
                      background: hex(c),
                      opacity: c === "black" ? 0.9 : 1,
                      boxShadow: `0 0 14px ${glow(c)}`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* center HUD */}
        <div className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none">
          {status === "betting" && (
            <div className="px-5 py-2.5 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md text-center min-w-[108px]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                Start
              </div>
              <div className="text-[30px] font-bold tabular-nums text-white leading-none mt-0.5">
                {remainSec.toFixed(1)}
                <span className="text-[15px] text-white/40 font-semibold ml-0.5">s</span>
              </div>
            </div>
          )}
          {status === "spinning" && (
            <div className="px-5 py-2.5 rounded-2xl bg-black/70 border border-cyan-400/35 backdrop-blur-md">
              <div className="text-sm font-bold tracking-[0.3em] text-cyan-200">
                SPIN
              </div>
            </div>
          )}
          {status === "settled" && resultColor && (
            <div className="px-5 py-2.5 rounded-2xl bg-black/85 border border-white/20 backdrop-blur-md text-center">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                {tr("Result", "Результат")}
              </div>
              <div
                className="text-lg font-black tracking-wide mt-0.5"
                style={{ color: hex(resultColor) }}
              >
                {resultColor.toUpperCase()} ×{ROULETTE_MULT[resultColor]}
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
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 py-1">
          {(state?.history ?? []).map((h) => (
            <div
              key={h.id}
              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/15"
              style={{ background: hex(h.color), boxShadow: `0 0 8px ${glow(h.color)}` }}
            />
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="mx-4 mt-3">
        <input
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          inputMode="decimal"
          placeholder={tr("Bet amount", "Сумма ставки")}
          className="w-full h-12 rounded-2xl bg-white/[0.05] border border-white/10 px-4 text-center text-[16px] tabular-nums outline-none focus:border-cyan-500/40 placeholder:text-white/25"
          disabled={status !== "betting"}
        />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {(
            [
              ["Clear", () => setAmt(0)],
              ["Last", () => setAmt(lastAmount)],
              ["+0.1", () => setAmt(amount + 0.1)],
              ["+1", () => setAmt(amount + 1)],
              ["+10", () => setAmt(amount + 10)],
              ["½", () => setAmt(amount / 2)],
              ["×2", () => setAmt(Math.min(ROULETTE_MAX_BET, amount * 2 || 1))],
              ["Max", () => setAmt(Math.min(ROULETTE_MAX_BET, balance))],
            ] as const
          ).map(([label, fn]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                haptic("light");
                fn();
              }}
              disabled={status !== "betting"}
              className="h-9 rounded-xl bg-white/[0.05] border border-white/10 text-[12px] font-medium text-white/70 active:scale-95 disabled:opacity-40"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="mx-4 mt-3 grid grid-cols-3 gap-2.5">
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
            className="relative overflow-hidden rounded-[20px] border border-white/15 p-3.5 text-left active:scale-[0.97] transition disabled:opacity-45"
            style={{ background: grad(btn.c) }}
          >
            <div className="absolute inset-0 bg-black/25" />
            <div className="relative">
              <div className="text-[13px] font-black tracking-wide text-white">
                {btn.label}{" "}
                <span className="text-white/70">×{btn.mult}</span>
              </div>
              <div className="mt-1.5 text-[10px] text-white/55">
                {tr("Pool", "Банк")} {formatGram(pools[btn.c])}
              </div>
              <div className="text-[10px] text-cyan-100/90">
                {tr("You", "Вы")} {formatGram(myBets[btn.c])}
              </div>
            </div>
          </button>
        ))}
      </div>

      {status === "settled" && state?.round.serverSeed && (
        <div className="mx-4 mt-3 text-[9px] text-white/25 font-mono break-all leading-relaxed">
          seed {state.round.serverSeed}
        </div>
      )}
    </div>
  );
}

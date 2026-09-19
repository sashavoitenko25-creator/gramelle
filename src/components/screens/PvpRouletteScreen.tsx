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
  PVP_ROULETTE_RESULT_MS,
  PVP_ROULETTE_MIN_PLAYERS,
} from "@/lib/pvpRouletteConstants";
import {
  fetchPvpRouletteState,
  fetchPvpRouletteHistory,
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
/** Units in one weighted cycle (higher = finer %) */
const WEIGHT_UNITS = 40;
const SPIN_MIN_LOOPS = 3;

/** Strong ease-out: long cruise, very slow final stop */
function easeOutSpin(t: number) {
  if (t >= 1) return 1;
  // quintic ease-out → heavy deceleration at the end
  return 1 - Math.pow(1 - t, 5);
}

/** Deterministic PRNG from string */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build weighted strip: more slots ≈ higher win chance.
 * Slots shuffled randomly (seeded) so 50/50 is not A-B-A-B.
 */
function buildWeightedCycle(
  bets: PvpRouletteBetPublic[],
  seedKey: string
): PvpRouletteBetPublic[] {
  if (!bets.length) return [];
  const total = bets.reduce((s, b) => s + b.amount, 0) || 1;
  const slots: PvpRouletteBetPublic[] = [];
  // Assign at least 1 slot each, rest by share of WEIGHT_UNITS
  const raw = bets.map((b) => ({
    bet: b,
    share: Math.max(1, Math.round((b.amount / total) * WEIGHT_UNITS)),
  }));
  let sum = raw.reduce((s, x) => s + x.share, 0);
  // Normalize to ~WEIGHT_UNITS
  while (sum > WEIGHT_UNITS + bets.length && sum > bets.length) {
    const max = raw.reduce((a, b) => (a.share >= b.share ? a : b));
    if (max.share <= 1) break;
    max.share -= 1;
    sum -= 1;
  }
  for (const x of raw) {
    for (let i = 0; i < x.share; i++) slots.push(x.bet);
  }
  const rnd = mulberry32(hashSeed(seedKey));
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = slots[i];
    slots[i] = slots[j];
    slots[j] = tmp;
  }
  return slots;
}

function buildStrip(
  bets: PvpRouletteBetPublic[],
  seedKey: string,
  loops: number
): PvpRouletteBetPublic[] {
  const cycle = buildWeightedCycle(bets, seedKey);
  if (!cycle.length) return [];
  const out: PvpRouletteBetPublic[] = [];
  for (let r = 0; r < loops; r++) {
    for (const b of cycle) out.push(b);
  }
  return out;
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
  /** Client timeline: play → spinning → result → play (ignores server jumps mid-flow) */
  const [uiPhase, setUiPhase] = useState<"play" | "spinning" | "result">("play");
  const [showWinner, setShowWinner] = useState(false);
  const [winnerSnap, setWinnerSnap] = useState<{
    username: string;
    avatarUrl: string | null;
    amount: number;
    bank: number;
    won: boolean;
    telegramId?: number | null;
  } | null>(null);
  const winnerHoldUntil = useRef(0);
  const [seedSnap, setSeedSnap] = useState("");
  const seedHoldUntil = useRef(0);
  /** Frozen strip/bets for entire spin+result so poll cannot wipe UI */
  const [frozenStrip, setFrozenStrip] = useState<PvpRouletteBetPublic[]>([]);
  const [frozenBets, setFrozenBets] = useState<PvpRouletteBetPublic[]>([]);
  const [frozenBank, setFrozenBank] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [histItems, setHistItems] = useState<
    NonNullable<PvpRouletteStateResponse["history"]>
  >([]);
  const [histDetail, setHistDetail] = useState<
    NonNullable<PvpRouletteStateResponse["history"]>[number] | null
  >(null);

  const offsetRef = useRef(0);
  const wheelXRef = useRef(0);
  const spinRaf = useRef<number | null>(null);
  const spunForRound = useRef<string | null>(null);
  const spinDoneRef = useRef(false);
  const lastResultId = useRef("");
  const pendingResultRef = useRef<{
    id: string;
    username: string;
    avatarUrl: string | null;
    amount: number;
    bank: number;
    won: boolean;
    seed: string;
    telegramId: number | null;
  } | null>(null);
  const balanceRef = useRef(balance);
  const betLock = useRef(false);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    if (showHistory) {
      if (histDetail) {
        setBackButton(() => setHistDetail(null));
      } else {
        setBackButton(() => {
          setShowHistory(false);
          setHistDetail(null);
        });
      }
    } else {
      setBackButton(() => onBack());
    }
    return () => setBackButton(null);
  }, [onBack, setBackButton, showHistory, histDetail]);

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

  const revealPendingResult = useCallback(
    (hadStake: boolean) => {
      const p = pendingResultRef.current;
      if (!p || lastResultId.current === p.id) return;
      if (!spinDoneRef.current) return;
      lastResultId.current = p.id;
      pendingResultRef.current = null;
      setWinnerSnap({
        username: p.username,
        avatarUrl: p.avatarUrl,
        amount: p.amount,
        bank: p.bank,
        won: p.won,
        telegramId: p.telegramId,
      });
      setShowWinner(true);
      setUiPhase("result");
      winnerHoldUntil.current = Date.now() + 5000;
      if (p.seed) {
        setSeedSnap(p.seed);
        seedHoldUntil.current = Date.now() + 5000;
      }
      if (p.won) {
        playWinSound();
        hapticSuccess();
      } else if (hadStake) {
        playLoseSound();
        hapticError();
      }
    },
    [hapticSuccess, hapticError]
  );

  /* Start spin once per round — do NOT cancel RAF when server goes finished */
  useEffect(() => {
    if (!round || status !== "spinning" || !bets.length) return;
    if (spunForRound.current === round.id) return;
    spunForRound.current = round.id;
    spinDoneRef.current = false;
    setUiPhase("spinning");

    const seedKey = `${round.id}:${round.serverSeedHash || ""}`;
    const stripBuilt = buildStrip(bets, seedKey, 10);
    setFrozenStrip(stripBuilt);
    setFrozenBets(bets);
    setFrozenBank(
      bets.reduce((s, b) => s + b.amount, 0) || Number(round.totalBank) || 0
    );

    const cycle = buildWeightedCycle(bets, seedKey);
    const period = STRIDE * Math.max(1, cycle.length);
    const decoySlot =
      cycle.length > 0 ? hashSeed(seedKey + ":spin") % cycle.length : 0;
    const loops = SPIN_MIN_LOOPS + 2;
    let dest = decoySlot * STRIDE + loops * period;
    const startX = wheelXRef.current;
    while (dest - startX < period * 4) dest += period;

    let dur = PVP_ROULETTE_SPIN_MS;
    if (round.spinEndsAt) {
      const left =
        new Date(round.spinEndsAt).getTime() - (Date.now() + offsetRef.current);
      dur = Math.max(12000, Math.min(PVP_ROULETTE_SPIN_MS, left - 80));
    }

    resumeAudio();
    playSpinSound();
    startWheelSound(dur);
    haptic("medium");

    if (spinRaf.current) cancelAnimationFrame(spinRaf.current);
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      writeX(startX + (dest - startX) * easeOutSpin(p));
      if (p < 1) {
        spinRaf.current = requestAnimationFrame(step);
      } else {
        writeX(dest);
        spinRaf.current = null;
        stopWheelSound();
        spinDoneRef.current = true;
        hapticSuccess();
        revealPendingResult(myBet > 0);
      }
    };
    spinRaf.current = requestAnimationFrame(step);
    // no cleanup — must not kill spin when status becomes finished
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, roundId, bets.length]);

  /* Server finished → queue result until spin has stopped */
  useEffect(() => {
    if (status !== "finished" || !round?.id) return;
    if (lastResultId.current === round.id) return;

    const wBet =
      (typeof round.resultIndex === "number"
        ? (frozenBets.length ? frozenBets : bets)[round.resultIndex]
        : undefined) ||
      (frozenBets.length ? frozenBets : bets).find(
        (b) => Number(b.telegramId) === Number(round.winnerTelegramId)
      );
    const won = Number(round.winnerTelegramId) === Number(telegramId);
    pendingResultRef.current = {
      id: round.id,
      username: wBet?.username || "—",
      avatarUrl: wBet?.avatarUrl ?? null,
      amount: Number(round.winnerAmount) || 0,
      bank: Number(round.totalBank) || frozenBank || 0,
      won,
      seed: round.serverSeed || "",
      telegramId:
        round.winnerTelegramId != null
          ? Number(round.winnerTelegramId)
          : wBet
            ? Number(wBet.telegramId)
            : null,
    };

    // Late join / spin already finished: reveal immediately
    if (spinDoneRef.current || uiPhase !== "spinning") {
      if (!spinDoneRef.current) spinDoneRef.current = true;
      revealPendingResult(myBet > 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    round?.id,
    round?.winnerTelegramId,
    round?.resultIndex,
    round?.winnerAmount,
    round?.totalBank,
    round?.serverSeed,
    telegramId,
    myBet,
  ]);

  /* Auto-hide result after 5s → only then unlock new-round UI */
  useEffect(() => {
    if (!showWinner || uiPhase !== "result" || winnerHoldUntil.current <= 0)
      return;
    const left = Math.max(50, winnerHoldUntil.current - Date.now());
    const id = setTimeout(() => {
      setShowWinner(false);
      setWinnerSnap(null);
      winnerHoldUntil.current = 0;
      setUiPhase("play");
      setFrozenStrip([]);
      setFrozenBets([]);
      setFrozenBank(0);
      spinDoneRef.current = false;
      // reset wheel only after result ends
      writeX(0);
      spunForRound.current = null;
    }, left);
    return () => clearTimeout(id);
  }, [showWinner, uiPhase, winnerSnap, writeX]);

  useEffect(() => {
    if (!seedSnap) return;
    const left = Math.max(50, seedHoldUntil.current - Date.now());
    const id = setTimeout(() => setSeedSnap(""), left);
    return () => clearTimeout(id);
  }, [seedSnap]);

  /* Never reset wheel while spinning/result — server may already be on next waiting */
  useEffect(() => {
    if (uiPhase === "spinning" || uiPhase === "result") return;
    if (status === "betting" || status === "waiting") {
      if (spunForRound.current && spunForRound.current !== roundId) {
        spunForRound.current = null;
      }
    }
  }, [status, roundId, uiPhase]);

  const stripSeed = `${round?.id || "x"}:${round?.serverSeedHash || ""}`;
  const strip = useMemo(() => {
    if (uiPhase === "spinning" || uiPhase === "result") {
      return frozenStrip.length
        ? frozenStrip
        : bets.length
          ? buildStrip(bets, stripSeed, 10)
          : [];
    }
    if (!bets.length) return [] as PvpRouletteBetPublic[];
    return bets;
  }, [uiPhase, frozenStrip, bets, stripSeed]);

  const viewBets =
    uiPhase === "spinning" || uiPhase === "result"
      ? frozenBets.length
        ? frozenBets
        : bets
      : bets;
  const viewBank =
    uiPhase === "result"
      ? winnerSnap?.bank || frozenBank || totalBank
      : uiPhase === "spinning"
        ? frozenBank || totalBank
        : totalBank;
  const isSpinPhase = uiPhase === "spinning" || uiPhase === "result";

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

  const openHistory = async () => {
    setShowHistory(true);
    setHistDetail(null);
    playClickSound();
    haptic("light");
    setHistLoading(true);
    try {
      const res = await fetchPvpRouletteHistory(30);
      setHistItems(res.history || state?.history || []);
    } catch {
      setHistItems(state?.history || []);
    } finally {
      setHistLoading(false);
    }
  };

  const canBet =
    uiPhase === "play" &&
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
    seedSnap ||
    ((status === "finished" || status === "cancelled") && round?.serverSeed
      ? round.serverSeed
      : "");

  return (
    <div className="flex flex-col min-h-[100dvh] pb-32 safe-top">
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

      {/* Bank — glass pill */}
      <div className="mx-4 mt-3 flex justify-center">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 min-w-[200px] text-center shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(251,191,36,0.1),transparent_60%)] pointer-events-none" />
          <div className="relative">
            <div className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-semibold">
              {tr("Bank", "Банк")}
            </div>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="text-[26px] font-black tabular-nums tracking-tight text-white leading-none">
                {formatGram(viewBank)}
              </span>
              <span className="text-[12px] font-semibold text-amber-200/50">GRAM</span>
            </div>

          </div>
        </div>
      </div>
      {uiPhase === "play" && status === "waiting" && bets.length > 0 && (
        <div className="mx-4 mt-2 flex justify-center">
          <div className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.1] text-[11px] font-medium text-white/55">
            {tr("Waiting for players", "Ждём игроков")}
          </div>
        </div>
      )}

      {/* WHEEL */}
      <div className="mx-3 mt-3 relative rounded-[28px] overflow-hidden border border-white/[0.1] bg-[#070b18] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(251,191,36,0.1),transparent_55%)] pointer-events-none" />

        {/* Pointers fixed to frame edge — amber like bank / history */}
        <div className="absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-[1px] pointer-events-none">
          <div className="w-0 h-0 border-l-[9px] border-r-[9px] border-t-[11px] border-l-transparent border-r-transparent border-t-amber-300 drop-shadow-[0_2px_10px_rgba(251,191,36,0.9)]" />
        </div>
        <div className="absolute left-1/2 bottom-0 z-30 -translate-x-1/2 translate-y-[1px] rotate-180 pointer-events-none">
          <div className="w-0 h-0 border-l-[9px] border-r-[9px] border-t-[11px] border-l-transparent border-r-transparent border-t-amber-300 drop-shadow-[0_2px_10px_rgba(251,191,36,0.9)]" />
        </div>
        <div className="absolute left-1/2 top-0 bottom-0 w-px z-20 bg-gradient-to-b from-amber-300/55 via-amber-300/25 to-amber-300/55 pointer-events-none" />

        <div className="relative h-[120px] overflow-hidden">
          {strip.length === 0 ? (
            <div className="absolute inset-0" aria-hidden />
          ) : isSpinPhase ? (
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
          ) : (
            /* Waiting / betting: unique avatars centered, no clones */
            <div className="absolute inset-0 flex items-center justify-center gap-2.5 px-4">
              {strip.map((b) => (
                <div key={b.id} className="flex items-center justify-center shrink-0">
                  <Avatar
                    url={b.avatarUrl}
                    name={b.username}
                    size={AVATAR}
                    me={Number(b.telegramId) === Number(telegramId)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overlay: countdown / waiting / result */}
        <div className="absolute inset-0 flex items-center justify-center z-[25] pointer-events-none">
          {showWinner && winnerSnap ? (
            <div
              className="flex items-center gap-3 pl-2 pr-4 py-2 rounded-full border border-amber-400/35 shadow-[0_8px_32px_rgba(251,191,36,0.18),0_4px_16px_rgba(0,0,0,0.5)]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(20,16,8,0.82) 0%, rgba(12,12,18,0.88) 100%)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div className="relative shrink-0">
                <Avatar
                  url={winnerSnap.avatarUrl}
                  name={winnerSnap.username}
                  size={48}
                  highlight
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shadow-[0_0_8px_rgba(251,191,36,0.8)]">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6.5L5 9l4.5-5.5"
                      stroke="#1a1208"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <div className="min-w-0 text-left py-0.5">
                <div className="text-[9px] uppercase tracking-[0.14em] text-amber-200/55 font-semibold leading-none">
                  {winnerSnap.won
                    ? tr("You won", "Победа")
                    : tr("Winner", "Победитель")}
                </div>
                <div className="text-[13px] font-semibold text-white/95 truncate max-w-[120px] mt-0.5 leading-tight">
                  {winnerSnap.username}
                </div>
                <div className="text-[17px] font-black tabular-nums text-amber-300 leading-none mt-0.5">
                  +{formatGram(winnerSnap.amount)}
                </div>
              </div>
            </div>
          ) : status === "betting" ? (
            <div className="px-4 py-2 rounded-2xl bg-black/25 border border-white/10 backdrop-blur-[2px] text-center min-w-[96px] shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {tr("Start", "Старт")}
              </div>
              <div
                className="text-[28px] font-bold tabular-nums text-white leading-none mt-0.5"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.5)" }}
              >
                {remainSec.toFixed(1)}
                <span className="text-[14px] text-white/60 font-semibold ml-0.5">s</span>
              </div>
            </div>
          ) : uiPhase === "play" && status === "waiting" && bets.length === 0 ? (
            <div className="px-5 py-3 rounded-2xl bg-black/75 border border-white/12 backdrop-blur-md text-center shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">
                {tr("Waiting", "Ожидание")}
              </div>
              <div className="text-[14px] font-semibold text-white/85 mt-1">
                {tr("Place a bet to start", "Сделайте ставку")}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* History strip — label opens full history */}
      <div className="mx-4 mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void openHistory()}
          className="shrink-0 text-[10px] text-white/45 uppercase tracking-wider font-semibold active:opacity-70 hover:text-white/70 transition-colors"
        >
          {tr("History", "История")}
        </button>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 py-0.5 items-center min-h-[32px]">
          {(state?.history ?? []).length === 0 ? (
            <span className="text-[11px] text-white/25">—</span>
          ) : (
            (state?.history ?? []).slice(0, 14).map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => void openHistory()}
                className="shrink-0 flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] pl-1 pr-2.5 py-1 active:scale-[0.97] transition"
                title={h.winnerUsername || ""}
              >
                <Avatar
                  url={h.winnerAvatarUrl ?? null}
                  name={h.winnerUsername || "?"}
                  size={22}
                  highlight
                />
                <span className="text-[11px] text-amber-200/80 tabular-nums font-semibold">
                  +{formatGram(h.winnerAmount || 0)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="mx-4 mt-3">
        <input
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          inputMode="decimal"
          placeholder={tr("Amount", "Сумма")}
          disabled={!canBet && status !== "waiting"}
          className="w-full h-11 rounded-2xl bg-white/[0.05] border border-white/10 px-4 text-[15px] font-semibold text-white tabular-nums outline-none focus:border-cyan-400/40 placeholder:text-white/30 disabled:opacity-40"
        />
        {/* Quick amounts */}
        <div className="mt-2 grid grid-cols-4 gap-2">
          {([1, 5, 10, 25] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                haptic("light");
                setAmt(v);
              }}
              disabled={!canBet && status !== "waiting"}
              className={cn(
                "h-10 rounded-xl border text-[14px] font-semibold tabular-nums active:scale-95 disabled:opacity-40 transition-colors",
                amount === v
                  ? "bg-amber-500/20 border-amber-400/40 text-amber-200"
                  : "bg-white/[0.05] border-white/10 text-white/80"
              )}
            >
              {v}
            </button>
          ))}
        </div>
        {/* Actions */}
        <div className="mt-2 grid grid-cols-4 gap-2">
          {(
            [
              [tr("Last", "Прошлая"), () => setAmt(lastAmount || 1)],
              [
                "×2",
                () =>
                  setAmt(
                    Math.min(PVP_ROULETTE_MAX_BET, (amount || lastAmount || 1) * 2)
                  ),
              ],
              [
                "Max",
                () =>
                  setAmt(
                    Math.min(PVP_ROULETTE_MAX_BET, balanceRef.current)
                  ),
              ],
              [tr("Clear", "Сброс"), () => setAmt(0)],
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
              className="h-10 rounded-xl bg-white/[0.05] border border-white/10 text-[12px] font-medium text-white/70 active:scale-95 disabled:opacity-40"
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
          {tr(
            `Bet ${formatGram(amount || lastAmount || PVP_ROULETTE_MIN_BET)}`,
            `Ставка ${formatGram(amount || lastAmount || PVP_ROULETTE_MIN_BET)}`
          )}
        </button>
      </div>

      {/* Players list — frozen during spin/result */}
      {viewBets.length > 0 && (
      <div className="mx-4 mt-4 mb-2">
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
          {tr("Players", "Игроки")} · {viewBets.length}
        </div>
        <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
          {[...viewBets]
            .sort((a, b) => b.amount - a.amount)
            .map((b) => {
              const isWin =
                uiPhase === "result" &&
                winnerSnap?.telegramId != null &&
                Number(b.telegramId) === Number(winnerSnap.telegramId);
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
                          {tr("you", "вы")}
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
      )}

      {/* spacer under BottomNav */}
      <div className="h-4 shrink-0" aria-hidden />


      
      {/* Full history panel — TG back only, no in-UI back */}
      {showHistory && !histDetail && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#06060a] safe-top">
          <div className="px-4 pt-3 pb-3 border-b border-white/[0.06]">
            <div className="text-[18px] font-bold text-white tracking-tight">
              {tr("History", "История")}
            </div>
            <div className="text-[12px] text-white/35 mt-0.5">
              {tr("Tap a round for details", "Нажми на раунд для деталей")}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 pb-28 space-y-2">
            {histLoading && (
              <div className="text-center text-white/40 text-sm py-10 animate-pulse">
                {tr("Loading…", "Загрузка…")}
              </div>
            )}
            {!histLoading && histItems.length === 0 && (
              <div className="text-center text-white/30 text-sm py-10">
                {tr("No games yet", "Игр пока нет")}
              </div>
            )}
            {!histLoading &&
              histItems.map((h) => {
                const iWon =
                  h.winnerTelegramId != null &&
                  Number(h.winnerTelegramId) === Number(telegramId);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setHistDetail(h);
                      playClickSound();
                      haptic("light");
                    }}
                    className={cn(
                      "w-full text-left rounded-[18px] border px-3.5 py-3 transition active:scale-[0.99]",
                      iWon
                        ? "border-amber-400/30 bg-amber-500/[0.08]"
                        : "border-white/[0.07] bg-white/[0.03]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        url={h.winnerAvatarUrl ?? null}
                        name={h.winnerUsername || "?"}
                        size={44}
                        highlight={iWon}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-white truncate">
                            {h.winnerUsername || "—"}
                          </span>
                          {iWon && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90">
                              {tr("You", "Вы")}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/35">
                          {tr("Bank", "Банк")}{" "}
                          <span className="tabular-nums text-white/50">
                            {formatGram(h.totalBank)}
                          </span>
                          {h.players && h.players.length > 0 && (
                            <>
                              <span className="mx-1.5 text-white/20">·</span>
                              <span>
                                {h.players.length}{" "}
                                {tr("players", "игроков")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[15px] font-bold tabular-nums text-amber-300 tracking-tight">
                          +{formatGram(h.winnerAmount || 0)}
                        </div>
                        <div className="text-[10px] text-white/30">GRAM</div>
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* History detail */}
      {showHistory && histDetail && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#06060a] safe-top">
          <div className="px-4 pt-3 pb-3 border-b border-white/[0.06]">
            <div className="text-[18px] font-bold text-white tracking-tight">
              {tr("Round details", "Детали раунда")}
            </div>
            <div className="text-[12px] text-white/35 mt-0.5">
              {histDetail.createdAt
                ? new Date(histDetail.createdAt).toLocaleString(
                    isRu ? "ru-RU" : "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )
                : ""}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-4">
            {/* Winner card */}
            <div className="relative overflow-hidden rounded-[22px] border border-amber-400/25 bg-gradient-to-b from-amber-500/10 to-white/[0.03] p-5 text-center">
              <div className="text-[10px] uppercase tracking-[0.16em] text-amber-200/60 font-semibold mb-3">
                {tr("Winner", "Победитель")}
              </div>
              <div className="flex justify-center mb-3">
                <Avatar
                  url={histDetail.winnerAvatarUrl ?? null}
                  name={histDetail.winnerUsername || "?"}
                  size={72}
                  highlight
                />
              </div>
              <div className="text-[18px] font-bold text-white">
                {histDetail.winnerUsername || "—"}
              </div>
              <div className="mt-2 text-[28px] font-black tabular-nums text-amber-300 tracking-tight">
                +{formatGram(histDetail.winnerAmount || 0)}
              </div>
              <div className="text-[12px] text-white/40 mt-1">
                {tr("Bank", "Банк")} {formatGram(histDetail.totalBank)} GRAM
              </div>
            </div>

            {/* Players */}
            {histDetail.players && histDetail.players.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-2">
                  {tr("Players", "Игроки")} · {histDetail.players.length}
                </div>
                <div className="space-y-1.5">
                  {histDetail.players.map((pl) => {
                    const isW =
                      histDetail.winnerTelegramId != null &&
                      Number(pl.telegramId) ===
                        Number(histDetail.winnerTelegramId);
                    return (
                      <div
                        key={pl.telegramId}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-2.5 py-2 border",
                          isW
                            ? "border-amber-400/30 bg-amber-500/10"
                            : "border-white/[0.06] bg-white/[0.03]"
                        )}
                      >
                        <Avatar
                          url={pl.avatarUrl}
                          name={pl.username}
                          size={32}
                          highlight={isW}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] text-white/85 truncate">
                            {pl.username}
                            {isW && (
                              <span className="ml-1.5 text-[10px] text-amber-300/80">
                                ✓
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-[13px] font-semibold tabular-nums text-white">
                          {formatGram(pl.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fairness */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-2">
                {tr("Fairness", "Честность")}
              </div>
              <div className="space-y-2">
                {histDetail.serverSeedHash && (
                  <button
                    type="button"
                    onClick={() =>
                      void onCopy("Hash", histDetail.serverSeedHash || "")
                    }
                    className="w-full flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-left active:scale-[0.99]"
                  >
                    <span className="text-[10px] text-white/35 uppercase shrink-0">
                      Hash
                    </span>
                    <span className="text-[11px] font-mono text-cyan-200/70 truncate flex-1">
                      {histDetail.serverSeedHash}
                    </span>
                  </button>
                )}
                {histDetail.serverSeed && (
                  <button
                    type="button"
                    onClick={() =>
                      void onCopy("Seed", histDetail.serverSeed || "")
                    }
                    className="w-full flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-left active:scale-[0.99]"
                  >
                    <span className="text-[10px] text-white/35 uppercase shrink-0">
                      Seed
                    </span>
                    <span className="text-[11px] font-mono text-emerald-200/70 truncate flex-1">
                      {histDetail.serverSeed}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

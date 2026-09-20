"use client";

/**
 * Gramelle LIVE Roulette
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
  ROULETTE_MAX_STAKE_PER_ROUND,
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
  type RouletteBettor,
} from "@/lib/rouletteApi";

interface RouletteScreenProps {
  balance: number;
  telegramId: number | null;
  username: string;
  photoUrl?: string | null;
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

/** abcdef12…90abcdef */
function shortMiddle(s: string | null | undefined, head = 8, tail = 8) {
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
  size = 28,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="rounded-full overflow-hidden shrink-0 border border-white/20 bg-white/10 flex items-center justify-center text-[11px] font-bold text-white/80"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        letter
      )}
    </div>
  );
}

export function RouletteScreen({
  balance,
  telegramId,
  username,
  photoUrl = null,
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
  const [amountStr, setAmountStr] = useState("");
  const [lastAmount, setLastAmount] = useState(1);
  const [betting, setBetting] = useState(false);
  const bettingLockRef = useRef(false);
  /** Local balance for spam-safe checks (props lag behind optimistic updates) */
  const balanceRef = useRef(balance);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);
  const pendingBetsRef = useRef<Partial<Record<RouletteColor, number>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paravozOpen, setParavozOpen] = useState(false);

  const [displayMs, setDisplayMs] = useState(() => Date.now());
  const offsetRef = useRef(0);
  const onBalanceUpdateRef = useRef(onBalanceUpdate);
  const telegramIdRef = useRef(telegramId);
  const usernameRef = useRef(username);
  const photoUrlRef = useRef(photoUrl);
  useEffect(() => {
    onBalanceUpdateRef.current = onBalanceUpdate;
  }, [onBalanceUpdate]);
  useEffect(() => {
    telegramIdRef.current = telegramId;
  }, [telegramId]);
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);
  useEffect(() => {
    photoUrlRef.current = photoUrl;
  }, [photoUrl]);

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

  useEffect(() => {
    let id = 0;
    const tick = () => {
      setDisplayMs(Date.now() + offsetRef.current);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const mergeState = useCallback(
    (data: RouletteStateResponse | Record<string, unknown>) => {
      const raw = data as Record<string, unknown>;
      let flat = (
        raw.round
          ? raw
          : raw.state && typeof raw.state === "object"
            ? raw.state
            : null
      ) as RouletteStateResponse | null;

      if (!flat || !flat.round) {
        console.error("[roulette] bad state payload", data);
        return;
      }

      if (typeof flat.serverMs === "number") {
        offsetRef.current = flat.serverMs - Date.now();
      } else if (flat.serverNow) {
        offsetRef.current = new Date(flat.serverNow).getTime() - Date.now();
      }

      // Hold optimistic myBets until server catches up — prevents flash
      const pending = pendingBetsRef.current;
      const pools = { ...(flat.pools || { red: 0, black: 0, green: 0 }) };
      const myBets = { ...(flat.myBets || { red: 0, black: 0, green: 0 }) };
      let changed = false;
      for (const c of ["red", "black", "green"] as RouletteColor[]) {
        const want = pending[c] || 0;
        if (want <= 0) continue;
        const serverMine = myBets[c] || 0;
        if (serverMine + 1e-9 >= want) {
          pending[c] = 0;
        } else {
          const extra = want - serverMine;
          myBets[c] = +want.toFixed(6);
          pools[c] = +((pools[c] || 0) + extra).toFixed(6);
          changed = true;
        }
      }
      pendingBetsRef.current = pending;

      if (changed) {
        const tid = telegramIdRef.current;
        const betsByColor = {
          red: [...(flat.betsByColor?.red || [])],
          black: [...(flat.betsByColor?.black || [])],
          green: [...(flat.betsByColor?.green || [])],
        };
        if (tid) {
          for (const c of ["red", "black", "green"] as RouletteColor[]) {
            const want = myBets[c] || 0;
            if (want <= 0) continue;
            const list = betsByColor[c];
            const idx = list.findIndex((b) => b.telegramId === tid);
            if (idx >= 0) {
              list[idx] = {
                ...list[idx],
                amount: want,
                username:
                  list[idx].username || usernameRef.current || "Player",
                photoUrl:
                  list[idx].photoUrl || photoUrlRef.current || null,
              };
            } else {
              list.unshift({
                telegramId: tid,
                username: usernameRef.current || "Player",
                photoUrl: photoUrlRef.current || null,
                amount: want,
              });
            }
            list.sort((a, b) => b.amount - a.amount);
            betsByColor[c] = list.slice(0, 12);
          }
        }
        flat = {
          ...flat,
          pools,
          myBets,
          myTotal: +(myBets.red + myBets.black + myBets.green).toFixed(6),
          betsByColor,
        };
      }

      setState(flat);
      setLoadError(null);
      statusRef.current = flat.round.status;
      const bal = (flat as { balance?: number | null }).balance;
      if (typeof bal === "number" && Number.isFinite(bal)) {
        onBalanceUpdateRef.current(bal);
      }
    },
    []
  );

  const load = useCallback(async () => {
    try {
      // presence=1 — count this client as online in LIVE Roulette
      const data = await fetchRouletteState({ presence: true });
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

  // Always use canonical wheel — never empty strip
  const strip = useMemo(() => {
    // Always paint full wheel — never allow empty strip (was causing blank roulette)
    const base = ROULETTE_WHEEL;
    const out: RouletteColor[] = [];
    for (let i = 0; i < STRIP_COPIES; i++) {
      for (let j = 0; j < base.length; j++) out.push(base[j]);
    }
    return out.length > 0 ? out : [...ROULETTE_WHEEL];
  }, []);

  const targetX = useCallback((slot: number, loops: number) => {
    const idx = loops * ROULETTE_SLOT_COUNT + (slot % ROULETTE_SLOT_COUNT);
    return idx * STRIDE;
  }, []);

  // Idle crawl
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
    const period = STRIDE * ROULETTE_SLOT_COUNT;
    const step = (t: number) => {
      if (!alive) return;
      if (statusRef.current !== "betting") return;
      // Keep wheelX within one period so strip never drifts into empty space
      const raw = origin + ((t - t0) / 1000) * 22;
      writeX(((raw % period) + period) % period);
      idleRaf.current = requestAnimationFrame(step);
    };
    idleRaf.current = requestAnimationFrame(step);
    return () => {
      alive = false;
      if (idleRaf.current) cancelAnimationFrame(idleRaf.current);
    };
  }, [status, roundId]);

  // Spin once per round — do not cancel mid-animation on re-render/poll
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
    if (spinRaf.current) {
      cancelAnimationFrame(spinRaf.current);
      spinRaf.current = null;
    }

    const slot = r.resultSlot;
    const startX = wheelXRef.current;
    let dest = targetX(slot, SPIN_MIN_LOOPS);
    const minTravel = STRIDE * ROULETTE_SLOT_COUNT * 4;
    while (dest - startX < minTravel) dest += STRIDE * ROULETTE_SLOT_COUNT;

    let dur = ROULETTE_SPIN_MS;
    if (r.spinEndsAt) {
      const left =
        new Date(r.spinEndsAt).getTime() - (Date.now() + offsetRef.current);
      if (left > 0 && left < ROULETTE_SPIN_MS) {
        dur = Math.max(1800, left - 50);
      }
    }

    const t0 = performance.now();
    const roundIdAtStart = r.id;
    haptic("medium");

    const step = (now: number) => {
      if (spunForRound.current !== roundIdAtStart) {
        spinRaf.current = null;
        return;
      }
      const p = Math.min(1, (now - t0) / dur);
      const e = easeOutExpo(p);
      writeX(startX + (dest - startX) * e);
      if (p < 1) {
        spinRaf.current = requestAnimationFrame(step);
      } else {
        writeX(dest);
        spinRaf.current = null;
        hapticSuccess();
      }
    };
    spinRaf.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.round.id, state?.round.status, state?.round.resultSlot]);

  // When result is shown: freeze on the winning slot (no extra spin)
  useEffect(() => {
    const slot = state?.round.resultSlot;
    if (status !== "settled" || slot == null || !roundId) return;
    if (idleRaf.current) {
      cancelAnimationFrame(idleRaf.current);
      idleRaf.current = null;
    }
    if (spunForRound.current !== roundId) {
      const slotPos =
        ((slot % ROULETTE_SLOT_COUNT) + ROULETTE_SLOT_COUNT) %
        ROULETTE_SLOT_COUNT;
      writeX(slotPos * STRIDE);
      spunForRound.current = roundId ?? null;
    }
  }, [status, state?.round.resultSlot, roundId]);

  useEffect(() => {
    if (status === "betting" && roundId) {
      if (spunForRound.current && spunForRound.current !== roundId) {
        spunForRound.current = null;
      }
      pendingBetsRef.current = {};
      const period = STRIDE * ROULETTE_SLOT_COUNT;
      const x = wheelXRef.current;
      const snapped = ((x % period) + period) % period;
      if (Math.abs(x - snapped) > 1) writeX(snapped);
    }
  }, [status, roundId]);

  useEffect(() => {
    return () => {
      if (spinRaf.current) cancelAnimationFrame(spinRaf.current);
      if (idleRaf.current) cancelAnimationFrame(idleRaf.current);
    };
  }, []);

  const amount = (() => {
    if (!amountStr.trim()) return 0;
    const n = parseFloat(amountStr.replace(",", "."));
    return Number.isFinite(n) ? +n.toFixed(4) : 0;
  })();

  const setAmt = (n: number) => {
    if (n <= 0) setAmountStr("");
    else setAmountStr(String(+n.toFixed(4)));
  };

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
    // Block spam-clicks FIRST (sync) — before any balance math
    if (bettingLockRef.current) return;

    // Use local ref — parent `balance` prop lags behind optimistic updates
    if (amount > balanceRef.current + 1e-9) {
      showToast(tr("Insufficient balance", "Недостаточно средств"));
      hapticError();
      return;
    }

    const abs = (c: RouletteColor) =>
      Math.max(
        Number(pendingBetsRef.current[c] || 0),
        Number(state?.myBets?.[c] || 0)
      );
    const nextColorTotal = abs(color) + amount;
    const projected =
      abs("red") +
      abs("black") +
      abs("green") -
      abs(color) +
      nextColorTotal;
    if (projected > ROULETTE_MAX_STAKE_PER_ROUND + 1e-9) {
      showToast(
        tr(
          `Max ${ROULETTE_MAX_STAKE_PER_ROUND} GRAM per round`,
          `Макс. ${ROULETTE_MAX_STAKE_PER_ROUND} GRAM за раунд`
        )
      );
      hapticError();
      return;
    }
    bettingLockRef.current = true;
    // Optimistic: pending tracks desired myBets so polls cannot wipe the row
    const prevBal = balanceRef.current;
    balanceRef.current = +(prevBal - amount).toFixed(4);
    const myName = (username || "").trim() || "Player";
    let myPhoto: string | null = photoUrl || null;
    if (state?.betsByColor) {
      for (const col of ["red", "black", "green"] as const) {
        const hit = state.betsByColor[col]?.find(
          (b) => b.telegramId === telegramId
        );
        if (hit?.photoUrl) {
          myPhoto = hit.photoUrl;
          break;
        }
      }
    }

    const prevMine = state?.myBets?.[color] || 0;
    const nextMine = +(prevMine + amount).toFixed(6);
    pendingBetsRef.current = {
      ...pendingBetsRef.current,
      [color]: Math.max(pendingBetsRef.current[color] || 0, nextMine),
    };

    onBalanceUpdate(balanceRef.current);
    setLastAmount(amount);
    setState((prev) => {
      if (!prev) return prev;
      const pools = {
        ...prev.pools,
        [color]: +((prev.pools[color] || 0) + amount).toFixed(6),
      };
      const myBets = {
        ...prev.myBets,
        [color]: nextMine,
      };
      const list = [...(prev.betsByColor?.[color] || [])];
      const idx = list.findIndex((b) => b.telegramId === telegramId);
      if (idx >= 0) {
        const cur = list[idx];
        list[idx] = {
          ...cur,
          username: cur.username || myName,
          photoUrl: cur.photoUrl || myPhoto,
          amount: nextMine,
        };
      } else if (telegramId) {
        list.unshift({
          telegramId,
          username: myName,
          photoUrl: myPhoto,
          amount: nextMine,
        });
      }
      list.sort((a, b) => b.amount - a.amount);
      return {
        ...prev,
        pools,
        myBets,
        myTotal: +(myBets.red + myBets.black + myBets.green).toFixed(6),
        betsByColor: {
          red: prev.betsByColor?.red || [],
          black: prev.betsByColor?.black || [],
          green: prev.betsByColor?.green || [],
          [color]: list.slice(0, 12),
        },
      };
    });
    haptic("light");
    hapticSuccess();

    setBetting(true);
    try {
      const res = await placeRouletteBetApi(color, amount);
      if (typeof res.balance === "number") {
        balanceRef.current = res.balance;
        onBalanceUpdate(res.balance);
      }
      mergeState(res);
    } catch (e) {
      // roll back pending for this color toward server
      pendingBetsRef.current = {
        ...pendingBetsRef.current,
        [color]: prevMine,
      };
      balanceRef.current = prevBal;
      onBalanceUpdate(prevBal);
      showToast(e instanceof Error ? e.message : "Error");
      hapticError();
      try {
        await load();
      } catch {
        /* */
      }
    } finally {
      bettingLockRef.current = false;
      setBetting(false);
    }
  };

  const onCopy = async (label: string, full: string) => {
    const ok = await copyText(full);
    if (ok) {
      haptic("light");
      showToast(tr(`${label} copied`, `${label} скопирован`));
    }
  };

  const pools = state?.pools ?? { red: 0, black: 0, green: 0 };
  const myBets = state?.myBets ?? { red: 0, black: 0, green: 0 };
  const betsByColor = state?.betsByColor ?? {
    red: [] as RouletteBettor[],
    black: [] as RouletteBettor[],
    green: [] as RouletteBettor[],
  };
  const resultColor = state?.round.resultColor;
  const resultSlot = state?.round.resultSlot;
  const hashFull = state?.round.serverSeedHash || "";
  // Seed only during result phase (settled), not during spin
  const seedFull =
    status === "settled" && state?.round.serverSeed
      ? state.round.serverSeed
      : "";

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {/* Header — balance like Dice/PVP */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
            <span>LIVE Roulette</span>
            {state?.round?.gameNo != null && (
              <span className="text-[12px] font-mono text-white/35 font-normal">
                #{state.round.gameNo}
              </span>
            )}
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
                onDeposit();
              }}
              className="h-full px-2.5 flex items-center justify-center text-cyan-200/90 hover:text-cyan-100 hover:bg-cyan-400/15 border-l border-white/[0.1] transition-colors btn-press"
              aria-label="Deposit"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      </div>


      {/* Paravoz — 10-in-a-row streak */}
      {(() => {
        const pz = state?.paravoz;
        const streak = pz?.streak ?? 0;
        const target = pz?.target ?? 10;
        const colors = pz?.colors ?? [];
        const bonus = pz?.bonusGram ?? 10;
        const cells = Array.from({ length: target }, (_, i) => colors[i] ?? null);
        return (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setParavozOpen(true);
            }}
            className="mx-4 mt-2 mb-1 w-[calc(100%-2rem)] text-left rounded-2xl overflow-hidden border border-amber-400/25 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-violet-500/15 btn-press shadow-[0_0_24px_rgba(251,191,36,0.12)]"
          >
            <div className="px-3.5 py-2.5 flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-lg">
                🚂
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-amber-100 tracking-tight">
                    {tr("Paravoz", "Паравоз")}
                  </span>
                  <span className="text-[12px] font-black tabular-nums text-amber-200">
                    {streak}/{target}
                  </span>
                </div>
                <div className="mt-1.5 flex gap-1">
                  {cells.map((c, i) => (
                    <div
                      key={i}
                      className="h-2.5 flex-1 rounded-full border border-white/10"
                      style={{
                        background: c
                          ? c === "red"
                            ? "#e11d48"
                            : c === "black"
                              ? "#334155"
                              : "#10b981"
                          : "rgba(255,255,255,0.06)",
                        boxShadow: c ? "0 0 6px rgba(251,191,36,0.25)" : undefined,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1 text-[10px] text-white/40">
                  {tr(
                    `${target} in a row → ${bonus} GRAM`,
                    `${target} подряд → ${bonus} GRAM`
                  )}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30 shrink-0">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        );
      })()}

      {/* Hash + Seed (seed after reveal) — tap to copy, no copy label */}
      <div className="mx-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => hashFull && void onCopy("Hash", hashFull)}
          className="flex-1 min-w-0 flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-left active:scale-[0.99]"
        >
          <span className="text-[9px] text-white/35 uppercase tracking-wider shrink-0">
            Hash
          </span>
          <span className="text-[10px] font-mono text-white/55 truncate">
            {shortMiddle(hashFull, 6, 4)}
          </span>
        </button>
        {seedFull ? (
          <button
            type="button"
            onClick={() => void onCopy("Seed", seedFull)}
            className="flex-1 min-w-0 flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-left active:scale-[0.99]"
          >
            <span className="text-[9px] text-white/35 uppercase tracking-wider shrink-0">
              Seed
            </span>
            <span className="text-[10px] font-mono text-white/55 truncate">
              {shortMiddle(seedFull, 6, 4)}
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

      {loadError && (
        <div className="mx-4 mt-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          {loadError}
          <button
            type="button"
            className="underline ml-2"
            onClick={() => void load()}
          >
            retry
          </button>
        </div>
      )}

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
                    highlight
                      ? "border-cyan-200/90 scale-[1.06]"
                      : "border-white/12"
                  )}
                  style={{
                    width: SLOT_W,
                    height: SLOT_W,
                    background: grad(c),
                    boxShadow: highlight
                      ? `0 0 32px ${glow(c)}, inset 0 1px 0 rgba(255,255,255,0.2)`
                      : "inset 0 1px 0 rgba(255,255,255,0.1)",
                    transition:
                      "box-shadow 0.25s ease, transform 0.25s ease",
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

        <div className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none">
          {status === "betting" && (
            <div className="px-5 py-2.5 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md text-center min-w-[108px]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                {tr("Start", "Старт")}
              </div>
              <div className="text-[30px] font-bold tabular-nums text-white leading-none mt-0.5">
                {remainSec.toFixed(1)}
                <span className="text-[15px] text-white/40 font-semibold ml-0.5">
                  s
                </span>
              </div>
            </div>
          )}
          {/* spinning: no overlay label — only Start / Result */}
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


      {paravozOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setParavozOpen(false)}
        >
          <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 slide-up border-t border-white/10 safe-bottom max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🚂</span>
              <h3 className="text-lg font-bold">{tr("Paravoz", "Паравоз")}</h3>
            </div>
            <p className="text-[13px] text-white/55 leading-relaxed mb-4">
              {tr(
                "Guess the color correctly several times in a row. Fill the train — at 10 wins you get a bonus. A miss resets the streak. Going past 10 keeps counting (12/10, 15/10…) but the bonus is awarded at 10.",
                "Угадывай цвет подряд. Заполни «паравоз» — на 10 победах подряд бонус. Ошибка сбрасывает серию. Больше 10 тоже считается (12/10, 15/10…), бонус начисляется при достижении 10."
              )}
            </p>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3.5 py-3 mb-4 flex items-center justify-between">
              <span className="text-xs text-white/50">{tr("Bonus", "Бонус")}</span>
              <span className="text-base font-black text-amber-200 tabular-nums">
                {state?.paravoz?.bonusGram ?? 10} GRAM
              </span>
            </div>
            <div className="text-[11px] uppercase tracking-wider text-white/35 mb-2">
              {tr("Winners", "Победители")}
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {(state?.paravozWinners?.length
                ? state.paravozWinners
                : []
              ).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-white/90 truncate">
                      {w.username.startsWith("@") ? w.username : `@${w.username}`}
                    </div>
                    <div className="flex gap-0.5 mt-1">
                      {(w.colors || []).slice(0, 10).map((c, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{
                            background:
                              c === "red"
                                ? "#e11d48"
                                : c === "black"
                                  ? "#64748b"
                                  : "#10b981",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12px] font-bold text-amber-300 tabular-nums">
                      +{w.bonusGram} GRAM
                    </div>
                    <div className="text-[10px] text-white/30">{w.streak}/10</div>
                  </div>
                </div>
              ))}
              {!(state?.paravozWinners?.length) && (
                <div className="text-[12px] text-white/35 text-center py-4">
                  {tr("No winners yet — be the first", "Пока никого — стань первым")}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setParavozOpen(false)}
              className="mt-4 w-full h-11 rounded-xl btn-primary text-sm font-semibold btn-press"
            >
              {tr("Got it", "Понятно")}
            </button>
          </div>
        </div>
      )}

      {/* History colors only — no numbers */}
      <div className="mx-4 mt-3 flex items-center gap-2">
        <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">
          {tr("Last", "История")}
        </span>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 py-1">
          {(state?.history ?? []).map((h) => (
            <div
              key={h.id}
              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/15"
              style={{
                background: hex(h.color),
                boxShadow: `0 0 8px ${glow(h.color)}`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Amount — empty by default */}
      <div className="mx-4 mt-3">
        <input
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          inputMode="decimal"
          placeholder={tr("Bet amount", "Сумма ставки")}
          className="w-full h-12 rounded-2xl bg-white/[0.05] border border-white/10 px-4 text-center text-[16px] tabular-nums outline-none focus:border-cyan-500/40 placeholder:text-white/25"
          disabled={status !== "betting" || betting}
        />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {(
            [
              [tr("Clear", "Сброс"), () => setAmt(0)],
              [tr("Last", "Прошлая"), () => setAmt(lastAmount)],
              ["+0.1", () => setAmt((amount || 0) + 0.1)],
              ["+1", () => setAmt((amount || 0) + 1)],
              ["+10", () => setAmt((amount || 0) + 10)],
              ["½", () => setAmt(amount / 2)],
              [
                "×2",
                () =>
                  setAmt(Math.min(ROULETTE_MAX_BET, (amount || 1) * 2)),
              ],
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
              disabled={status !== "betting" || betting}
              className="h-9 rounded-xl bg-white/[0.05] border border-white/10 text-[12px] font-medium text-white/70 active:scale-95 disabled:opacity-40"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Color buttons + bettors under each */}
      <div className="mx-4 mt-3 grid grid-cols-3 gap-2.5">
        {(
          [
            { c: "red" as const, label: tr("RED", "КРАСНОЕ"), mult: 2 },
            { c: "green" as const, label: tr("GREEN", "ЗЕЛЁНОЕ"), mult: 14 },
            { c: "black" as const, label: tr("BLACK", "ЧЁРНОЕ"), mult: 2 },
          ] as const
        ).map((btn) => (
          <div key={btn.c} className="flex flex-col min-w-0">
            <button
              type="button"
              disabled={status !== "betting" || betting}
              onClick={() => void onBet(btn.c)}
              className="relative overflow-hidden rounded-[20px] border border-white/15 px-2.5 py-3 text-left active:scale-[0.97] transition disabled:opacity-45"
              style={{ background: grad(btn.c) }}
            >
              <div className="absolute inset-0 bg-black/25" />
              <div className="relative">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[11px] sm:text-[12px] font-black tracking-tight text-white leading-tight truncate">
                    {btn.label}
                  </span>
                  <span className="text-[11px] font-bold text-white/75 tabular-nums shrink-0">
                    ×{btn.mult}
                  </span>
                </div>
                <div className="mt-1.5 text-[10px] text-white/55 truncate">
                  {tr("Pool", "Банк")} {formatGram(pools[btn.c])}
                </div>
                <div className="text-[10px] text-cyan-100/90 truncate">
                  {tr("You", "Вы")} {formatGram(myBets[btn.c])}
                </div>
              </div>
            </button>

            {/* Bettors under this color */}
            <div className="mt-2 space-y-1.5 max-h-[120px] overflow-y-auto no-scrollbar">
              {(betsByColor[btn.c] || []).map((b) => (
                <div
                  key={`${btn.c}-${b.telegramId}`}
                  className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] px-1.5 py-1"
                >
                  <Avatar url={b.photoUrl} name={b.username} size={22} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-white/70 truncate leading-tight">
                      {b.username}
                    </div>
                    <div className="text-[10px] font-semibold tabular-nums text-cyan-200/90 leading-tight">
                      {formatGram(b.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>


    </div>
  );
}

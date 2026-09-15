"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatGram } from "@/lib/utils";
import {
  diceCancel,
  diceCreate,
  diceJoin,
  diceLeave,
  diceList,
  diceRoll,
  diceStart,
  diceState,
  diceHistory,
  type DicePlayerPublic,
  type DiceRoomPublic,
  type DiceHistoryItem,
} from "@/lib/diceApi";
import {
  DICE_HOUSE_EDGE,
  DICE_MAX_PLAYERS,
  DICE_MIN_BET,
  DICE_MIN_PLAYERS,
} from "@/lib/diceConstants";
import {
  playBetSound,
  playClickSound,
  playErrorSound,
  playWinSound,
  playLoseSound,
  playMatchSound,
  playSelectSound,
  playCopySound,
  playDiceRollSound,
  playDiceLandSound,
  resumeAudio,
} from "@/lib/sounds";
import { useI18n } from "@/lib/i18n/context";
import { useTelegram } from "@/hooks/useTelegram";

interface Props {
  balance: number;
  telegramId: number | null;
  username: string;
  photoUrl?: string | null;
  serverMode: boolean;
  onBack: () => void;
  onDeposit?: () => void;
  onBalanceUpdate: (b: number) => void;
  onReloadBalance?: () => void;
  showToast: (msg: string) => void;
  haptic: (type?: "light" | "medium" | "heavy") => void;
  hapticSuccess: () => void;
  hapticError: () => void;
  isVisible?: boolean;
  onVerifyFairness?: (hash: string, seed: string) => void;
}

type View = "lobby" | "create" | "table" | "history";

const QUICK = [0.5, 1, 2, 5, 10, 25];

/** Standard die pip positions (3×3) */
const PIP_MAP: Record<number, boolean[]> = {
  1: [false, false, false, false, true, false, false, false, false],
  2: [true, false, false, false, false, false, false, false, true],
  3: [true, false, false, false, true, false, false, false, true],
  4: [true, false, true, false, false, false, true, false, true],
  5: [true, false, true, false, true, false, true, false, true],
  6: [true, false, true, true, false, true, true, false, true],
};

function Avatar({
  name,
  photoUrl,
  size = 40,
  ring,
  dimmed,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  ring?: string;
  dimmed?: boolean;
}) {
  const letter = (name || "?").replace(/^@/, "").charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "rounded-full overflow-hidden bg-gradient-to-br from-white/20 to-white/5 border flex items-center justify-center shrink-0 text-white/90 font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
        ring || "border-white/15",
        dimmed && "opacity-40 grayscale"
      )}
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

/** Premium casino die */
function DieFace({
  value,
  size = 48,
  rolling,
  highlight,
}: {
  value: number | null;
  size?: number;
  rolling?: boolean;
  highlight?: boolean;
}) {
  const [spin, setSpin] = useState(1);

  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(() => setSpin(1 + Math.floor(Math.random() * 6)), 60);
    return () => clearInterval(id);
  }, [rolling]);

  const face =
    rolling ? spin : value && value >= 1 && value <= 6 ? value : null;
  const cells = face ? PIP_MAP[face] : Array(9).fill(false);
  const pip = Math.max(4, size * 0.14);

  return (
    <div
      className={cn(
        "relative grid grid-cols-3 grid-rows-3 place-items-center shrink-0",
        rolling && "dice-tumble",
        !rolling && value != null && "dice-land"
      )}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.18,
        padding: size * 0.14,
        background:
          "linear-gradient(145deg, #ffffff 0%, #f4f4f5 45%, #e4e4e7 100%)",
        boxShadow: highlight
          ? "0 0 0 2px rgba(52,211,153,0.7), 0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.95)"
          : "0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -2px 4px rgba(0,0,0,0.06)",
        border: "1px solid rgba(255,255,255,0.55)",
      }}
    >
      {cells.map((on, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: pip,
            height: pip,
            background: on ? "#12121a" : "transparent",
            boxShadow: on ? "inset 0 1px 1px rgba(255,255,255,0.12)" : "none",
          }}
        />
      ))}
    </div>
  );
}

function HashChip({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string | null | undefined;
  onCopy: (v: string) => void;
}) {
  if (!value) return null;
  const short =
    value.length > 16
      ? `${value.slice(0, 8)}…${value.slice(-6)}`
      : value;
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className="w-full flex items-center gap-2 rounded-xl bg-black/30 border border-white/[0.07] px-3 py-2 text-left btn-press"
    >
      <span className="text-[10px] uppercase tracking-wider text-white/30 shrink-0 w-10">
        {label}
      </span>
      <span className="flex-1 text-[11px] font-mono text-white/55 truncate">
        {short}
      </span>
      <span className="text-[10px] text-cyan-300/80 shrink-0">copy</span>
    </button>
  );
}

export function DiceScreen({
  balance,
  telegramId,
  username,
  photoUrl,
  serverMode,
  onBack,
  onDeposit,
  onBalanceUpdate,
  onReloadBalance,
  showToast,
  haptic,
  hapticSuccess,
  hapticError,
  isVisible = true,
  onVerifyFairness,
}: Props) {
  const { t, lang } = useI18n();
  const { setBackButton } = useTelegram();
  const isRu = lang === "ru";
  const tr = useCallback(
    (en: string, ru: string) => (isRu ? ru : en),
    [isRu]
  );

  const [view, setView] = useState<View>("lobby");
  const [rooms, setRooms] = useState<DiceRoomPublic[]>([]);
  const [recent, setRecent] = useState<DiceRoomPublic[]>([]);
  const [mine, setMine] = useState<DiceRoomPublic | null>(null);
  const [active, setActive] = useState<DiceRoomPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [amountStr, setAmountStr] = useState("1");
  const amount = amountStr === "" ? 0 : Number(amountStr);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [rollingAnim, setRollingAnim] = useState(false);
  const [lastRoll, setLastRoll] = useState<{
    die1: number;
    die2: number;
    sum: number;
  } | null>(null);
  const [personalHistory, setPersonalHistory] = useState<DiceHistoryItem[]>([]);

  /** Prevents refresh() from overwriting a freshly created/joined table with a stale finished room */
  const activeIdRef = useRef<string | null>(null);
  const viewRef = useRef<View>("lobby");
  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
  }, [active?.id]);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const setActiveRoom = useCallback((room: DiceRoomPublic | null) => {
    activeIdRef.current = room?.id ?? null;
    setActive(room);
  }, []);

  const copyText = useCallback(
    (v: string) => {
      try {
        void navigator.clipboard.writeText(v);
        playCopySound();
        haptic("light");
        showToast(tr("Copied", "Скопировано"));
      } catch {
        showToast(v);
      }
    },
    [haptic, showToast, tr]
  );

  const refresh = useCallback(async () => {
    try {
      const data = await diceList();
      setRooms(data.rooms || []);
      setRecent(data.recent || []);
      setMine(data.mine || null);

      const id = activeIdRef.current;
      if (!id) return;

      // Never pull a finished room over an open/playing table we're in
      const fromOpen =
        (data.rooms || []).find((r) => r.id === id) ||
        (data.mine?.id === id ? data.mine : null);

      if (fromOpen) {
        setActive(fromOpen);
        return;
      }

      // Only use recent (finished) if we're still looking at that same finished table
      const fromRecent = (data.recent || []).find((r) => r.id === id);
      if (fromRecent && viewRef.current === "table") {
        // Confirm via state so we don't flash wrong table
        try {
          const { room } = await diceState(id);
          if (activeIdRef.current === id) setActive(room);
        } catch {
          if (activeIdRef.current === id) setActive(fromRecent);
        }
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  // Lobby list — faster poll
  useEffect(() => {
    if (!isVisible) return;
    void refresh();
    const ms = viewRef.current === "table" ? 3500 : 2500;
    const id = setInterval(() => void refresh(), ms);
    return () => clearInterval(id);
  }, [refresh, isVisible, view]);

  // Live table — fast state poll while playing or open lobby at table
  useEffect(() => {
    if (!isVisible || !active?.id) return;
    if (active.status !== "playing" && active.status !== "open") return;
    const roomId = active.id;
    let stopped = false;
    const tick = () => {
      void diceState(roomId)
        .then((r) => {
          if (stopped || activeIdRef.current !== roomId) return;
          setActive(r.room);
          if (r.room.status === "finished") {
            void onReloadBalance?.();
            void refresh();
          }
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 900);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active?.id, active?.status, onReloadBalance, refresh, isVisible]);


  useEffect(() => {
    if (view !== "history") return;
    void diceHistory(40)
      .then((r) => setPersonalHistory(r.items || []))
      .catch(() => {});
  }, [view]);

  useEffect(() => {
    const handler = () => {
      if (view === "create" || view === "history") {
        setView("lobby");
        return;
      }
      if (view === "table") {
        setView("lobby");
        if (active?.status === "finished" || active?.status === "cancelled") {
          setActiveRoom(null);
          setLastRoll(null);
        }
        return;
      }
      onBack();
    };
    setBackButton(handler);
    return () => setBackButton(null);
  }, [view, onBack, setBackButton, active?.status]);

  const openRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          r.status === "open" &&
          !(r.isSeated && r.hostTelegramId === telegramId)
      ),
    [rooms, telegramId]
  );

  const onlineAtTables = useMemo(() => {
    const ids = new Set<number>();
    for (const r of rooms) {
      if (r.status === "open" || r.status === "playing") {
        for (const p of r.players) ids.add(p.telegramId);
      }
    }
    return ids.size;
  }, [rooms]);

  const seats = useMemo(() => {
    if (!active) return [] as (DicePlayerPublic | null)[];
    const map = new Map(active.players.map((p) => [p.seat, p]));
    return Array.from(
      { length: active.maxPlayers },
      (_, i) => map.get(i) ?? null
    );
  }, [active]);

  const onCreate = async () => {
    if (busy) return;
    if (!serverMode) {
      showToast(tr("Server not configured", "Сервер не настроен"));
      return;
    }
    if (amount < DICE_MIN_BET) {
      showToast(t("minBet", { n: DICE_MIN_BET }));
      return;
    }
    if (balance < amount) {
      showToast(tr("Not enough GRAM", "Недостаточно GRAM"));
      onDeposit?.();
      return;
    }
    setBusy(true);
    resumeAudio();
    playBetSound();
    haptic("light");
    try {
      const res = await diceCreate(amount, maxPlayers);
      onBalanceUpdate(res.balance);
      setLastRoll(null);
      setActiveRoom(res.room);
      setView("table");
      playMatchSound();
      hapticSuccess();
      // Refresh lobby lists without risking stale active overwrite
      void refresh();
    } catch (e) {
      playErrorSound();
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async (roomId: string) => {
    if (busy) return;
    setBusy(true);
    resumeAudio();
    playBetSound();
    haptic("light");
    try {
      const res = await diceJoin(roomId);
      onBalanceUpdate(res.balance);
      setLastRoll(null);
      setActiveRoom(res.room);
      setView("table");
      playMatchSound();
      hapticSuccess();
      void refresh();
    } catch (e) {
      playErrorSound();
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    if (!active || busy) return;
    setBusy(true);
    resumeAudio();
    playClickSound();
    try {
      const res = await diceStart(active.id);
      setActiveRoom(res.room);
      setLastRoll(null);
      playMatchSound();
      hapticSuccess();
    } catch (e) {
      playErrorSound();
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onRoll = async () => {
    if (!active || busy || rollingAnim) return;
    const roomId = active.id;
    setBusy(true);
    setRollingAnim(true);
    setLastRoll(null);
    resumeAudio();
    playDiceRollSound();
    haptic("medium");
    try {
      const resPromise = diceRoll(roomId);
      await new Promise((r) => setTimeout(r, 1400));
      playDiceLandSound();
      const res = await resPromise;
      const roll = res.roll;
      if (roll && roll.die1 >= 1 && roll.die2 >= 1) {
        setLastRoll(roll);
      } else {
        const me = res.room.players.find((p) => p.telegramId === telegramId);
        if (me?.die1 && me?.die2) {
          setLastRoll({ die1: me.die1, die2: me.die2, sum: me.sum || me.die1 + me.die2 });
        }
      }
      setActiveRoom(res.room);
      setRollingAnim(false);
      if (res.room.status === "finished") {
        const net = (res.room.pot || 0) - (res.room.houseFee || 0);
        if (res.room.winnerTelegramId === telegramId) {
          playWinSound();
          hapticSuccess();
          showToast(
            tr(`You win +${formatGram(net)} GRAM`, `Победа +${formatGram(net)} GRAM`)
          );
        } else {
          playLoseSound();
          haptic("medium");
          showToast(tr("Better luck next time", "В этот раз не повезло"));
        }
        onReloadBalance?.();
      }
    } catch (e) {
      setRollingAnim(false);
      playErrorSound();
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const onCancel = async () => {
    if (!active || busy) return;
    setBusy(true);
    try {
      const res = await diceCancel(active.id);
      onBalanceUpdate(res.balance);
      setActiveRoom(null);
      setLastRoll(null);
      setView("lobby");
      playClickSound();
      await refresh();
    } catch (e) {
      playErrorSound();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onLeave = async () => {
    if (!active || busy) return;
    setBusy(true);
    try {
      const res = await diceLeave(active.id);
      onBalanceUpdate(res.balance);
      setActiveRoom(null);
      setLastRoll(null);
      setView("lobby");
      await refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const openTable = (room: DiceRoomPublic) => {
    playClickSound();
    haptic("light");
    setLastRoll(null);
    setActiveRoom(room);
    setView("table");
    // Fresh state immediately
    void diceState(room.id)
      .then((r) => {
        if (activeIdRef.current === room.id) setActiveRoom(r.room);
      })
      .catch(() => {});
  };

  /* ── header ── */
  const header = (
    <div className="px-4 pt-3 pb-2 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        {view !== "lobby" && (
          <div className="text-[15px] font-semibold tracking-tight truncate">
            {view === "create"
              ? tr("New table", "Новый стол")
              : view === "history"
                ? t("history")
                : "Dice"}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 h-9 px-3 rounded-full glass border border-white/[0.1]">
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
            className="h-9 w-9 rounded-full glass border border-white/[0.1] flex items-center justify-center text-cyan-300 text-lg font-light btn-press"
          >
            +
          </button>
        )}
      </div>
    </div>
  );

  /* ═══════════ CREATE ═══════════ */
  if (view === "create") {
    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        {header}
        <div className="px-4 space-y-4 flex-1">
          <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 space-y-5">
            <div>
              <div className="text-[12px] text-white/40 mb-2 font-medium">
                {tr("Stake (GRAM)", "Ставка (GRAM)")}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setAmountStr(String(q));
                      playClickSound();
                    }}
                    className={cn(
                      "h-10 px-3.5 rounded-xl text-[13px] font-semibold border tabular-nums transition",
                      amount === q
                        ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                        : "bg-white/[0.03] border-white/10 text-white/50"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, "");
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setAmountStr(v);
                }}
                placeholder="0"
                className="w-full h-12 rounded-2xl bg-black/35 border border-white/10 px-4 text-[15px] font-semibold tabular-nums outline-none focus:border-emerald-500/40"
              />
            </div>
            <div>
              <div className="text-[12px] text-white/40 mb-2 font-medium">
                {tr("Seats", "Мест")}
              </div>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setMaxPlayers(n);
                      playClickSound();
                    }}
                    className={cn(
                      "flex-1 h-11 rounded-xl text-sm font-semibold border transition",
                      maxPlayers === n
                        ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                        : "bg-white/[0.03] border-white/10 text-white/45"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-black/25 border border-white/[0.06] px-4 py-3 text-[12px] text-white/45 space-y-1.5">
              <div className="flex justify-between">
                <span>{tr("Buy-in", "Взнос")}</span>
                <span className="text-white/80 tabular-nums font-medium">
                  {formatGram(amount)} GRAM
                </span>
              </div>
              <div className="flex justify-between">
                <span>{tr("Max pot", "Макс. банк")}</span>
                <span className="text-white/80 tabular-nums font-medium">
                  {formatGram(amount * maxPlayers)} GRAM
                </span>
              </div>
              <div className="flex justify-between">
                <span>{tr("House", "Комиссия")}</span>
                <span className="text-white/80">
                  {Math.round(DICE_HOUSE_EDGE * 100)}%
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={busy || amount < DICE_MIN_BET}
            onClick={() => void onCreate()}
            className="w-full h-14 rounded-2xl btn-primary text-[15px] font-semibold btn-press disabled:opacity-40"
          >
            {tr("Create & sit", "Создать и сесть")}
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════ HISTORY ═══════════ */
  if (view === "history") {
    const numbered = [...recent].map((r, i) => ({
      ...r,
      no: recent.length - i,
    }));
    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        {header}
        <div className="px-4 space-y-2 flex-1 overflow-y-auto">
          {numbered.length === 0 && (
            <div className="text-center text-white/35 text-sm py-16">
              {tr("No games yet", "Пока нет партий")}
            </div>
          )}
          {numbered.map((r) => {
            const winner = r.players.find(
              (p) => p.telegramId === r.winnerTelegramId
            );
            const iWon = r.winnerTelegramId === telegramId;
            const iPlayed = r.players.some((p) => p.telegramId === telegramId);
            return (
              <div
                key={r.id}
                className="w-full text-left rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5"
              >
                <button
                  type="button"
                  onClick={() => openTable(r)}
                  className="w-full text-left btn-press"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-white/40 tabular-nums">
                      DICE#{r.no}
                    </span>
                    <div
                      className={cn(
                        "text-[13px] font-semibold tabular-nums",
                        iWon
                          ? "text-emerald-300"
                          : iPlayed
                            ? "text-red-300/80"
                            : "text-white/40"
                      )}
                    >
                      {iWon
                        ? `+${formatGram((r.pot || 0) - (r.houseFee || 0))}`
                        : iPlayed
                          ? `−${formatGram(r.amount)}`
                          : formatGram(r.amount)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex -space-x-2">
                      {r.players.slice(0, 5).map((p) => {
                        const isW = p.telegramId === r.winnerTelegramId;
                        return (
                          <div key={p.telegramId} className="relative">
                            <Avatar
                              name={p.username}
                              photoUrl={p.photoUrl}
                              size={30}
                              ring={
                                isW
                                  ? "border-emerald-400/80 ring-2 ring-emerald-400/30"
                                  : undefined
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-[11px] text-white/35 truncate max-w-[45%]">
                      {winner
                        ? tr(
                            `Winner @${winner.username}`,
                            `Победитель @${winner.username}`
                          )
                        : "—"}
                    </span>
                  </div>
                </button>
                {r.serverSeed && r.serverSeedHash && onVerifyFairness && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic("light");
                      onVerifyFairness(r.serverSeedHash, r.serverSeed!);
                    }}
                    className="mt-2.5 w-full h-10 rounded-xl bg-cyan-500/12 border border-cyan-400/25 text-cyan-200 text-[12px] font-semibold btn-press"
                  >
                    {tr("Verify fairness", "Проверить честность")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ═══════════ TABLE ═══════════ */

  if (view === "table" && active) {
    const turnPlayer = active.players.find((p) => p.seat === active.turnSeat);
    const isPlaying = active.status === "playing";
    const isLobby = active.status === "open";
    const isDone = active.status === "finished";
    const winner = active.players.find(
      (p) => p.telegramId === active.winnerTelegramId
    );
    const me = active.players.find((p) => p.telegramId === telegramId);
    const showRoll =
      lastRoll ||
      (me?.hasRolled && me.die1 && me.die2
        ? { die1: me.die1, die2: me.die2, sum: me.sum || me.die1 + me.die2 }
        : null);

    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top overflow-x-hidden">
        {header}

        <div className="px-4 flex-1 flex flex-col min-w-0">
          {/* Meta */}
          <div className="flex items-center justify-between mb-2 text-[11px] text-white/40">
            <span className="tabular-nums">
              {formatGram(active.amount)} GRAM · {active.playerCount}/
              {active.maxPlayers}
              {isPlaying ? ` · R${active.round}` : ""}
            </span>
            {isPlaying && active.isMyTurn && (
              <span className="text-amber-200/80 font-medium">
                {tr("Your turn", "Ваш ход")}
              </span>
            )}
          </div>

          {/* Felt table */}
          <div className="relative mx-auto w-full max-w-[320px] aspect-square shrink-0">
            <div className="absolute inset-[-4%] rounded-full bg-emerald-500/10 blur-3xl dice-pot-glow pointer-events-none" />
            <div
              className="absolute inset-0 rounded-full overflow-hidden"
              style={{
                background:
                  "radial-gradient(ellipse at 42% 30%, #167a58 0%, #0b4a36 42%, #062a1f 75%, #031812 100%)",
                border: "3px solid rgba(212,175,55,0.4)",
                boxShadow:
                  "0 20px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 70px rgba(16,185,129,0.12)",
              }}
            >
              <div
                className="absolute inset-[5%] rounded-full pointer-events-none"
                style={{ border: "1.5px solid rgba(212,175,55,0.18)" }}
              />

              {/* Center pot */}
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none px-6">
                <div className="text-center max-w-[140px]">
                  {active.pot != null ? (
                    <>
                      <div className="text-[9px] uppercase tracking-[0.22em] text-emerald-200/45 mb-0.5">
                        {tr("Pot", "Банк")}
                      </div>
                      <div className="text-[22px] font-bold text-emerald-100 tabular-nums leading-none drop-shadow-[0_0_18px_rgba(52,211,153,0.4)]">
                        {formatGram(active.pot)}
                      </div>
                      <div className="text-[9px] text-white/30 mt-0.5">GRAM</div>
                    </>
                  ) : (
                    <>
                      <div className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-1">
                        {tr("Waiting", "Ожидание")}
                      </div>
                      <div className="text-[18px] font-semibold text-white/70 tabular-nums">
                        {active.playerCount}/{active.maxPlayers}
                      </div>
                    </>
                  )}
                  {isPlaying && turnPlayer && (
                    <div className="mt-2 text-[11px] text-amber-200/95 font-semibold truncate">
                      {tr("Turn", "Ход")}: @{turnPlayer.username}
                    </div>
                  )}
                  {isDone && (
                    <div className="mt-2 text-[12px] font-bold text-cyan-200 truncate">
                      {active.winnerTelegramId === telegramId
                        ? tr("You won!", "Вы победили!")
                        : winner
                          ? `@${winner.username}`
                          : tr("Finished", "Финиш")}
                    </div>
                  )}
                </div>
              </div>

              {/* Seats */}
              {seats.map((p, i) => {
                const n = seats.length || 1;
                const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
                const radius = 31;
                const left = 50 + radius * Math.cos(angle);
                const top = 50 + radius * Math.sin(angle);
                const isTurn =
                  isPlaying && active.turnSeat === i && !!p?.active;
                const elim = !!p && !p.active;
                const isMe = p?.telegramId === telegramId;
                const isWin =
                  isDone && p?.telegramId === active.winnerTelegramId;

                return (
                  <div
                    key={i}
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${left}%`, top: `${top}%`, width: 62 }}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-1 py-1.5 text-center border backdrop-blur-md transition-all",
                        elim && "opacity-35",
                        isTurn
                          ? "bg-amber-500/20 border-amber-400/55 dice-seat-turn"
                          : isWin
                            ? "bg-emerald-500/20 border-emerald-400/50"
                            : p
                              ? "bg-black/55 border-white/12"
                              : "bg-black/25 border-white/[0.06] border-dashed"
                      )}
                    >
                      <div className="flex justify-center -mt-3 mb-0.5">
                        {p ? (
                          <Avatar
                            name={p.username}
                            photoUrl={p.photoUrl}
                            size={28}
                            dimmed={elim}
                            ring={
                              isTurn
                                ? "border-amber-400/80"
                                : isWin
                                  ? "border-emerald-400/70"
                                  : isMe
                                    ? "border-cyan-400/55"
                                    : undefined
                            }
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full border border-dashed border-white/15 bg-white/[0.03]" />
                        )}
                      </div>
                      <div className="text-[9px] text-white/55 truncate px-0.5 leading-tight">
                        {p ? `@${p.username}` : ""}
                      </div>
                      {p &&
                        (p.hasRolled ||
                          (rollingAnim && isTurn && isMe)) && (
                          <div className="flex justify-center gap-0.5 mt-1">
                            <DieFace
                              value={
                                rollingAnim && isTurn && isMe ? null : p.die1
                              }
                              rolling={rollingAnim && isTurn && isMe}
                              size={20}
                              highlight={isWin}
                            />
                            <DieFace
                              value={
                                rollingAnim && isTurn && isMe ? null : p.die2
                              }
                              rolling={rollingAnim && isTurn && isMe}
                              size={20}
                              highlight={isWin}
                            />
                          </div>
                        )}
                      {p?.sum != null && p.hasRolled && !rollingAnim && (
                        <div
                          className={cn(
                            "text-[11px] font-bold mt-0.5 tabular-nums",
                            isWin ? "text-emerald-300" : "text-white/85"
                          )}
                        >
                          {p.sum}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Your roll showcase */}
          {showRoll && !rollingAnim && (
            <div className="flex items-center justify-center gap-3 mt-4 mb-1">
              <DieFace value={showRoll.die1} size={56} />
              <DieFace value={showRoll.die2} size={56} />
              <div className="text-[20px] font-bold text-white/85 tabular-nums pl-1">
                = {showRoll.sum}
              </div>
            </div>
          )}
          {rollingAnim && (
            <div className="flex items-center justify-center gap-3 mt-4 mb-1">
              <DieFace value={null} rolling size={56} />
              <DieFace value={null} rolling size={56} />
            </div>
          )}

          {/* Fairness */}
          <div className="mt-3 space-y-1.5 max-w-sm mx-auto w-full">
            <HashChip
              label="hash"
              value={active.serverSeedHash}
              onCopy={copyText}
            />
            {active.serverSeed && (
              <HashChip
                label="seed"
                value={active.serverSeed}
                onCopy={copyText}
              />
            )}
            {isDone &&
              active.serverSeed &&
              active.serverSeedHash &&
              onVerifyFairness && (
                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    onVerifyFairness(
                      active.serverSeedHash,
                      active.serverSeed!
                    );
                  }}
                  className="w-full h-11 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-sm font-semibold btn-press"
                >
                  {tr("Verify fairness", "Проверить честность")}
                </button>
              )}
          </div>

          {/* Actions */}
          <div className="mt-3 pt-2 space-y-2.5 pb-6">
            {isLobby && active.isHost && (
              <>
                <button
                  type="button"
                  disabled={busy || active.playerCount < DICE_MIN_PLAYERS}
                  onClick={() => void onStart()}
                  className="w-full h-[52px] rounded-2xl btn-primary text-[15px] font-semibold btn-press disabled:opacity-40"
                >
                  {tr("Start", "Начать")} · {active.playerCount}/
                  {active.maxPlayers}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onCancel()}
                  className="w-full h-11 rounded-2xl border border-white/10 text-[13px] text-white/45"
                >
                  {tr("Cancel table", "Отменить стол")}
                </button>
              </>
            )}

            {isLobby && active.isSeated && !active.isHost && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onLeave()}
                className="w-full h-11 rounded-2xl border border-white/10 text-[13px] text-white/45"
              >
                {tr("Leave seat", "Встать")}
              </button>
            )}

            {isLobby &&
              !active.isSeated &&
              active.playerCount < active.maxPlayers && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onJoin(active.id)}
                  className="w-full h-[52px] rounded-2xl btn-primary text-[15px] font-semibold btn-press"
                >
                  {tr("Sit down", "Сесть")} · {formatGram(active.amount)} GRAM
                </button>
              )}

            {isPlaying && active.isMyTurn && (
              <button
                type="button"
                disabled={busy || rollingAnim}
                onClick={() => void onRoll()}
                className="w-full h-14 rounded-2xl btn-primary text-[16px] font-bold btn-press shadow-[0_0_40px_rgba(16,185,129,0.28)]"
              >
                {rollingAnim
                  ? tr("Rolling…", "Бросок…")
                  : tr("Roll dice", "Бросить кости")}
              </button>
            )}

            {isPlaying && !active.isMyTurn && active.isSeated && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] py-3.5 text-center text-[13px] text-white/40">
                {tr(
                  `Waiting for @${turnPlayer?.username || "…"}`,
                  `Ход @${turnPlayer?.username || "…"}`
                )}
              </div>
            )}

            {isDone && (
              <button
                type="button"
                onClick={() => {
                  setActiveRoom(null);
                  setLastRoll(null);
                  setView("lobby");
                  void refresh();
                }}
                className="w-full h-[52px] rounded-2xl btn-primary text-[15px] font-semibold"
              >
                {tr("Back to lobby", "В лобби")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════ LOBBY ═══════════ */
  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {header}

      <div className="px-4 pb-2">
        <h1 className="text-[22px] font-bold tracking-tight text-white leading-none">
          Dice
        </h1>
        <p className="text-[13px] text-white/40 mt-1.5 leading-relaxed">
          {tr(
            "Gather at the table, roll two dice — highest sum takes the pot. Ties re-roll until one winner.",
            "Соберитесь за столом, бросайте две кости — побеждает большая сумма. При ничьей — переброс до одного победителя."
          )}
        </p>
      </div>

      <div className="px-4 flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            playClickSound();
            setView("create");
          }}
          className="flex-1 h-12 rounded-2xl btn-primary text-[13px] font-semibold btn-press"
        >
          {tr("Create table", "Создать стол")}
        </button>
        <button
          type="button"
          onClick={() => {
            playClickSound();
            setView("history");
          }}
          className="h-12 px-4 rounded-2xl border border-white/10 text-[13px] text-white/60 font-medium"
        >
          {t("history")}
        </button>
      </div>

      {mine && (
        <div className="px-4 mb-3">
          <button
            type="button"
            onClick={() => openTable(mine)}
            className="w-full text-left rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.08] p-3.5 btn-press"
          >
            <div className="flex items-center gap-3">
              <Avatar name={username} photoUrl={photoUrl} size={40} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-cyan-100">
                  {tr("Your table", "Ваш стол")}
                </div>
                <div className="text-[11px] text-white/40">
                  {formatGram(mine.amount)} GRAM · {mine.playerCount}/
                  {mine.maxPlayers} · {mine.status}
                </div>
              </div>
              <span className="text-cyan-300/80 text-lg">→</span>
            </div>
          </button>
        </div>
      )}

      <div className="px-4 text-[12px] font-medium text-white/35 mb-2">
        {tr("Open tables", "Открытые столы")}
      </div>

      <div className="px-4 space-y-2.5 flex-1 overflow-y-auto pb-4">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[72px] rounded-2xl skeleton" />
            ))}
          </div>
        )}
        {!loading && openRooms.length === 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-14 text-center">
            <div className="flex justify-center gap-2 mb-3">
              <DieFace value={5} size={36} />
              <DieFace value={6} size={36} />
            </div>
            <div className="text-sm text-white/40">
              {tr("No open tables", "Нет открытых столов")}
            </div>
            <div className="text-[12px] text-white/25 mt-1">
              {tr("Create the first one", "Создайте первый")}
            </div>
          </div>
        )}
        {openRooms.map((r) => {
          const host = r.players.find((p) => p.seat === 0) || r.players[0];
          return (
            <div
              key={r.id}
              className="rounded-2xl border border-white/[0.07] bg-gradient-to-r from-white/[0.04] to-transparent p-3.5 flex items-center gap-3"
            >
              <Avatar
                name={host?.username || "?"}
                photoUrl={host?.photoUrl}
                size={44}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold truncate">
                  @{host?.username || "host"}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/40">
                  <span className="tabular-nums text-emerald-200/80 font-medium">
                    {formatGram(r.amount)} GRAM
                  </span>
                  <span>·</span>
                  <span>
                    {r.playerCount}/{r.maxPlayers}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={busy || r.isSeated || r.playerCount >= r.maxPlayers}
                onClick={() => void onJoin(r.id)}
                className="shrink-0 h-10 px-4 rounded-xl btn-primary text-[12px] font-semibold disabled:opacity-35"
              >
                {r.isSeated ? tr("Seated", "Вы здесь") : tr("Sit", "Сесть")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

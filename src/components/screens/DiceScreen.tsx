"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  type DicePlayerPublic,
  type DiceRoomPublic,
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
  /** When false, pause background polling (kept mounted) */
  isVisible?: boolean;
}

type View = "lobby" | "create" | "table" | "history";

const QUICK = [0.5, 1, 2, 5, 10, 25];

function Avatar({
  name,
  photoUrl,
  size = 40,
  ring,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  ring?: string;
}) {
  const letter = (name || "?").replace(/^@/, "").charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "rounded-full overflow-hidden bg-gradient-to-br from-white/20 to-white/5 border flex items-center justify-center shrink-0 text-white/90 font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
        ring || "border-white/15"
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

/** Classic die face with pips */
function DiePips({
  n,
  rolling,
  size = 52,
}: {
  n: number | null;
  rolling?: boolean;
  size?: number;
}) {
  const v = n && n >= 1 && n <= 6 ? n : null;
  const pip = (show: boolean, key: string) => (
    <span
      key={key}
      className={cn(
        "rounded-full bg-[#0c0c14]",
        show ? "opacity-100" : "opacity-0"
      )}
      style={{ width: size * 0.16, height: size * 0.16 }}
    />
  );
  // 3x3 grid positions for standard die faces
  const map: Record<number, boolean[]> = {
    1: [false, false, false, false, true, false, false, false, false],
    2: [true, false, false, false, false, false, false, false, true],
    3: [true, false, false, false, true, false, false, false, true],
    4: [true, false, true, false, false, false, true, false, true],
    5: [true, false, true, false, true, false, true, false, true],
    6: [true, false, true, true, false, true, true, false, true],
  };
  const cells = v ? map[v] : Array(9).fill(false);

  return (
    <div
      className={cn(
        "rounded-2xl bg-gradient-to-br from-white via-[#f3f4f6] to-[#e5e7eb] shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] border border-white/40 grid grid-cols-3 grid-rows-3 place-items-center p-[18%]",
        rolling && "dice-tumble"
      )}
      style={{ width: size, height: size }}
    >
      {rolling
        ? cells.map((_, i) => pip(i % 2 === 0, `r${i}`))
        : cells.map((on, i) => pip(on, `p${i}`))}
    </div>
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
}: Props) {
  const { t, lang } = useI18n();
  const { setBackButton } = useTelegram();
  const isRu = lang === "ru";

  const [view, setView] = useState<View>("lobby");
  const [rooms, setRooms] = useState<DiceRoomPublic[]>([]);
  const [recent, setRecent] = useState<DiceRoomPublic[]>([]);
  const [mine, setMine] = useState<DiceRoomPublic | null>(null);
  const [active, setActive] = useState<DiceRoomPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [rollingAnim, setRollingAnim] = useState(false);
  const [lastRoll, setLastRoll] = useState<{
    die1: number;
    die2: number;
    sum: number;
  } | null>(null);

  const tr = useCallback(
    (en: string, ru: string) => (isRu ? ru : en),
    [isRu]
  );

  const refresh = useCallback(async () => {
    try {
      const data = await diceList();
      setRooms(data.rooms || []);
      setRecent(data.recent || []);
      setMine(data.mine || null);
      if (active?.id) {
        const still =
          (data.rooms || []).find((r) => r.id === active.id) ||
          (data.mine?.id === active.id ? data.mine : null) ||
          (data.recent || []).find((r) => r.id === active.id);
        if (still) setActive(still);
      }
    } catch (e) {
      /* silent poll */
    } finally {
      setLoading(false);
    }
  }, [active?.id]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 6000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!active?.id || active.status !== "playing") return;
    const id = setInterval(() => {
      void diceState(active.id)
        .then((r) => {
          setActive(r.room);
          if (r.room.status === "finished") {
            void onReloadBalance?.();
            void refresh();
          }
        })
        .catch(() => {});
    }, 2500);
    return () => clearInterval(id);
  }, [active?.id, active?.status, onReloadBalance, refresh]);

  useEffect(() => {
    const handler = () => {
      if (view === "create" || view === "history") {
        setView("lobby");
        return;
      }
      if (view === "table") {
        if (active?.status === "playing") {
          /* stay — or allow back to lobby view of same table */
        }
        setView("lobby");
        if (active?.status === "finished" || active?.status === "cancelled") {
          setActive(null);
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
      setActive(res.room);
      setView("table");
      playMatchSound();
      hapticSuccess();
      showToast(tr("Table created", "Стол создан"));
      await refresh();
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
      setActive(res.room);
      setView("table");
      playMatchSound();
      hapticSuccess();
      await refresh();
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
      setActive(res.room);
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
    setBusy(true);
    setRollingAnim(true);
    setLastRoll(null);
    resumeAudio();
    playSelectSound();
    haptic("medium");
    try {
      await new Promise((r) => setTimeout(r, 900));
      const res = await diceRoll(active.id);
      setLastRoll(res.roll || null);
      setActive(res.room);
      if (res.room.status === "finished") {
        if (res.room.winnerTelegramId === telegramId) {
          playWinSound();
          hapticSuccess();
          showToast(
            tr(
              `You win +${formatGram((res.room.pot || 0) - (res.room.houseFee || 0))} GRAM`,
              `Победа +${formatGram((res.room.pot || 0) - (res.room.houseFee || 0))} GRAM`
            )
          );
        } else {
          playLoseSound();
          showToast(tr("Better luck next time", "В этот раз не повезло"));
        }
        onReloadBalance?.();
      }
    } catch (e) {
      playErrorSound();
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setRollingAnim(false);
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
      setActive(null);
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
      setActive(null);
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
    setActive(room);
    setView("table");
  };

  const seats = useMemo(() => {
    if (!active) return [];
    const map = new Map(active.players.map((p) => [p.seat, p]));
    return Array.from({ length: active.maxPlayers }, (_, i) => map.get(i) || null);
  }, [active]);

  /* ═══════════ HEADER ═══════════ */
  const header = (
    <div className="px-4 pt-3 pb-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        {view !== "lobby" && (
          <div className="text-[15px] font-semibold tracking-tight truncate">
            {view === "create"
              ? tr("Create table", "Создать стол")
              : view === "history"
                ? t("history")
                : view === "table"
                  ? "Dice"
                  : "Dice"}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 h-9 px-3 rounded-full glass border border-white/[0.1] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
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
                {tr("Stake", "Ставка")}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setAmount(q);
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
                type="number"
                min={DICE_MIN_BET}
                step={0.25}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full h-12 rounded-2xl bg-black/35 border border-white/10 px-4 text-[15px] font-semibold tabular-nums outline-none focus:border-emerald-500/40"
              />
            </div>

            <div>
              <div className="text-[12px] text-white/40 mb-2 font-medium">
                {tr("Seats at table", "Мест за столом")}
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

            <div className="rounded-2xl bg-black/25 border border-white/[0.06] px-4 py-3 text-[12px] text-white/45 space-y-1">
              <div className="flex justify-between">
                <span>{tr("Your buy-in", "Ваш взнос")}</span>
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
                <span>{tr("House fee", "Комиссия")}</span>
                <span className="text-white/80">{Math.round(DICE_HOUSE_EDGE * 100)}%</span>
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
    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        {header}
        <div className="px-4 space-y-2 flex-1 overflow-y-auto">
          {recent.length === 0 && (
            <div className="text-center text-white/35 text-sm py-16">
              {tr("No finished games yet", "Пока нет сыгранных партий")}
            </div>
          )}
          {recent.map((r) => {
            const winner = r.players.find(
              (p) => p.telegramId === r.winnerTelegramId
            );
            const iWon = r.winnerTelegramId === telegramId;
            const iPlayed = r.players.some((p) => p.telegramId === telegramId);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => openTable(r)}
                className="w-full text-left rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5 btn-press"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex -space-x-2">
                    {r.players.slice(0, 4).map((p) => (
                      <Avatar
                        key={p.telegramId}
                        name={p.username}
                        photoUrl={p.photoUrl}
                        size={28}
                      />
                    ))}
                  </div>
                  <div
                    className={cn(
                      "text-[12px] font-semibold tabular-nums",
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
                <div className="mt-2 flex justify-between text-[11px] text-white/35">
                  <span>
                    {winner ? `@${winner.username}` : "—"} · {r.playerCount}p
                  </span>
                  <span>
                    {r.finishedAt
                      ? new Date(r.finishedAt).toLocaleString(undefined, {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
              </button>
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

    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        {header}

        <div className="px-4 flex-1 flex flex-col">
          {/* Meta strip */}
          <div className="flex items-center justify-between mb-3 text-[11px] text-white/40">
            <span>
              {formatGram(active.amount)} GRAM · {active.playerCount}/
              {active.maxPlayers}
              {isPlaying && ` · R${active.round}`}
            </span>
            <span className="font-mono text-white/25">
              {active.serverSeedHash.slice(0, 8)}…
            </span>
          </div>

          {/* Premium felt table */}
          <div className="relative mx-auto w-full max-w-[340px] aspect-square">
            {/* outer glow */}
            <div className="absolute inset-[-4%] rounded-full bg-emerald-500/10 blur-2xl dice-pot-glow pointer-events-none" />
            <div
              className="absolute inset-0 rounded-full border border-emerald-400/25 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5),inset_0_0_80px_rgba(16,185,129,0.08)]"
              style={{
                background:
                  "radial-gradient(ellipse at 40% 35%, #0d3d2e 0%, #062a1f 45%, #041a14 100%)",
              }}
            >
              {/* wood rim illusion */}
              <div className="absolute inset-[3%] rounded-full border-[3px] border-[#2a1a0a]/60 pointer-events-none" />
              <div className="absolute inset-[5%] rounded-full border border-emerald-500/15 pointer-events-none" />

              {/* center pot */}
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="text-center px-4">
                  {active.pot != null ? (
                    <>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/40 mb-1">
                        {tr("Pot", "Банк")}
                      </div>
                      <div className="text-[22px] font-bold text-emerald-200 tabular-nums drop-shadow-[0_0_20px_rgba(52,211,153,0.35)]">
                        {formatGram(active.pot)}
                      </div>
                      <div className="text-[10px] text-white/30 mt-0.5">GRAM</div>
                    </>
                  ) : (
                    <>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">
                        {tr("Lobby", "Лобби")}
                      </div>
                      <div className="text-[15px] font-semibold text-white/70">
                        {active.playerCount}/{active.maxPlayers}
                      </div>
                    </>
                  )}
                  {isPlaying && turnPlayer && (
                    <div className="mt-2 text-[11px] text-amber-200/90 font-medium">
                      {tr("Turn", "Ход")}: @{turnPlayer.username}
                    </div>
                  )}
                  {isDone && (
                    <div className="mt-2 text-[12px] text-cyan-300 font-semibold">
                      {active.winnerTelegramId === telegramId
                        ? tr("You won!", "Вы победили!")
                        : tr("Finished", "Игра окончена")}
                    </div>
                  )}
                </div>
              </div>

              {/* seats */}
              {seats.map((p, i) => {
                const n = seats.length || 1;
                const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
                const radius = 38;
                const left = 50 + radius * Math.cos(angle);
                const top = 50 + radius * Math.sin(angle);
                const isTurn = isPlaying && active.turnSeat === i && p?.active;
                const elim = p && !p.active;

                return (
                  <div
                    key={i}
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${left}%`, top: `${top}%`, width: 88 }}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-1.5 py-1.5 text-center border backdrop-blur-md transition-all",
                        elim && "opacity-35 grayscale",
                        isTurn
                          ? "bg-amber-500/15 border-amber-400/50 dice-seat-turn"
                          : p
                            ? "bg-black/55 border-white/12"
                            : "bg-black/30 border-white/[0.06] border-dashed"
                      )}
                    >
                      <div className="flex justify-center -mt-5 mb-1">
                        {p ? (
                          <Avatar
                            name={p.username}
                            photoUrl={p.photoUrl}
                            size={36}
                            ring={
                              isTurn
                                ? "border-amber-400/70"
                                : p.telegramId === telegramId
                                  ? "border-cyan-400/50"
                                  : undefined
                            }
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full border border-dashed border-white/15 bg-white/[0.03]" />
                        )}
                      </div>
                      <div className="text-[10px] text-white/55 truncate px-0.5 leading-tight">
                        {p ? `@${p.username}` : tr("Empty", "Пусто")}
                      </div>
                      {p && (p.hasRolled || (rollingAnim && isTurn && p.telegramId === telegramId)) && (
                        <div className="flex justify-center gap-1 mt-1.5 scale-90 origin-top">
                          <DiePips
                            n={
                              rollingAnim && isTurn && p.telegramId === telegramId
                                ? null
                                : p.die1
                            }
                            rolling={
                              rollingAnim &&
                              isTurn &&
                              p.telegramId === telegramId
                            }
                            size={36}
                          />
                          <DiePips
                            n={
                              rollingAnim && isTurn && p.telegramId === telegramId
                                ? null
                                : p.die2
                            }
                            rolling={
                              rollingAnim &&
                              isTurn &&
                              p.telegramId === telegramId
                            }
                            size={36}
                          />
                        </div>
                      )}
                      {p?.sum != null && p.hasRolled && !rollingAnim && (
                        <div className="text-[12px] font-bold text-white mt-1 tabular-nums">
                          Σ {p.sum}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Big dice preview when you just rolled */}
          {lastRoll && active.isSeated && (
            <div className="flex justify-center gap-3 mt-4 mb-1">
              <DiePips n={lastRoll.die1} size={56} />
              <DiePips n={lastRoll.die2} size={56} />
              <div className="flex items-center text-lg font-bold text-white/80 tabular-nums pl-1">
                = {lastRoll.sum}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-auto pt-5 space-y-2.5 pb-2">
            {isLobby && active.isHost && (
              <>
                <button
                  type="button"
                  disabled={busy || active.playerCount < DICE_MIN_PLAYERS}
                  onClick={() => void onStart()}
                  className="w-full h-13 h-[52px] rounded-2xl btn-primary text-[15px] font-semibold btn-press disabled:opacity-40"
                >
                  {tr("Start game", "Начать игру")} · {active.playerCount}/
                  {active.maxPlayers}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onCancel()}
                  className="w-full h-11 rounded-2xl border border-white/10 text-[13px] text-white/50 hover:text-white/70"
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
                className="w-full h-11 rounded-2xl border border-white/10 text-[13px] text-white/50"
              >
                {tr("Leave seat", "Освободить место")}
              </button>
            )}

            {isLobby && !active.isSeated && active.playerCount < active.maxPlayers && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onJoin(active.id)}
                className="w-full h-[52px] rounded-2xl btn-primary text-[15px] font-semibold btn-press"
              >
                {tr("Sit down", "Сесть за стол")} · {formatGram(active.amount)} GRAM
              </button>
            )}

            {isPlaying && active.isMyTurn && (
              <button
                type="button"
                disabled={busy || rollingAnim}
                onClick={() => void onRoll()}
                className="w-full h-14 rounded-2xl btn-primary text-[16px] font-bold btn-press shadow-[0_0_40px_rgba(16,185,129,0.25)]"
              >
                {rollingAnim
                  ? tr("Rolling…", "Бросок…")
                  : tr("Roll dice", "Бросить кости")}
              </button>
            )}

            {isPlaying && !active.isMyTurn && active.isSeated && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] py-4 text-center text-[13px] text-white/40">
                {active.players.find((p) => p.seat === active.turnSeat)?.active
                  ? tr(
                      `Waiting for @${turnPlayer?.username || "…"}`,
                      `Ход @${turnPlayer?.username || "…"}`
                    )
                  : tr("Waiting…", "Ожидание…")}
              </div>
            )}

            {isDone && (
              <button
                type="button"
                onClick={() => {
                  setActive(null);
                  setLastRoll(null);
                  setView("lobby");
                  void refresh();
                }}
                className="w-full h-[52px] rounded-2xl btn-primary text-[15px] font-semibold"
              >
                {tr("Back to lobby", "В лобби")}
              </button>
            )}

            {active.serverSeed && (
              <p className="text-[10px] text-white/25 text-center font-mono break-all px-2">
                seed {active.serverSeed.slice(0, 24)}…
              </p>
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
        <p className="text-[13px] text-white/40 mt-1.5">
          {tr(
            "PvP table · 2–6 players · highest sum wins",
            "PvP стол · 2–6 игроков · побеждает большая сумма"
          )}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-200/90 font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            {tr("Online", "Онлайн")} {onlineAtTables}
          </span>
          <span className="text-[11px] text-white/30">
            {tr("Fee", "Комиссия")} {Math.round(DICE_HOUSE_EDGE * 100)}%
          </span>
        </div>
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
            <div className="text-[28px] mb-2 opacity-40">⚄</div>
            <div className="text-sm text-white/40">
              {tr("No open tables", "Нет открытых столов")}
            </div>
            <div className="text-[12px] text-white/25 mt-1">
              {tr("Be the first to create one", "Создайте первый стол")}
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
                  <span className="flex -space-x-1.5 ml-1">
                    {r.players.slice(0, 4).map((p) => (
                      <Avatar
                        key={p.telegramId}
                        name={p.username}
                        photoUrl={p.photoUrl}
                        size={18}
                      />
                    ))}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={busy || r.isSeated || r.playerCount >= r.maxPlayers}
                onClick={() => void onJoin(r.id)}
                className="shrink-0 h-10 px-4 rounded-xl btn-primary text-[12px] font-semibold disabled:opacity-35"
              >
                {r.isSeated
                  ? tr("Seated", "Вы здесь")
                  : tr("Sit", "Сесть")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

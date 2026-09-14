"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useI18n } from "@/lib/i18n/context";
import { formatGram, cn } from "@/lib/utils";
import {
  diceCancel,
  diceCreate,
  diceJoin,
  diceLeave,
  diceList,
  diceRoll,
  diceStart,
  diceState,
  type DiceRoomPublic,
} from "@/lib/diceApi";
import { DICE_MAX_PLAYERS, DICE_MIN_BET, DICE_MIN_PLAYERS } from "@/lib/diceConstants";

interface Props {
  onBack: () => void;
  balance: number;
  onBalance: (n: number) => void;
  showToast: (msg: string) => void;
}

function DieFace({ n, rolling }: { n: number | null; rolling?: boolean }) {
  const v = n && n >= 1 && n <= 6 ? n : 1;
  return (
    <div
      className={cn(
        "w-12 h-12 rounded-xl bg-white text-[#0c0c14] shadow-lg border border-white/20 flex items-center justify-center text-xl font-bold tabular-nums",
        rolling && "animate-pulse scale-110"
      )}
    >
      {rolling ? "?" : v}
    </div>
  );
}

export function DiceScreen({ onBack, balance, onBalance, showToast }: Props) {
  const { t, lang } = useI18n();
  const { setBackButton, haptic, hapticSuccess, hapticError, telegramId } =
    useTelegram();
  const isRu = lang === "ru";

  const [rooms, setRooms] = useState<DiceRoomPublic[]>([]);
  const [mine, setMine] = useState<DiceRoomPublic | null>(null);
  const [active, setActive] = useState<DiceRoomPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [rollingAnim, setRollingAnim] = useState(false);

  useEffect(() => {
    setBackButton(() => {
      if (active && active.status === "open" && !active.isSeated) {
        setActive(null);
        return;
      }
      onBack();
    });
    return () => setBackButton(null);
  }, [onBack, setBackButton, active]);

  const load = useCallback(async () => {
    try {
      const data = await diceList();
      setRooms(data.rooms || []);
      setMine(data.mine || null);
      if (active?.id) {
        const still =
          (data.rooms || []).find((r) => r.id === active.id) ||
          (data.mine && data.mine.id === active.id ? data.mine : null);
        if (still) setActive(still);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [active?.id, showToast]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, [load]);

  // poll active room faster while playing
  useEffect(() => {
    if (!active?.id || active.status !== "playing") return;
    const id = setInterval(() => {
      void diceState(active.id)
        .then((r) => setActive(r.room))
        .catch(() => {});
    }, 1500);
    return () => clearInterval(id);
  }, [active?.id, active?.status]);

  const openLobby = rooms.filter((r) => r.status === "open");

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    haptic("light");
    try {
      const res = await diceCreate(amount, maxPlayers);
      onBalance(res.balance);
      setActive(res.room);
      showToast(isRu ? "Стол создан" : "Table created");
      await load();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async (roomId: string) => {
    if (busy) return;
    setBusy(true);
    haptic("light");
    try {
      const res = await diceJoin(roomId);
      onBalance(res.balance);
      setActive(res.room);
      await load();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    if (!active || busy) return;
    setBusy(true);
    try {
      const res = await diceStart(active.id);
      setActive(res.room);
      hapticSuccess();
    } catch (e) {
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
    haptic("medium");
    try {
      // short animation then request
      await new Promise((r) => setTimeout(r, 700));
      const res = await diceRoll(active.id);
      setActive(res.room);
      if (res.room.status === "finished") {
        hapticSuccess();
        if (res.room.winnerTelegramId === telegramId) {
          showToast(isRu ? "Победа!" : "You win!");
        }
        if (res.balance != null) {
          /* balance not always returned */
        }
      }
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setRollingAnim(false);
      setBusy(false);
      void load();
    }
  };

  const onCancel = async () => {
    if (!active || busy) return;
    setBusy(true);
    try {
      const res = await diceCancel(active.id);
      onBalance(res.balance);
      setActive(null);
      await load();
    } catch (e) {
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
      onBalance(res.balance);
      setActive(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const seats = useMemo(() => {
    if (!active) return [];
    const map = new Map(active.players.map((p) => [p.seat, p]));
    return Array.from({ length: active.maxPlayers }, (_, i) => map.get(i) || null);
  }, [active]);

  // ——— Table view ———
  if (active) {
    const turnPlayer = active.players.find((p) => p.seat === active.turnSeat);
    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top px-4">
        <div className="pt-3 pb-2 flex items-center justify-between">
          <h1 className="text-[15px] font-semibold">Dice</h1>
          <span className="text-[11px] text-white/40">
            {formatGram(active.amount)} GRAM · {active.playerCount}/
            {active.maxPlayers}
          </span>
        </div>

        {/* Felt table */}
        <div className="relative mx-auto w-full max-w-sm aspect-square rounded-full border border-emerald-500/30 bg-gradient-to-br from-emerald-950 via-[#0a1f14] to-[#06120c] shadow-[0_0_60px_rgba(16,185,129,0.12)] overflow-hidden">
          <div className="absolute inset-[12%] rounded-full border border-white/5 bg-black/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center z-10">
              {active.pot != null && (
                <div className="text-[11px] text-white/40 mb-1">
                  {isRu ? "Банк" : "Pot"}
                </div>
              )}
              <div className="text-lg font-bold text-emerald-300 tabular-nums">
                {active.pot != null
                  ? `${formatGram(active.pot)} GRAM`
                  : active.status === "open"
                    ? isRu
                      ? "Лобби"
                      : "Lobby"
                    : `R${active.round}`}
              </div>
              {active.status === "playing" && turnPlayer && (
                <div className="text-[11px] text-amber-200/80 mt-1">
                  {isRu ? "Ход:" : "Turn:"} @{turnPlayer.username}
                </div>
              )}
              {active.status === "finished" && active.winnerTelegramId && (
                <div className="text-[12px] text-cyan-300 mt-1">
                  {isRu ? "Победитель" : "Winner"} · seat{" "}
                  {(active.players.find(
                    (p) => p.telegramId === active.winnerTelegramId
                  )?.seat ?? 0) + 1}
                </div>
              )}
            </div>
          </div>

          {/* Seats around circle */}
          {seats.map((p, i) => {
            const angle = (i / seats.length) * Math.PI * 2 - Math.PI / 2;
            const r = 42; // %
            const left = 50 + r * Math.cos(angle);
            const top = 50 + r * Math.sin(angle);
            const isTurn =
              active.status === "playing" && active.turnSeat === i;
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-[72px]"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <div
                  className={cn(
                    "rounded-2xl border px-1.5 py-1.5 text-center bg-black/50 backdrop-blur-sm",
                    p?.active === false && "opacity-40",
                    isTurn
                      ? "border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.35)]"
                      : "border-white/10"
                  )}
                >
                  <div className="text-[10px] text-white/50 truncate">
                    {p ? `@${p.username}` : "—"}
                  </div>
                  {p && p.hasRolled && p.sum != null ? (
                    <div className="flex justify-center gap-1 mt-1">
                      <DieFace n={p.die1} />
                      <DieFace n={p.die2} />
                    </div>
                  ) : p && isTurn && rollingAnim && p.telegramId === telegramId ? (
                    <div className="flex justify-center gap-1 mt-1">
                      <DieFace n={null} rolling />
                      <DieFace n={null} rolling />
                    </div>
                  ) : (
                    <div className="text-[11px] text-white/30 mt-1 tabular-nums">
                      {p?.sum != null ? p.sum : p ? "…" : ""}
                    </div>
                  )}
                  {p && p.sum != null && (
                    <div className="text-[11px] font-semibold text-white mt-0.5">
                      Σ {p.sum}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 space-y-2">
          {active.status === "open" && active.isHost && (
            <>
              <button
                type="button"
                disabled={busy || active.playerCount < DICE_MIN_PLAYERS}
                onClick={() => void onStart()}
                className="w-full h-12 rounded-2xl btn-primary text-sm font-medium btn-press disabled:opacity-40"
              >
                {isRu ? "Начать игру" : "Start"} ({active.playerCount}/
                {active.maxPlayers})
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onCancel()}
                className="w-full h-11 rounded-2xl border border-white/10 text-sm text-white/60"
              >
                {isRu ? "Отменить стол" : "Cancel table"}
              </button>
            </>
          )}

          {active.status === "open" && active.isSeated && !active.isHost && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onLeave()}
              className="w-full h-11 rounded-2xl border border-white/10 text-sm text-white/60"
            >
              {isRu ? "Выйти" : "Leave"}
            </button>
          )}

          {active.status === "playing" && active.isMyTurn && (
            <button
              type="button"
              disabled={busy || rollingAnim}
              onClick={() => void onRoll()}
              className="w-full h-14 rounded-2xl btn-primary text-base font-semibold btn-press"
            >
              {rollingAnim
                ? isRu
                  ? "Бросок…"
                  : "Rolling…"
                : isRu
                  ? "Бросить"
                  : "Roll"}
            </button>
          )}

          {active.status === "playing" && !active.isMyTurn && active.isSeated && (
            <div className="text-center text-sm text-white/40 py-3">
              {isRu ? "Ожидание хода соперников…" : "Waiting for others…"}
            </div>
          )}

          {active.status === "finished" && (
            <button
              type="button"
              onClick={() => {
                setActive(null);
                void load();
              }}
              className="w-full h-12 rounded-2xl btn-primary text-sm font-medium"
            >
              {isRu ? "К столам" : "Back to tables"}
            </button>
          )}

          <p className="text-[10px] text-white/25 text-center font-mono break-all px-2">
            seed hash: {active.serverSeedHash.slice(0, 16)}…
            {active.serverSeed && (
              <>
                <br />
                seed: {active.serverSeed.slice(0, 20)}…
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  // ——— Lobby list ———
  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top px-4">
      <div className="pt-3 pb-2">
        <h1 className="text-[15px] font-semibold">Dice PvP</h1>
        <p className="text-[12px] text-white/40 mt-1">
          {isRu
            ? "До 6 игроков · 2 кости · переброс при ничьей"
            : "Up to 6 players · 2 dice · re-roll on ties"}
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 mb-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-white/45">
            {isRu ? "Ставка" : "Stake"}
          </span>
          <input
            type="number"
            min={DICE_MIN_BET}
            step={0.25}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-28 h-10 rounded-xl bg-black/40 border border-white/10 px-3 text-sm text-right tabular-nums"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-white/45">
            {isRu ? "Мест за столом" : "Seats"}
          </span>
          <div className="flex gap-1">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxPlayers(n)}
                className={cn(
                  "w-9 h-9 rounded-xl text-sm font-medium border",
                  maxPlayers === n
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-200"
                    : "border-white/10 text-white/40"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={busy || amount < DICE_MIN_BET || balance < amount}
          onClick={() => void onCreate()}
          className="w-full h-12 rounded-2xl btn-primary text-sm font-medium btn-press disabled:opacity-40"
        >
          {isRu ? "Создать стол" : "Create table"}
        </button>
      </div>

      {mine && (
        <button
          type="button"
          onClick={() => setActive(mine)}
          className="mb-3 w-full text-left rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3"
        >
          <div className="text-sm font-medium">
            {isRu ? "Ваш стол" : "Your table"}
          </div>
          <div className="text-[11px] text-white/45">
            {formatGram(mine.amount)} GRAM · {mine.playerCount}/
            {mine.maxPlayers} · {mine.status}
          </div>
        </button>
      )}

      <div className="text-[12px] text-white/40 mb-2">
        {isRu ? "Открытые столы" : "Open tables"}
      </div>
      {loading && (
        <div className="text-center text-white/30 text-sm py-8">…</div>
      )}
      {!loading && openLobby.length === 0 && (
        <div className="text-center text-white/30 text-sm py-8">
          {isRu ? "Пока нет столов" : "No tables yet"}
        </div>
      )}
      <div className="space-y-2">
        {openLobby.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                @{r.players[0]?.username || "host"}
              </div>
              <div className="text-[11px] text-white/40">
                {formatGram(r.amount)} GRAM · {r.playerCount}/{r.maxPlayers}
              </div>
            </div>
            <button
              type="button"
              disabled={busy || r.isSeated || r.playerCount >= r.maxPlayers}
              onClick={() => void onJoin(r.id)}
              className="shrink-0 h-10 px-4 rounded-xl btn-primary text-xs font-medium disabled:opacity-40"
            >
              {r.isSeated ? (isRu ? "Вы за столом" : "Seated") : isRu ? "Сесть" : "Join"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatGram } from "@/lib/utils";
import {
  xoCancel,
  xoCreate,
  xoHistory,
  xoJoin,
  xoList,
  xoMove,
  xoState,
  type XoHistoryItem,
  type XoPublicRoom,
  type XoSymbol,
} from "@/lib/xoApi";
import { XO_MIN_BET, XO_TURN_SEC } from "@/lib/xoConstants";
import {
  playBetSound,
  playClickSound,
  playErrorSound,
  playWinSound,
  playLoseSound,
  playMatchSound,
  playSelectSound,
} from "@/lib/sounds";
import { useI18n } from "@/lib/i18n/context";
import { useTelegram } from "@/hooks/useTelegram";

interface XoScreenProps {
  balance: number;
  telegramId: number | null | undefined;
  username: string;
  photoUrl?: string | null;
  serverMode?: boolean;
  onBack: () => void;
  onDeposit?: () => void;
  onBalanceUpdate: (b: number) => void;
  onReloadBalance?: () => void;
  showToast: (msg: string) => void;
  haptic: (type?: "light" | "medium" | "heavy") => void;
  hapticSuccess: () => void;
  hapticError: () => void;
  isVisible?: boolean;
}

type View = "lobby" | "create" | "play" | "history";

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

function Mark({
  symbol,
  size = 28,
  glow,
  thick,
}: {
  symbol: XoSymbol | null;
  size?: number;
  glow?: boolean;
  thick?: boolean;
}) {
  if (!symbol) return null;
  const sw = thick ? 3.2 : 2.8;
  const gid = `m${symbol}${size}${glow ? 1 : 0}${thick ? 1 : 0}`;
  if (symbol === "X") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={cn(
          glow && "drop-shadow-[0_0_12px_rgba(251,113,133,0.7)]",
          "shrink-0"
        )}
      >
        <path
          d="M5.2 5.2l13.6 13.6M18.8 5.2L5.2 18.8"
          stroke={`url(#${gid})`}
          strokeWidth={sw}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fecdd3" />
            <stop offset="45%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn(
        glow && "drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]",
        "shrink-0"
      )}
    >
      <circle
        cx="12"
        cy="12"
        r="7.1"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={sw}
      />
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a5f3fc" />
          <stop offset="45%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function winCells(board: (XoSymbol | null)[]): number[] {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return line;
  }
  return [];
}

export function XoScreen({
  balance,
  telegramId,
  username,
  photoUrl,
  onBack,
  onDeposit,
  onBalanceUpdate,
  onReloadBalance,
  showToast,
  haptic,
  hapticSuccess,
  hapticError,
  isVisible = true,
}: XoScreenProps) {
  const { t, lang } = useI18n();
  const { setBackButton } = useTelegram();
  const isRu = lang === "ru";
  const tr = useCallback(
    (en: string, ru: string) => (isRu ? ru : en),
    [isRu]
  );

  const [view, setView] = useState<View>("lobby");
  const [rooms, setRooms] = useState<XoPublicRoom[]>([]);
  const [recent, setRecent] = useState<XoPublicRoom[]>([]);
  const [mine, setMine] = useState<XoPublicRoom | null>(null);
  const [active, setActive] = useState<XoPublicRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [amountStr, setAmountStr] = useState("1");
  const amount = amountStr === "" ? 0 : Number(amountStr);
  const [symbol, setSymbol] = useState<XoSymbol>("X");
  const [personalHistory, setPersonalHistory] = useState<XoHistoryItem[]>([]);
  const [histTab, setHistTab] = useState<"all" | "my">("all");
  const [nowTs, setNowTs] = useState(() => Date.now());

  const viewRef = useRef(view);
  viewRef.current = view;
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
  }, [active?.id]);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await xoList({ fresh: true });
      setRooms(data.rooms || []);
      setRecent(data.recent || []);
      setMine(data.mine || null);
      const id = activeIdRef.current;
      if (id && data.mine?.id === id) {
        setActive(data.mine);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    void refresh();
    const id = setInterval(() => void refresh(), viewRef.current === "play" ? 1200 : 2500);
    return () => clearInterval(id);
  }, [refresh, isVisible, view]);

  useEffect(() => {
    if (!isVisible || !active?.id || active.status !== "playing") return;
    const roomId = active.id;
    let stopped = false;
    const tick = () => {
      void xoState(roomId)
        .then((r) => {
          if (stopped || activeIdRef.current !== roomId) return;
          setActive(r.room);
          if (r.room.status === "finished") {
            void onReloadBalance?.();
            void refresh();
            const iWon = r.room.winnerTelegramId === telegramId;
            const draw = r.room.winnerTelegramId == null;
            if (draw) playMatchSound();
            else if (iWon) playWinSound();
            else playLoseSound();
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
  }, [active?.id, active?.status, onReloadBalance, refresh, isVisible, telegramId]);

  useEffect(() => {
    if (view !== "history") return;
    void xoHistory(40)
      .then((r) => setPersonalHistory(r.items || []))
      .catch(() => {});
  }, [view]);

  useEffect(() => {
    const handler = () => {
      if (view === "create" || view === "history") {
        setView("lobby");
        return;
      }
      if (view === "play") {
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

  // Auto enter mine playing
  useEffect(() => {
    if (!mine) return;
    if (mine.status === "playing" || mine.status === "open") {
      if (viewRef.current === "lobby" || viewRef.current === "create") {
        setActive(mine);
        if (mine.status === "playing") setView("play");
      }
    }
  }, [mine]);

  const openRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          r.status === "open" &&
          r.creatorTelegramId !== telegramId
      ),
    [rooms, telegramId]
  );

  const turnLeftSec = useMemo(() => {
    if (!active?.turnDeadline || active.status !== "playing") return null;
    return Math.max(0, Math.ceil((new Date(active.turnDeadline).getTime() - nowTs) / 1000));
  }, [active?.turnDeadline, active?.status, nowTs]);

  const onCreate = async () => {
    if (busy) return;
    if (!Number.isFinite(amount) || amount < XO_MIN_BET) {
      showToast(tr(`Min ${XO_MIN_BET} GRAM`, `Мин. ${XO_MIN_BET} GRAM`));
      hapticError();
      return;
    }
    if (amount > balance) {
      onDeposit?.();
      return;
    }
    setBusy(true);
    try {
      playBetSound();
      const res = await xoCreate(amount, symbol);
      onBalanceUpdate(res.balance);
      setActive(res.room);
      setView("play");
      hapticSuccess();
      void refresh();
    } catch (e) {
      playErrorSound();
      hapticError();
      showToast(e instanceof Error ? e.message : tr("Failed", "Ошибка"));
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async (room: XoPublicRoom) => {
    if (busy) return;
    if (room.amount > balance) {
      onDeposit?.();
      return;
    }
    setBusy(true);
    try {
      playBetSound();
      const res = await xoJoin(room.id);
      onBalanceUpdate(res.balance);
      setActive(res.room);
      setView("play");
      playMatchSound();
      hapticSuccess();
      void refresh();
    } catch (e) {
      playErrorSound();
      hapticError();
      showToast(e instanceof Error ? e.message : tr("Failed", "Ошибка"));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async (roomId?: string) => {
    const id = roomId || active?.id;
    if (!id || busy) return;
    setBusy(true);
    try {
      const res = await xoCancel(id);
      onBalanceUpdate(res.balance);
      setActive(null);
      setView("lobby");
      haptic("light");
      void refresh();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : tr("Failed", "Ошибка"));
    } finally {
      setBusy(false);
    }
  };

  const onCell = async (cell: number) => {
    if (!active || busy || active.status !== "playing") return;
    if (!active.isMyTurn) return;
    if (active.board[cell]) return;
    setBusy(true);
    try {
      playSelectSound();
      const res = await xoMove(active.id, cell);
      setActive(res.room);
      if (res.room.status === "finished") {
        void onReloadBalance?.();
        const iWon = res.room.winnerTelegramId === telegramId;
        const draw = res.room.winnerTelegramId == null;
        if (draw) playMatchSound();
        else if (iWon) {
          playWinSound();
          hapticSuccess();
        } else {
          playLoseSound();
          hapticError();
        }
      }
      void refresh();
    } catch (e) {
      playErrorSound();
      hapticError();
      showToast(e instanceof Error ? e.message : tr("Failed", "Ошибка"));
      if (active.id) {
        try {
          const s = await xoState(active.id);
          setActive(s.room);
        } catch {}
      }
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div className="px-4 pt-3 pb-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        {view !== "lobby" && (
          <div className="text-[15px] font-semibold tracking-tight truncate">
            {view === "create"
              ? tr("New game", "Новая игра")
              : view === "history"
                ? t("history")
                : tr("Tic-Tac-Toe", "Крестики-нолики")}
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
            className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400/25 to-violet-500/25 border border-cyan-400/30 flex items-center justify-center text-cyan-200 btn-press shadow-[0_0_16px_rgba(34,211,238,0.25)]"
            aria-label="Deposit"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  /* ── CREATE ── */
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
                      "px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition",
                      amount === q
                        ? "bg-cyan-400/15 border-cyan-400/35 text-cyan-200"
                        : "bg-white/[0.04] border-white/10 text-white/55"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <input
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-full h-12 rounded-2xl bg-black/35 border border-white/10 px-4 text-[16px] font-semibold tabular-nums outline-none focus:border-cyan-400/40"
                inputMode="decimal"
              />
            </div>
            <div>
              <div className="text-[12px] text-white/40 mb-2 font-medium">
                {tr("Your symbol", "Ваш символ")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["X", "O"] as XoSymbol[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSymbol(s);
                      playSelectSound();
                    }}
                    className={cn(
                      "h-16 rounded-2xl border flex items-center justify-center transition",
                      symbol === s
                        ? "bg-white/10 border-white/25 shadow-[0_0_20px_rgba(255,255,255,0.08)]"
                        : "bg-white/[0.03] border-white/10 opacity-70"
                    )}
                  >
                    <Mark symbol={s} size={40} glow={symbol === s} thick />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/30 mt-2">
                {tr("X always moves first", "X всегда ходит первым")}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onCreate()}
            className="w-full h-12 rounded-2xl font-semibold text-[15px] bg-gradient-to-r from-rose-500/90 to-cyan-500/90 text-white btn-press disabled:opacity-50 shadow-[0_8px_28px_rgba(244,63,94,0.25)]"
          >
            {tr("Create game", "Создать игру")}
          </button>
        </div>
      </div>
    );
  }

  /* ── HISTORY ── */
  if (view === "history") {
    type Card = {
      key: string;
      no: number;
      amount: number;
      potAfterFee: number | null;
      winnerTelegramId: number | null;
      creatorUsername: string;
      joinerUsername: string | null;
      creatorPhotoUrl: string | null;
      joinerPhotoUrl: string | null;
      result?: "win" | "lose" | "draw";
      payout?: number;
      isMine: boolean;
    };

    const allCards: Card[] = recent.map((r, i) => ({
      key: r.id,
      no: r.gameNo != null ? Number(r.gameNo) : recent.length - i,
      amount: r.amount,
      potAfterFee: r.potAfterFee,
      winnerTelegramId: r.winnerTelegramId,
      creatorUsername: r.creatorUsername,
      joinerUsername: r.joinerUsername,
      creatorPhotoUrl: r.creatorPhotoUrl,
      joinerPhotoUrl: r.joinerPhotoUrl,
      isMine:
        r.creatorTelegramId === telegramId ||
        r.joinerTelegramId === telegramId,
    }));

    const myCards: Card[] = personalHistory.map((h, i) => {
      const fromRecent = recent.find((r) => r.id === h.room_id);
      return {
        key: h.id,
        no:
          h.game_no != null
            ? Number(h.game_no)
            : fromRecent?.gameNo != null
              ? Number(fromRecent.gameNo)
              : personalHistory.length - i,
        amount: h.amount,
        potAfterFee: fromRecent?.potAfterFee ?? (h.result === "win" ? h.payout : null),
        winnerTelegramId:
          h.result === "draw"
            ? null
            : h.result === "win"
              ? telegramId ?? null
              : null,
        creatorUsername: fromRecent?.creatorUsername || username,
        joinerUsername: fromRecent?.joinerUsername || h.opponent,
        creatorPhotoUrl: fromRecent?.creatorPhotoUrl || photoUrl || null,
        joinerPhotoUrl: fromRecent?.joinerPhotoUrl || null,
        result: h.result,
        payout: h.payout,
        isMine: true,
      };
    });

    const cards = histTab === "all" ? allCards : myCards;

    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        {header}
        <div className="px-4 flex-1 overflow-y-auto">
          <div className="flex gap-1.5 p-1 rounded-2xl bg-black/35 border border-white/[0.06] mb-4">
            <button
              type="button"
              onClick={() => setHistTab("all")}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold text-center transition",
                histTab === "all"
                  ? "bg-white/10 text-white border border-white/12"
                  : "text-white/40"
              )}
            >
              {t("all")}
            </button>
            <button
              type="button"
              onClick={() => {
                setHistTab("my");
                void xoHistory(40)
                  .then((r) => setPersonalHistory(r.items || []))
                  .catch(() => {});
              }}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold text-center transition",
                histTab === "my"
                  ? "bg-white/10 text-white border border-white/12"
                  : "text-white/40"
              )}
            >
              {isRu ? "Мои игры" : "My games"}
            </button>
          </div>
          {cards.length === 0 ? (
            <div className="text-center text-white/35 text-sm py-16">
              {tr("No games yet", "Пока нет партий")}
            </div>
          ) : (
            <div className="space-y-2.5 pb-6">
              {cards.map((c) => {
                const iWon =
                  c.result === "win" ||
                  (c.winnerTelegramId != null &&
                    c.winnerTelegramId === telegramId);
                const draw =
                  c.result === "draw" ||
                  (c.result == null && c.winnerTelegramId == null);
                const iLost = c.isMine && !iWon && !draw;
                let delta = `${formatGram(c.amount)} GRAM`;
                let deltaCls = "text-white/45";
                if (iWon) {
                  delta = `+${formatGram(c.payout ?? c.potAfterFee ?? c.amount)} GRAM`;
                  deltaCls = "text-emerald-300";
                } else if (iLost) {
                  delta = `−${formatGram(c.amount)} GRAM`;
                  deltaCls = "text-rose-300/90";
                } else if (draw && c.isMine) {
                  delta = `${formatGram(c.amount)} GRAM`;
                  deltaCls = "text-white/50";
                }
                const wLabel = draw
                  ? tr("Draw", "Ничья")
                  : iWon
                    ? `@${(username || "?").replace(/^@/, "")}`
                    : `@${(c.joinerUsername || c.creatorUsername || "?").replace(/^@/, "")}`;

                return (
                  <div
                    key={c.key}
                    className={cn(
                      "w-full text-left rounded-[18px] border px-3.5 py-3 transition",
                      iWon
                        ? "border-emerald-500/30 bg-emerald-500/[0.07]"
                        : iLost
                          ? "border-white/[0.07] bg-white/[0.03]"
                          : "border-white/[0.07] bg-white/[0.03]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold tracking-wide text-white/35 tabular-nums">
                          XO#{c.no}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] uppercase tracking-wide text-white/30 shrink-0">
                            {draw
                              ? tr("Result", "Итог")
                              : tr("Winner", "Победитель")}
                          </span>
                          <span className="text-[12px] font-semibold text-white/80 truncate">
                            {draw ? tr("Draw", "Ничья") : wLabel}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "shrink-0 text-[13px] font-bold tabular-nums tracking-tight",
                          deltaCls
                        )}
                      >
                        {delta}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex -space-x-2">
                        <Avatar
                          name={c.creatorUsername}
                          photoUrl={c.creatorPhotoUrl}
                          size={30}
                          ring={
                            iWon && c.creatorUsername.replace(/^@/, "") === (username || "").replace(/^@/, "")
                              ? "border-emerald-400/80 ring-2 ring-emerald-400/25"
                              : "border-white/15"
                          }
                        />
                        {c.joinerUsername && (
                          <Avatar
                            name={c.joinerUsername}
                            photoUrl={c.joinerPhotoUrl}
                            size={30}
                            ring={
                              iWon &&
                              c.joinerUsername.replace(/^@/, "") ===
                                (username || "").replace(/^@/, "")
                                ? "border-emerald-400/80 ring-2 ring-emerald-400/25"
                                : "border-white/15"
                            }
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-80">
                        <Mark symbol="X" size={14} />
                        <Mark symbol="O" size={14} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── PLAY ── */
  if (view === "play" && active) {
    const board = active.board || [];
    const won = winCells(board);
    const finished = active.status === "finished";
    const iWon = finished && active.winnerTelegramId === telegramId;
    const draw = finished && active.winnerTelegramId == null;

    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        {header}
        <div className="px-4 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar
                name={active.creatorUsername}
                photoUrl={active.creatorPhotoUrl}
                size={36}
                ring={
                  active.turnSymbol === active.creatorSymbol && active.status === "playing"
                    ? "border-cyan-400/60"
                    : undefined
                }
              />
              <div className="min-w-0">
                <div className="text-[12px] font-semibold truncate">
                  @{active.creatorUsername.replace(/^@/, "")}
                </div>
                <div className="mt-0.5 flex items-center">
                  <Mark symbol={active.creatorSymbol} size={16} thick />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center px-2 min-w-[72px]">
              <div className="text-[9px] uppercase tracking-[0.14em] text-white/30 font-medium">
                {tr("Stake", "Ставка")}
              </div>
              <div className="text-[15px] font-bold tabular-nums text-white/85 leading-tight mt-0.5">
                {formatGram(active.amount)}
              </div>
              <div className="text-[9px] text-white/30 font-medium tracking-wide">GRAM</div>
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-row-reverse">
              <Avatar
                name={active.joinerUsername || "?"}
                photoUrl={active.joinerPhotoUrl}
                size={36}
                ring={
                  active.joinerTelegramId &&
                  active.mySymbol &&
                  active.turnSymbol !== active.creatorSymbol &&
                  active.status === "playing"
                    ? "border-cyan-400/60"
                    : undefined
                }
              />
              <div className="min-w-0 text-right">
                <div className="text-[12px] font-semibold truncate">
                  {active.joinerUsername
                    ? `@${active.joinerUsername.replace(/^@/, "")}`
                    : tr("Waiting…", "Ожидание…")}
                </div>
                {active.joinerUsername ? (
                  <div className="mt-0.5 flex items-center justify-end">
                    <Mark
                      symbol={active.creatorSymbol === "X" ? "O" : "X"}
                      size={16}
                      thick
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {active.status === "open" && (
            <div className="mb-3 text-center text-[13px] text-white/45 tracking-wide">
              {tr("Waiting for opponent…", "Ждём соперника…")}
            </div>
          )}

          {active.status === "playing" && (
            <div className="mb-3 text-center text-[12px] text-white/50">
              {active.isMyTurn
                ? tr("Your turn", "Ваш ход")
                : tr("Opponent's turn", "Ход соперника")}
              {turnLeftSec != null && (
                <span className="ml-2 tabular-nums text-white/35">
                  {turnLeftSec}s
                </span>
              )}
            </div>
          )}

          {finished && (
            <div
              className={cn(
                "mb-4 rounded-2xl border px-4 py-3 text-center",
                iWon
                  ? "border-emerald-400/30 bg-emerald-500/10"
                  : draw
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-rose-400/30 bg-rose-500/10"
              )}
            >
              <div className="text-[15px] font-bold">
                {draw
                  ? tr("Draw — stakes returned", "Ничья — ставки возвращены")
                  : iWon
                    ? tr("You won!", "Победа!")
                    : tr("You lost", "Поражение")}
              </div>
              <div
                className={cn(
                  "text-[14px] font-semibold tabular-nums mt-1",
                  iWon ? "text-emerald-300" : draw ? "text-white/50" : "text-rose-300"
                )}
              >
                {iWon
                  ? `+${formatGram(active.potAfterFee || 0)} GRAM`
                  : draw
                    ? `${formatGram(active.amount)} GRAM`
                    : `−${formatGram(active.amount)} GRAM`}
              </div>
            </div>
          )}

          {active.status === "open" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCancel()}
              className="mb-5 w-full h-11 rounded-2xl border border-white/10 text-[13px] text-white/50 btn-press disabled:opacity-40"
            >
              {tr("Cancel game", "Отменить игру")}
            </button>
          )}

          <div className="mx-auto w-full max-w-[320px] grid grid-cols-3 gap-2.5">
            {board.map((cell, i) => {
              const isWin = won.includes(i);
              const canMove =
                active.status === "playing" &&
                active.isMyTurn &&
                !cell &&
                !busy;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!canMove}
                  onClick={() => void onCell(i)}
                  className={cn(
                    "aspect-square rounded-[18px] border flex items-center justify-center transition",
                    isWin
                      ? "border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_24px_rgba(52,211,153,0.2)]"
                      : "border-white/10 bg-white/[0.04]",
                    canMove && "active:scale-95 hover:border-white/20 btn-press"
                  )}
                >
                  <Mark symbol={cell} size={36} glow={isWin} />
                </button>
              );
            })}
          </div>

          {finished && (
            <button
              type="button"
              onClick={() => {
                setActive(null);
                setView("lobby");
                void refresh();
              }}
              className="mt-6 w-full h-12 rounded-2xl font-semibold bg-white/10 border border-white/12 btn-press"
            >
              {tr("Back to lobby", "В лобби")}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── LOBBY ── */
  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {header}
      <div className="px-4 flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            haptic("light");
            setView("create");
          }}
          className="w-full relative overflow-hidden rounded-[22px] mb-4 btn-press active:scale-[0.98] transition-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-rose-600 via-fuchsia-700 to-cyan-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(251,113,133,0.45),transparent_55%)]" />
          <div className="relative px-5 py-4 flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                className="text-white"
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <div className="text-[16px] font-bold text-white tracking-tight">
                {tr("Create game", "Создать игру")}
              </div>
              <div className="text-[12px] text-white/55 mt-0.5">
                {t("createRoomDesc")}
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[11px] uppercase tracking-wider text-white/35">
            {tr("Open tables", "Открытые столы")}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-white/25 tabular-nums">
              {openRooms.length}
            </div>
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setView("history");
              }}
              className="w-8 h-8 rounded-xl glass border border-white/[0.08] flex items-center justify-center text-white/45 hover:text-white/80 transition btn-press"
              aria-label={t("history")}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </button>
          </div>
        </div>

        {loading && openRooms.length === 0 ? (
          <div className="space-y-2">
            <div className="h-[72px] w-full rounded-2xl bg-white/[0.04] animate-pulse" />
            <div className="h-[72px] w-full rounded-2xl bg-white/[0.04] animate-pulse" />
          </div>
        ) : openRooms.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-10 text-center">
            <div className="text-[14px] text-white/45 mb-1">
              {tr("No open tables", "Нет открытых столов")}
            </div>
            <div className="text-[12px] text-white/28">
              {tr("Create a game or wait", "Создай игру или подожди")}
            </div>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {openRooms.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={busy}
                onClick={() => void onJoin(r)}
                className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 flex items-center gap-3 text-left btn-press"
              >
                <Avatar name={r.creatorUsername} photoUrl={r.creatorPhotoUrl} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">
                    @{r.creatorUsername.replace(/^@/, "")}
                  </div>
                  <div className="text-[11px] text-white/40 flex items-center gap-1.5 mt-0.5">
                    <span>{tr("chose", "выбрал")}</span>
                    <Mark symbol={r.creatorSymbol} size={14} thick />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold tabular-nums text-cyan-200">
                    {formatGram(r.amount)}
                  </div>
                  <div className="text-[10px] text-white/30">GRAM</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {mine?.status === "open" && (
          <div className="mb-4 rounded-[20px] border border-fuchsia-400/25 bg-fuchsia-500/[0.08] p-3.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setActive(mine);
                  setView("play");
                  haptic("light");
                }}
                className="w-11 h-11 rounded-2xl bg-fuchsia-500/20 border border-fuchsia-400/30 flex items-center justify-center btn-press"
              >
                <Mark symbol={mine.creatorSymbol} size={22} thick glow />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActive(mine);
                  setView("play");
                  haptic("light");
                }}
                className="flex-1 min-w-0 text-left btn-press"
              >
                <div className="text-[10px] uppercase tracking-wider text-fuchsia-300/70 mb-0.5">
                  {t("yourRoom")}
                </div>
                <div className="text-[15px] font-semibold tabular-nums">
                  {formatGram(mine.amount)}{" "}
                  <span className="text-[11px] text-white/40 font-normal">GRAM</span>
                </div>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void onCancel(mine.id);
                }}
                className="h-9 px-3 rounded-xl text-[12px] font-medium bg-white/5 border border-white/10 text-white/70 hover:text-white btn-press disabled:opacity-40"
              >
                {t("cancel")}
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-2 text-[11px] text-white/35">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              {t("waitingOpponent")}
            </div>
          </div>
        )}


      </div>
    </div>
  );
}

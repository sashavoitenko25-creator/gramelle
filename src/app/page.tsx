"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useProfile } from "@/hooks/useProfile";
import { useHistory } from "@/hooks/useHistory";
import { useRound } from "@/hooks/useRound";
import { PvpScreen } from "@/components/screens/PvpScreen";
import { HistoryScreen } from "@/components/screens/HistoryScreen";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { ReferralsScreen } from "@/components/screens/ReferralsScreen";
import { BottomNav } from "@/components/game/BottomNav";
import { BetModal } from "@/components/modals/BetModal";
import { DepositModal } from "@/components/modals/DepositModal";
import { HowRefModal } from "@/components/modals/HowRefModal";
import { Toast } from "@/components/ui/Toast";
import { placeBetApi } from "@/lib/api";
import {
  MIN_BET,
  SPIN_FINISH_DELAY_MS,
  MAX_PLAYERS,
  BOT_USERNAME,
  ROUND_COUNTDOWN_SEC,
  ROOMS,
  DEFAULT_ROOM,
  type RoomMode,
} from "@/lib/constants";
import { randomColor } from "@/lib/utils";
import type { Player, Screen } from "@/lib/types";

export default function Home() {
  const {
    username: tgUsername,
    telegramId,
    isReady,
    startParam,
    haptic,
    hapticSuccess,
    hapticError,
    openStarsInvoice,
    openLink,
  } = useTelegram();

  const {
    profile,
    balance,
    saveBalance,
    setBalanceFromServer,
    username,
    loading: profileLoading,
    serverMode,
    reload: reloadProfile,
  } = useProfile({
    username: tgUsername,
    telegramId,
    isReady,
    startParam,
  });

  const { history, saveItem } = useHistory();

  const [mode, setMode] = useState<RoomMode>(DEFAULT_ROOM);

  const {
    players,
    setPlayers,
    rollId,
    setRollId,
    roundStatus,
    countdownEndsAt,
    pendingSpin,
    clearPendingSpin,
    applyServerBets,
    triggerSpin,
    clearRound,
    refresh: refreshRound,
    serverSeedHash,
  } = useRound(telegramId, username, mode);

  const [screen, setScreen] = useState<Screen>("pvp");
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinDegrees, setSpinDegrees] = useState(0);
  const [status, setStatus] = useState("Waiting");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [betOpen, setBetOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [howRefOpen, setHowRefOpen] = useState(false);

  const playersRef = useRef(players);
  const spinningRef = useRef(isSpinning);
  const balanceRef = useRef(balance);
  const rollIdRef = useRef(rollId);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinStartedFor = useRef<number | null>(null);

  playersRef.current = players;
  spinningRef.current = isSpinning;
  balanceRef.current = balance;
  rollIdRef.current = rollId;

  const showToast = useCallback((msg: string) => setToast(msg), []);
  const online = players.length;

  const clearCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    setCountdown(null);
  }, []);

  // Server countdown display
  useEffect(() => {
    if (!countdownEndsAt || isSpinning) return;
    const tick = () => {
      const left = Math.ceil(
        (new Date(countdownEndsAt).getTime() - Date.now()) / 1000
      );
      if (left <= 0) {
        setCountdown(0);
        setStatus("Spinning");
      } else {
        setCountdown(left);
        setStatus("Starting");
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [countdownEndsAt, isSpinning]);

  // Handle server-authoritative spin result
  useEffect(() => {
    if (!pendingSpin || spinningRef.current) return;
    const { spinDegrees: deg, winnerTelegramId, winnerUsername, mult, total, potAfterFee } =
      pendingSpin;

    setIsSpinning(true);
    setStatus("Spinning");
    setSpinDegrees(deg);
    haptic("medium");
    clearCountdown();

    const list = playersRef.current;
    const winner =
      list.find((p) => p.telegramId === winnerTelegramId) ||
      list.find((p) => p.isMe && winnerTelegramId === telegramId);

    setTimeout(async () => {
      setIsSpinning(false);
      setStatus("Waiting");
      const isMe = winnerTelegramId === telegramId;

      if (isMe) {
        hapticSuccess();
        showToast("You won " + (potAfterFee ?? total).toFixed(2) + " GRAM · x" + mult);
        await reloadProfile();
      } else {
        haptic("medium");
        showToast("@" + winnerUsername + " won " + total.toFixed(2) + " GRAM");
        await reloadProfile();
      }

      await saveItem({
        id: rollIdRef.current,
        winner: isMe ? "You" : winnerUsername,
        chance: winner
          ? +((winner.amount / total) * 100).toFixed(2)
          : 0,
        win: total,
        mult,
        bet: winner?.amount || 0,
        time: new Date(),
        type: "Classic",
        isMe,
      });

      clearPendingSpin();
      clearRound(rollIdRef.current + 1);
      setSpinDegrees(0);
      setTimeout(() => refreshRound(), 500);
    }, SPIN_FINISH_DELAY_MS);
  }, [
    pendingSpin,
    telegramId,
    haptic,
    hapticSuccess,
    showToast,
    reloadProfile,
    saveItem,
    clearPendingSpin,
    clearRound,
    refreshRound,
    clearCountdown,
  ]);

  // Demo-mode local spin (when server not available)
  const finishRoundLocal = useCallback(
    async (winner: Player, total: number, currentRollId: number) => {
      setIsSpinning(false);
      setStatus("Waiting");
      clearCountdown();
      spinStartedFor.current = null;

      const mult = +(total / winner.amount).toFixed(2);
      const winAmount = +total.toFixed(2);

      if (winner.isMe) {
        const newBal = +(balanceRef.current + winAmount).toFixed(2);
        await saveBalance(newBal);
        hapticSuccess();
        showToast("You won " + winAmount.toFixed(2) + " GRAM · x" + mult);
      } else {
        haptic("medium");
        showToast("@" + winner.name + " won " + winAmount.toFixed(2) + " GRAM");
      }

      await saveItem({
        id: currentRollId,
        winner: winner.isMe ? "You" : winner.name,
        chance: +((winner.amount / total) * 100).toFixed(2),
        win: winAmount,
        mult,
        bet: winner.amount,
        time: new Date(),
        type: "Classic",
        isMe: winner.isMe,
      });

      setPlayers([]);
      setRollId(currentRollId + 1);
      setSpinDegrees(0);
    },
    [saveBalance, saveItem, showToast, haptic, hapticSuccess, clearCountdown, setPlayers, setRollId]
  );

  const startSpinLocal = useCallback(() => {
    const list = playersRef.current;
    const rid = rollIdRef.current;
    if (spinningRef.current || list.length < 2) return;
    if (spinStartedFor.current === rid) return;
    spinStartedFor.current = rid;

    clearCountdown();
    setIsSpinning(true);
    setStatus("Spinning");
    haptic("medium");

    const total = list.reduce((s, p) => s + p.amount, 0);
    let r = Math.random() * total;
    let winner = list[0];
    for (const p of list) {
      r -= p.amount;
      if (r <= 0) {
        winner = p;
        break;
      }
    }

    let acc = 0;
    let winnerStart = 0;
    let winnerSize = 0;
    for (const p of list) {
      const size = (p.amount / total) * 360;
      if (p.id === winner.id) {
        winnerStart = acc;
        winnerSize = size;
        break;
      }
      acc += size;
    }
    const mid = winnerStart + winnerSize / 2;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const finalDeg = extraSpins * 360 + (360 - mid) + (Math.random() * 8 - 4);
    setSpinDegrees(finalDeg);

    setTimeout(() => finishRoundLocal(winner, total, rid), SPIN_FINISH_DELAY_MS);
  }, [finishRoundLocal, haptic, clearCountdown]);

  // Demo countdown
  useEffect(() => {
    if (serverMode) return;
    if (players.length >= 2 && !isSpinning) {
      if (countdownTimer.current) return;
      setStatus("Starting");
      setCountdown(ROUND_COUNTDOWN_SEC);
      let left = ROUND_COUNTDOWN_SEC;
      countdownTimer.current = setInterval(() => {
        left -= 1;
        setCountdown(left);
        if (left <= 0) {
          clearCountdown();
          startSpinLocal();
        }
      }, 1000);
    } else if (players.length < 2) {
      clearCountdown();
      if (!isSpinning) setStatus("Waiting");
    }
  }, [players.length, isSpinning, serverMode, clearCountdown, startSpinLocal]);

  // Server: try spin when countdown hits 0
  useEffect(() => {
    if (!serverMode || !countdownEndsAt || isSpinning) return;
    const left = new Date(countdownEndsAt).getTime() - Date.now();
    if (left > 0) {
      const t = setTimeout(() => {
        triggerSpin().catch(() => refreshRound());
      }, left + 200);
      return () => clearTimeout(t);
    }
  }, [serverMode, countdownEndsAt, isSpinning, triggerSpin, refreshRound]);

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  const confirmBet = useCallback(
    async (amount: number) => {
      const roomMin = ROOMS[mode].minBet;
      const roomMax = ROOMS[mode].maxBet;
      if (isNaN(amount) || amount < roomMin) {
        showToast("Min bet " + roomMin + " GRAM");
        return;
      }
      if (amount > roomMax) {
        showToast("Max bet " + roomMax + " GRAM");
        return;
      }
      if (amount > balanceRef.current) {
        showToast("Not enough balance");
        return;
      }
      if (spinningRef.current) {
        showToast("Wait for the round to finish");
        return;
      }

      // Server-authoritative bet
      if (serverMode) {
        try {
          const color = randomColor(playersRef.current.map((p) => p.color));
          const res = await placeBetApi(amount, color, mode);
          setBalanceFromServer(res.balance);
          applyServerBets(
            res.bets,
            res.round.rollId,
            res.round.status,
            res.round.countdownEndsAt
          );
          setBetOpen(false);
          haptic("light");
          showToast("Bet placed");
        } catch (e) {
          hapticError();
          showToast(e instanceof Error ? e.message : "Bet failed");
        }
        return;
      }

      // Demo local
      if (
        playersRef.current.length >= MAX_PLAYERS &&
        !playersRef.current.some((p) => p.isMe)
      ) {
        showToast("Round is full");
        return;
      }

      const newBal = +(balanceRef.current - amount).toFixed(2);
      await saveBalance(newBal);
      haptic("light");

      setPlayers((prev) => {
        const me = prev.find((p) => p.isMe);
        if (me) {
          return prev.map((p) =>
            p.isMe ? { ...p, amount: +(p.amount + amount).toFixed(2) } : p
          );
        }
        return [
          ...prev,
          {
            id: telegramId || Date.now(),
            name: username,
            amount,
            color: randomColor(prev.map((p) => p.color)),
            isMe: true,
            telegramId,
          },
        ];
      });

      setBetOpen(false);
      showToast("Bet placed");
    },
    [
      serverMode,
      mode,
      saveBalance,
      setBalanceFromServer,
      applyServerBets,
      setPlayers,
      username,
      telegramId,
      showToast,
      haptic,
      hapticError,
    ]
  );

  const doCredit = useCallback(
    async (gram: number) => {
      if (serverMode) {
        await reloadProfile();
        return;
      }
      const newBal = +(balanceRef.current + gram).toFixed(2);
      await saveBalance(newBal);
    },
    [serverMode, reloadProfile, saveBalance]
  );

  const copyRefLink = useCallback(() => {
    const code = username.toLowerCase().replace(/\s+/g, "");
    const link = "https://t.me/" + BOT_USERNAME + "?start=ref_" + code;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(link)
        .then(() => {
          hapticSuccess();
          showToast("Link copied");
        })
        .catch(() => showToast(link));
    } else {
      showToast(link);
    }
  }, [username, showToast, hapticSuccess]);

  const displayStatus =
    countdown !== null && countdown > 0
      ? String(countdown)
      : isSpinning
        ? "Spinning"
        : status;

  if (profileLoading) {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center pulse-soft">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-cyan-400/70">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18M3 12h18" opacity="0.4" />
            </svg>
          </div>
          <div className="text-white/30 text-xs tracking-wider uppercase">Loading</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {screen === "pvp" && (
        <PvpScreen
          players={players}
          balance={balance}
          online={online}
          rollId={rollId}
          isSpinning={isSpinning}
          spinDegrees={spinDegrees}
          status={displayStatus}
          mode={mode}
          onModeChange={(m) => {
            if (!isSpinning) {
              haptic("light");
              setMode(m);
            }
          }}
          serverSeedHash={serverSeedHash}
          onOpenBet={() => {
            haptic("light");
            setBetOpen(true);
          }}
          onOpenDeposit={() => {
            haptic("light");
            setDepositOpen(true);
          }}
          onOpenHistory={() => setScreen("history")}
        />
      )}

      {screen === "history" && (
        <HistoryScreen history={history} onBack={() => setScreen("pvp")} />
      )}

      {screen === "profile" && (
        <ProfileScreen
          username={username}
          balance={balance}
          onDeposit={() => {
            haptic("light");
            setDepositOpen(true);
          }}
          onReferrals={() => setScreen("referrals")}
        />
      )}

      {screen === "referrals" && (
        <ReferralsScreen
          earned={profile?.ref_earned ?? 0}
          count={profile?.ref_count ?? 0}
          username={username}
          onBack={() => setScreen("profile")}
          onHowItWorks={() => setHowRefOpen(true)}
          onCopy={copyRefLink}
        />
      )}

      <BottomNav
        screen={screen}
        onChange={(s) => {
          haptic("light");
          setScreen(s);
        }}
      />

      <BetModal
        open={betOpen}
        balance={balance}
        minBet={ROOMS[mode].minBet}
        maxBet={ROOMS[mode].maxBet}
        onClose={() => setBetOpen(false)}
        onConfirm={confirmBet}
      />

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onCredit={doCredit}
        telegramId={telegramId}
        username={username}
        openStarsInvoice={openStarsInvoice}
        openLink={openLink}
        haptic={haptic}
        hapticSuccess={hapticSuccess}
        hapticError={hapticError}
        showToast={showToast}
        serverMode={serverMode}
        onBalanceRefresh={reloadProfile}
      />

      <HowRefModal
        open={howRefOpen}
        onClose={() => setHowRefOpen(false)}
        onCopy={copyRefLink}
      />

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

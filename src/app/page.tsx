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
import { WinOverlay } from "@/components/ui/WinOverlay";
import { RecentRounds } from "@/components/game/RecentRounds";
import { Confetti } from "@/components/ui/Confetti";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { VerifyModal } from "@/components/modals/VerifyModal";
import { playSpinSound, playWinSound, playLoseSound } from "@/lib/sounds";
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

  const { history, saveItem } = useHistory(telegramId);

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
    setAnimating,
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
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyRollId, setVerifyRollId] = useState<number | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [winOverlay, setWinOverlay] = useState<{
    open: boolean;
    isWin: boolean;
    title: string;
    subtitle: string;
  }>({ open: false, isWin: false, title: "", subtitle: "" });
  const [onboarded, setOnboarded] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("gramelle_onboarded") === "1";
  });

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
    setAnimating(true);
    setStatus("Spinning");
    setSpinDegrees(deg);
    haptic("medium");
    playSpinSound();
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
        playWinSound();
        setConfetti(true);
        setTimeout(() => setConfetti(false), 2400);
        showToast("You won " + (potAfterFee ?? total).toFixed(2) + " GRAM · x" + mult);
        setWinOverlay({
          open: true,
          isWin: true,
          title: "You won!",
          subtitle: (potAfterFee ?? total).toFixed(2) + " GRAM · x" + mult,
        });
        await reloadProfile();
      } else {
        haptic("medium");
        playLoseSound();
        showToast("@" + winnerUsername + " won " + (potAfterFee ?? total).toFixed(2) + " GRAM");
        setWinOverlay({
          open: true,
          isWin: false,
          title: "@" + winnerUsername + " won",
          subtitle: (potAfterFee ?? total).toFixed(2) + " GRAM",
        });
        await reloadProfile();
      }
      setAnimating(false);

      await saveItem({
        id: rollIdRef.current,
        winner: isMe ? "You" : winnerUsername,
        chance: winner
          ? +((winner.amount / total) * 100).toFixed(2)
          : 0,
        win: potAfterFee ?? total,
        mult,
        bet: winner?.amount || 0,
        time: new Date(),
        type: "PvP",
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
    setAnimating,
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
    playSpinSound();

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
      <div className="min-h-screen app-bg px-4 pt-8 safe-top">
        <div className="flex items-center justify-between mb-6">
          <div className="skeleton h-8 w-28" />
          <div className="skeleton h-7 w-16 rounded-full" />
        </div>
        <div className="skeleton h-10 w-full rounded-2xl mb-4" />
        <div className="skeleton h-[260px] w-[260px] mx-auto rounded-full mb-6" />
        <div className="skeleton h-14 w-full rounded-2xl mb-3" />
        <div className="skeleton h-12 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full">
      {!serverMode && (
        <div className="mx-4 mt-2 mb-1 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-200/90 text-center">
          Demo mode — balances are local only. Open inside Telegram with server configured for real play.
        </div>
      )}

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
          onOpenVerify={() => {
            haptic("light");
            setVerifyRollId(rollId > 0 ? rollId - 1 : null);
            setVerifyOpen(true);
          }}
          onVerifyRoll={(id) => {
            setVerifyRollId(id);
            setVerifyOpen(true);
          }}
        />
      )}

      {screen === "history" && (
        <HistoryScreen
          history={history}
          onBack={() => setScreen("pvp")}
          onVerify={(id) => {
            setVerifyRollId(id);
            setVerifyOpen(true);
          }}
        />
      )}

      {screen === "profile" && (
        <ProfileScreen
          username={username}
          balance={balance}
          photoUrl={profile?.photo_url}
          wins={profile?.wins}
          games={profile?.games}
          biggestWin={profile?.biggest_win}
          onDeposit={() => {
            haptic("light");
            setDepositOpen(true);
          }}
          onWithdraw={() => {
            haptic("light");
            setWithdrawOpen(true);
          }}
          onReferrals={() => setScreen("referrals")}
        />
      )}

      {screen === "referrals" && (
        <ReferralsScreen
          earned={profile?.ref_earned ?? 0}
          count={profile?.ref_count ?? 0}
          active={(profile as { ref_active?: number })?.ref_active ?? 0}
          turnover={(profile as { ref_turnover?: number })?.ref_turnover ?? 0}
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

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        balance={balance}
        serverMode={serverMode}
        onDone={(b) => {
          if (typeof b === "number") setBalanceFromServer(b);
          else reloadProfile();
        }}
        showToast={showToast}
        haptic={haptic}
        hapticSuccess={hapticSuccess}
        hapticError={hapticError}
      />

      <VerifyModal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        initialRollId={verifyRollId ?? (rollId > 0 ? rollId - 1 : null)}
      />

      
      

      <WinOverlay
        open={winOverlay.open}
        isWin={winOverlay.isWin}
        title={winOverlay.title}
        subtitle={winOverlay.subtitle}
        onClose={() => setWinOverlay((s) => ({ ...s, open: false }))}
      />

      <Confetti active={confetti} />

      {!onboarded && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center modal-backdrop">
          <div className="w-full max-w-md glass-strong rounded-t-3xl p-6 slide-up border-t border-white/10 safe-bottom">
            <h3 className="text-xl font-semibold tracking-tight mb-2">How it works</h3>
            <div className="space-y-3 mb-5 text-sm text-white/70">
              <p><span className="text-cyan-300 font-medium">1. Bet</span> — put GRAM into the round bank</p>
              <p><span className="text-cyan-300 font-medium">2. Chance</span> — your share of the bank is your win chance</p>
              <p><span className="text-cyan-300 font-medium">3. Spin</span> — winner takes the pot (minus 5% house)</p>
            </div>
            <button
              className="w-full h-12 rounded-2xl btn-primary text-sm btn-press"
              onClick={() => {
                localStorage.setItem("gramelle_onboarded", "1");
                setOnboarded(true);
                haptic("light");
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

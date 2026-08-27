"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useProfile } from "@/hooks/useProfile";
import { useHistory } from "@/hooks/useHistory";
import { PvpScreen } from "@/components/screens/PvpScreen";
import { HistoryScreen } from "@/components/screens/HistoryScreen";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { ReferralsScreen } from "@/components/screens/ReferralsScreen";
import { BottomNav } from "@/components/game/BottomNav";
import { BetModal } from "@/components/modals/BetModal";
import { DepositModal } from "@/components/modals/DepositModal";
import { HowRefModal } from "@/components/modals/HowRefModal";
import { Toast } from "@/components/ui/Toast";
import {
  BOT_NAMES,
  MIN_BET,
  SPIN_FINISH_DELAY_MS,
} from "@/lib/constants";
import { randomColor } from "@/lib/utils";
import type { Player, Screen } from "@/lib/types";

export default function Home() {
  const { username: tgUsername, telegramId, isReady, close } = useTelegram();
  const {
    profile,
    balance,
    saveBalance,
    username,
    loading: profileLoading,
  } = useProfile({
    username: tgUsername,
    telegramId,
    isReady,
  });
  const { history, saveItem } = useHistory();

  const [screen, setScreen] = useState<Screen>("pvp");
  const [players, setPlayers] = useState<Player[]>([]);
  const [rollId, setRollId] = useState(624900);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinDegrees, setSpinDegrees] = useState(0);
  const [status, setStatus] = useState("Waiting");
  const [online, setOnline] = useState(72);
  const [toast, setToast] = useState<string | null>(null);
  const [betOpen, setBetOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [howRefOpen, setHowRefOpen] = useState(false);

  const playersRef = useRef(players);
  const spinningRef = useRef(isSpinning);
  playersRef.current = players;
  spinningRef.current = isSpinning;

  const showToast = useCallback((msg: string) => setToast(msg), []);

  useEffect(() => {
    const id = setInterval(() => {
      setOnline(60 + Math.floor(Math.random() * 40));
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const finishRound = useCallback(
    async (winner: Player, total: number, currentRollId: number) => {
      setIsSpinning(false);
      setStatus("Waiting");

      const mult = +(total / winner.amount).toFixed(2);
      const winAmount = +total.toFixed(2);

      if (winner.isMe) {
        const newBal = +(balance + winAmount).toFixed(2);
        await saveBalance(newBal);
        showToast("You won " + winAmount.toFixed(2) + " GRAM! x" + mult);
      } else {
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
      setRollId((r) => r + 1);
      setSpinDegrees(0);
    },
    [balance, saveBalance, saveItem, showToast]
  );

  const startSpin = useCallback(() => {
    const list = playersRef.current;
    if (spinningRef.current || list.length < 2) return;

    setIsSpinning(true);
    setStatus("Spinning...");

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
      if (p === winner) {
        winnerStart = acc;
        winnerSize = size;
        break;
      }
      acc += size;
    }

    const mid = winnerStart + winnerSize / 2;
    const extraSpins = 4 + Math.floor(Math.random() * 3);
    const finalDeg = extraSpins * 360 + (360 - mid);

    setSpinDegrees(finalDeg);

    const currentRoll = rollId;
    setTimeout(() => {
      finishRound(winner, total, currentRoll);
    }, SPIN_FINISH_DELAY_MS);
  }, [rollId, finishRound]);

  const maybeStartRound = useCallback(() => {
    if (playersRef.current.length < 2 || spinningRef.current) return;
    if (Math.random() > 0.3) startSpin();
  }, [startSpin]);

  const addBot = useCallback(() => {
    if (spinningRef.current || playersRef.current.length >= 8) return;
    const name =
      BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] +
      Math.floor(Math.random() * 90);
    const amount = +(0.5 + Math.random() * 15).toFixed(2);
    const used = playersRef.current.map((p) => p.color);

    setPlayers((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        name,
        amount,
        color: randomColor(used),
        isMe: false,
      },
    ]);

    setTimeout(() => maybeStartRound(), 1800);
  }, [maybeStartRound]);

  const confirmBet = useCallback(
    async (amount: number) => {
      if (isNaN(amount) || amount < MIN_BET) {
        showToast("Min bet 0.1 GRAM");
        return;
      }
      if (amount > balance) {
        showToast("Not enough balance");
        return;
      }

      const newBal = +(balance - amount).toFixed(2);
      await saveBalance(newBal);

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
            id: Date.now(),
            name: username,
            amount,
            color: randomColor(prev.map((p) => p.color)),
            isMe: true,
          },
        ];
      });

      setBetOpen(false);
      showToast("Bet placed!");

      setTimeout(() => {
        if (playersRef.current.length < 5 && Math.random() > 0.35) {
          addBot();
        }
      }, 700 + Math.random() * 1800);

      setTimeout(() => maybeStartRound(), 2200);
    },
    [balance, saveBalance, username, showToast, addBot, maybeStartRound]
  );

  const doDeposit = useCallback(
    async (amount: number) => {
      const newBal = +(balance + amount).toFixed(2);
      await saveBalance(newBal);
      setDepositOpen(false);
      showToast("+" + amount + " GRAM deposited");
    },
    [balance, saveBalance, showToast]
  );

  const copyRefLink = useCallback(() => {
    const link =
      "https://t.me/share/url?url=https://t.me/Gramelle_bot?start=ref_" +
      username.toLowerCase();
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(link)
        .then(() => showToast("Link copied!"))
        .catch(() => showToast(link));
    } else {
      showToast(link);
    }
  }, [username, showToast]);

  if (profileLoading) {
    return (
      <div className="min-h-screen starfield flex items-center justify-center">
        <div className="text-white/50 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen starfield overflow-hidden">
      {screen === "pvp" && (
        <PvpScreen
          players={players}
          balance={balance}
          online={online}
          rollId={rollId}
          isSpinning={isSpinning}
          spinDegrees={spinDegrees}
          status={status}
          onOpenBet={() => setBetOpen(true)}
          onOpenDeposit={() => setDepositOpen(true)}
          onOpenHistory={() => setScreen("history")}
          onClose={close}
        />
      )}

      {screen === "history" && (
        <HistoryScreen history={history} onBack={() => setScreen("pvp")} />
      )}

      {screen === "profile" && (
        <ProfileScreen
          username={username}
          balance={balance}
          onDeposit={() => setDepositOpen(true)}
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

      <BottomNav screen={screen} onChange={setScreen} />

      <BetModal
        open={betOpen}
        balance={balance}
        onClose={() => setBetOpen(false)}
        onConfirm={confirmBet}
      />
      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onDeposit={doDeposit}
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

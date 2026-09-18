"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useProfile } from "@/hooks/useProfile";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { ReferralsScreen } from "@/components/screens/ReferralsScreen";
import { TransactionsScreen } from "@/components/screens/TransactionsScreen";
import { TasksScreen } from "@/components/screens/TasksScreen";
import { GamesScreen } from "@/components/screens/GamesScreen";
import { PlayHubScreen } from "@/components/screens/PlayHubScreen";
import { ModeSoonScreen } from "@/components/screens/ModeSoonScreen";
import { RouletteScreen } from "@/components/screens/RouletteScreen";
import { PvpRouletteScreen } from "@/components/screens/PvpRouletteScreen";
import { LiveHubScreen } from "@/components/screens/LiveHubScreen";
import { fetchRouletteState } from "@/lib/rouletteApi";
import { fetchPvpRouletteState } from "@/lib/pvpRouletteApi";
import { RpsScreen } from "@/components/screens/RpsScreen";
import { DiceScreen } from "@/components/screens/DiceScreen";
import { XoScreen } from "@/components/screens/XoScreen";
import { FairnessScreen } from "@/components/screens/FairnessScreen";
import { MaintenanceScreen } from "@/components/screens/MaintenanceScreen";
import { BottomNav } from "@/components/game/BottomNav";
import { DepositModal } from "@/components/modals/DepositModal";
import { HowRefModal } from "@/components/modals/HowRefModal";
import { Toast } from "@/components/ui/Toast";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { BOT_USERNAME, SUPPORT_URL, MAINTENANCE_MODE, isMaintenanceBypass } from "@/lib/constants";
import type { Screen } from "@/lib/types";
import { withdrawReferralSavings, checkTonDeposits } from "@/lib/api";
import { rpsList } from "@/lib/rpsApi";
import { diceList } from "@/lib/diceApi";
import { xoList } from "@/lib/xoApi";
import { useI18n } from "@/lib/i18n/context";
import { playSuccessSound, playErrorSound, resumeAudio } from "@/lib/sounds";

export default function Home() {
  const { t, lang } = useI18n();
  const {
    username: tgUsername,
    telegramId,
    isReady,
    startParam,
    haptic,
    hapticSuccess,
    hapticError,
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

  const [screen, setScreen] = useState<Screen>("games");
  const [refWithdrawing, setRefWithdrawing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);
  const [howRefOpen, setHowRefOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(() => {
    if (typeof window === "undefined") return true;
    // v2 — soft-launch rules + 18+ checkbox
    return localStorage.getItem("gramelle_onboarded_v2") === "1";
  });
  const [ageOk, setAgeOk] = useState(false);
  const [fairnessPrefill, setFairnessPrefill] = useState<{
    hash: string;
    seed: string;
  } | null>(null);
  const [fairnessReturn, setFairnessReturn] = useState<Screen>("profile");

  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  const showToast = useCallback((msg: string) => setToast(msg), []);


  // Online: RPS and Dice separate; top bar = sum (same user in both = 2)
  const [rpsOnline, setRpsOnline] = useState(0);
  const [diceOnline, setDiceOnline] = useState(0);
  const [xoOnline, setXoOnline] = useState(0);
  const [liveOnline, setLiveOnline] = useState(0);
  const [pvpRouletteOnline, setPvpRouletteOnline] = useState(0);

  useEffect(() => {
    if (!isReady) return;
    let stopped = false;
    const tick = async () => {
      try {
        const [rps, dice, xo] = await Promise.all([
          rpsList().catch(() => null),
          diceList().catch(() => null),
          xoList().catch(() => null),
        ]);
        if (stopped) return;

        const rpsIds = new Set<number>();
        for (const r of rps?.rooms || []) {
          if (r.creatorTelegramId) rpsIds.add(r.creatorTelegramId);
          if (r.joinerTelegramId) rpsIds.add(r.joinerTelegramId);
        }
        if (rps?.mine) {
          if (rps.mine.creatorTelegramId) rpsIds.add(rps.mine.creatorTelegramId);
          if (rps.mine.joinerTelegramId) rpsIds.add(rps.mine.joinerTelegramId);
        }

        const diceIds = new Set<number>();
        for (const r of dice?.rooms || []) {
          if (r.status !== "open" && r.status !== "playing") continue;
          for (const pl of r.players || []) diceIds.add(pl.telegramId);
        }
        if (dice?.mine && (dice.mine.status === "open" || dice.mine.status === "playing")) {
          for (const pl of dice.mine.players || []) diceIds.add(pl.telegramId);
        }

        const xoIds = new Set<number>();
        for (const r of xo?.rooms || []) {
          if (r.creatorTelegramId) xoIds.add(r.creatorTelegramId);
          if (r.joinerTelegramId) xoIds.add(r.joinerTelegramId);
        }
        if (xo?.mine) {
          if (xo.mine.creatorTelegramId) xoIds.add(xo.mine.creatorTelegramId);
          if (xo.mine.joinerTelegramId) xoIds.add(xo.mine.joinerTelegramId);
        }

        const rpsN = rpsIds.size;
        const diceN = diceIds.size;
        const xoN = xoIds.size;
        setRpsOnline(rpsN);
        setDiceOnline(diceN);
        setXoOnline(xoN);

        let liveN = 0;
        try {
          const live = await fetchRouletteState();
          liveN = Number(live?.online) || 0;
          setLiveOnline(liveN);
        } catch {
          /* keep */
        }

        let pvpN = 0;
        try {
          const pvp = await fetchPvpRouletteState();
          pvpN = Number(pvp?.online) || 0;
          setPvpRouletteOnline(pvpN);
        } catch {
          /* keep */
        }

        setOnlineCount(rpsN + diceN + xoN + liveN + pvpN);
      } catch {
        /* keep */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [isReady]);

  // Background TON deposit check
  useEffect(() => {
    if (!serverMode || !isReady) return;
    let stopped = false;
    const run = async () => {
      if (stopped) return;
      try {
        const res = await checkTonDeposits();
        if (stopped) return;
        if (res.credited?.length) {
          await reloadProfile();
        }
      } catch {
        /* ignore */
      }
    };
    void run();
    const id = setInterval(() => void run(), 45_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [serverMode, isReady, reloadProfile]);

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
    const code =
      profile?.referral_code ||
      ("ref_" + username.toLowerCase().replace(/\s+/g, ""));
    const start = code.startsWith("ref_") ? code : "ref_" + code;
    const link = "https://t.me/" + BOT_USERNAME + "?start=" + start;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(link)
        .then(() => {
          hapticSuccess();
          showToast(t("linkCopied"));
        })
        .catch(() => showToast(link));
    } else {
      showToast(link);
    }
  }, [profile?.referral_code, username, showToast, hapticSuccess, t]);

  const doReferralWithdraw = useCallback(async () => {
    if (!serverMode) {
      showToast(t("availableInTelegram"));
      return;
    }
    setRefWithdrawing(true);
    resumeAudio();
    try {
      const res = await withdrawReferralSavings();
      if (res.ok) {
        setBalanceFromServer(res.balance);
        await reloadProfile();
        playSuccessSound();
        showToast(t("withdrawnAmount", { n: res.withdrawn }));
        hapticSuccess();
      }
    } catch (e) {
      playErrorSound();
      showToast(e instanceof Error ? e.message : t("withdrawFailed"));
      hapticError();
    } finally {
      setRefWithdrawing(false);
    }
  }, [
    serverMode,
    showToast,
    hapticSuccess,
    hapticError,
    reloadProfile,
    setBalanceFromServer,
    t,
  ]);

  // Brief skeleton only while first paint — hard-capped in useProfile
  if (profileLoading && !profile) {
    return (
      <div className="min-h-screen app-bg px-4 pt-8 safe-top">
        <div className="flex items-center justify-between mb-6">
          <div className="skeleton h-8 w-28" />
          <div className="skeleton h-7 w-16 rounded-full" />
        </div>
        <div className="skeleton h-10 w-full rounded-2xl mb-4" />
        <div className="skeleton h-[260px] w-full rounded-2xl mb-6" />
        <div className="skeleton h-14 w-full rounded-2xl mb-3" />
        <div className="skeleton h-12 w-full rounded-2xl" />
      </div>
    );
  }

  // Maintenance: only after we know telegramId (avoid false block before TG user loads)
  if (MAINTENANCE_MODE) {
    if (!isReady || telegramId == null) {
      return (
        <div className="min-h-screen app-bg px-4 pt-8 safe-top flex items-center justify-center">
          <div className="text-sm text-white/45 text-center px-6">
            Open Gramelle from Telegram…
          </div>
        </div>
      );
    }
    if (!isMaintenanceBypass(telegramId)) {
      return <MaintenanceScreen />;
    }
  }

  return (
    <div className="relative min-h-[100dvh] w-full">
      {/* Global online — top center, level with TG close / collapse / menu */}
      <div className="app-top-online">
        <div className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-black/45 border border-white/15 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            {onlineCount > 0 ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/40" />
            )}
          </span>
          <span className="text-[11px] font-semibold text-white/90 tabular-nums leading-none">
            {onlineCount > 99 ? "99+" : onlineCount}{" "}
            <span className="font-medium text-white/55">{t("online")}</span>
          </span>
        </div>
      </div>

      {!profileLoading && !serverMode && (
        <div className="mx-4 mt-2 mb-1 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-200/90 text-center">
          {t("demoMode")} configured for real play.
        </div>
      )}

      {screen === "games" && (
        <PlayHubScreen
          rpsOnline={rpsOnline}
          diceOnline={diceOnline}
          xoOnline={xoOnline}
          onSelectPvp={() => {
            haptic("light");
            setScreen("pvp");
          }}
          onSelectLive={() => {
            haptic("light");
            setScreen("live");
          }}
          liveOnline={liveOnline}
        />
      )}

      {screen === "pvp" && (
        <GamesScreen
          onSelectPvpRoulette={() => {
            haptic("light");
            setScreen("pvp_roulette");
          }}
          pvpRouletteOnline={pvpRouletteOnline}
          
          rpsOnline={rpsOnline}
          diceOnline={diceOnline}
          onBack={() => setScreen("games")}
          onSelectRps={() => {
            haptic("light");
            setScreen("rps");
          }}
          onSelectDice={() => {
            haptic("light");
            setScreen("dice");
          }}
          xoOnline={xoOnline}
          onSelectXo={() => {
            haptic("light");
            setScreen("xo");
          }}
        />
      )}

      {screen === "live" && (
        <LiveHubScreen
          liveOnline={liveOnline}
          onBack={() => setScreen("games")}
          onSelectRoulette={() => {
            haptic("light");
            setScreen("roulette");
          }}
/>
      )}

      {screen === "solo" && (
        <ModeSoonScreen mode="solo" onBack={() => setScreen("games")} />
      )}

      {screen === "roulette" && telegramId != null && (
        <RouletteScreen
          balance={balance}
          telegramId={telegramId}
          username={username}
          photoUrl={profile?.photo_url}
          onBack={() => setScreen("live")}
          onBalanceUpdate={(b) => setBalanceFromServer(b)}
          onDeposit={() => {
            haptic("light");
            setDepositOpen(true);
          }}
          haptic={haptic}
          hapticSuccess={hapticSuccess}
          hapticError={hapticError}
          showToast={showToast}
        />
      )}

      {screen === "pvp_roulette" && telegramId != null && (
        <PvpRouletteScreen
          balance={balance}
          telegramId={telegramId}
          username={username}
          photoUrl={profile?.photo_url}
          onBack={() => setScreen("pvp")}
          onBalanceUpdate={(b) => setBalanceFromServer(b)}
          onReloadBalance={() => reloadProfile()}
          onDeposit={() => {
            haptic("light");
            setDepositOpen(true);
          }}
          haptic={haptic}
          hapticSuccess={hapticSuccess}
          hapticError={hapticError}
          showToast={showToast}
        />
      )}

      {screen === "rps" && (
        <RpsScreen
          balance={balance}
          telegramId={telegramId}
          username={username}
          photoUrl={profile?.photo_url}
          serverMode={serverMode}
          onBack={() => setScreen("pvp")}
          onDeposit={() => {
            haptic("light");
            setDepositOpen(true);
          }}
          onBalanceUpdate={(b) => {
            setBalanceFromServer(b);
          }}
          onReloadBalance={() => {
            void reloadProfile();
            setTimeout(() => void reloadProfile(), 500);
            setTimeout(() => void reloadProfile(), 1500);
          }}
          showToast={showToast}
          haptic={haptic}
          hapticSuccess={hapticSuccess}
          hapticError={hapticError}
          onVerifyFairness={(hash, seed) => {
            setFairnessPrefill({ hash, seed });
            setFairnessReturn("rps");
            setScreen("fairness");
          }}
          isVisible={screen === "rps"}
        />
      )}

      {screen === "dice" && (
        <DiceScreen
          balance={balance}
          telegramId={telegramId}
          username={username}
          photoUrl={profile?.photo_url}
          serverMode={serverMode}
          onBack={() => setScreen("pvp")}
          onDeposit={() => {
            haptic("light");
            setDepositOpen(true);
          }}
          onBalanceUpdate={(b) => setBalanceFromServer(b)}
          onReloadBalance={() => {
            void reloadProfile();
            setTimeout(() => void reloadProfile(), 500);
            setTimeout(() => void reloadProfile(), 1500);
          }}
          showToast={showToast}
          haptic={haptic}
          hapticSuccess={hapticSuccess}
          hapticError={hapticError}
          isVisible={screen === "dice"}
          onVerifyFairness={(hash, seed) => {
            setFairnessPrefill({ hash, seed });
            setFairnessReturn("dice");
            setScreen("fairness");
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
          openLink={openLink}
          onDeposit={() => {
            haptic("light");
            setDepositOpen(true);
          }}
          onWithdraw={() => {
            haptic("light");
            setWithdrawOpen(true);
          }}
          onReferrals={() => setScreen("referrals")}
          onTransactions={() => setScreen("transactions")}
          onFairness={() => {
            setFairnessPrefill(null);
            setFairnessReturn("profile");
            setScreen("fairness");
          }}
        />
      )}

            {screen === "xo" && (
        <XoScreen
          balance={balance}
          telegramId={telegramId}
          username={username}
          photoUrl={profile?.photo_url}
          serverMode={serverMode}
          onBack={() => setScreen("pvp")}
          onDeposit={() => {
            haptic("light");
            setDepositOpen(true);
          }}
          onBalanceUpdate={(b) => setBalanceFromServer(b)}
          onReloadBalance={() => {
            void reloadProfile();
            setTimeout(() => void reloadProfile(), 500);
            setTimeout(() => void reloadProfile(), 1500);
          }}
          showToast={showToast}
          haptic={haptic}
          hapticSuccess={hapticSuccess}
          hapticError={hapticError}
          isVisible={screen === "xo"}
        />
      )}


      {screen === "fairness" && (
        <FairnessScreen
          initialHash={fairnessPrefill?.hash}
          initialSeed={fairnessPrefill?.seed}
          onBack={() => {
            setFairnessPrefill(null);
            setScreen(fairnessReturn);
          }}
        />
      )}

      {screen === "transactions" && (
        <TransactionsScreen onBack={() => setScreen("profile")} />
      )}

      {screen === "referrals" && (
        <ReferralsScreen
          earned={profile?.ref_earned ?? 0}
          count={profile?.ref_count ?? 0}
          active={profile?.ref_active ?? 0}
          turnover={profile?.ref_turnover ?? 0}
          username={username}
          referralCode={profile?.referral_code}
          telegramId={telegramId}
          onBack={() => setScreen("profile")}
          onHowItWorks={() => setHowRefOpen(true)}
          onCopy={copyRefLink}
          onWithdraw={doReferralWithdraw}
          withdrawing={refWithdrawing}
        />
      )}

      {screen === "tasks" && (
        <TasksScreen
          openLink={openLink}
          showToast={showToast}
          haptic={haptic}
          hapticSuccess={hapticSuccess}
          hapticError={hapticError}
          onRewarded={() => void reloadProfile()}
        />
      )}

      <BottomNav
        screen={screen}
        onChange={(s) => {
          haptic("light");
          setScreen(s);
        }}
      />

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onCredit={doCredit}
        telegramId={telegramId}
        username={username}
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
        wagerRemaining={profile?.wager_remaining ?? 0}
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        balance={balance}
        serverMode={serverMode}
        prefilledWallet={(profile as { ton_wallet?: string | null })?.ton_wallet}
        onDone={(b) => {
          if (typeof b === "number") setBalanceFromServer(b);
          else reloadProfile();
        }}
        showToast={showToast}
        haptic={haptic}
        hapticSuccess={hapticSuccess}
        hapticError={hapticError}
      />

      {!onboarded && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center modal-backdrop">
          <div className="w-full max-w-md glass-strong rounded-t-[28px] p-5 pt-4 slide-up border-t border-white/10 safe-bottom max-h-[92dvh] overflow-y-auto">
            {/* drag handle */}
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>
            <h3 className="text-[20px] font-semibold tracking-tight mb-4 text-center">
              {t("howItWorks")}
            </h3>
            <div className="space-y-3 mb-4">
              {(lang === "ru"
                ? [
                    { n: "1", title: "Баланс", body: "Пополните TON и получите GRAM" },
                    { n: "2", title: "Игра", body: "Выберите режим, создайте стол или присоединитесь" },
                    { n: "3", title: "PvP", body: "Играете против других игроков — победитель забирает банк" },
                    { n: "4", title: "Честность", body: "У каждой партии есть Hash и Seed — можно проверить самому" },
                  ]
                : [
                    { n: "1", title: "Balance", body: "Deposit TON and receive GRAM" },
                    { n: "2", title: "Play", body: "Pick a mode, create a table or join one" },
                    { n: "3", title: "PvP", body: "Play against other players — winner takes the pot" },
                    { n: "4", title: "Fairness", body: "Every round has Hash and Seed you can verify yourself" },
                  ]
              ).map((step) => (
                <div
                  key={step.n}
                  className="flex items-start gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] px-3.5 py-3"
                >
                  <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400/30 to-violet-500/25 border border-cyan-400/25 flex items-center justify-center text-[13px] font-bold text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.15)]">
                    {step.n}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <div className="text-[13px] font-semibold text-white/90 leading-tight">
                      {step.title}
                    </div>
                    <div className="text-[12px] text-white/50 leading-snug mt-0.5">
                      {step.body}
                    </div>
                  </div>
                </div>
              ))}


              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3">
                <div className="text-[11px] font-semibold text-white/45 uppercase tracking-wider mb-1.5">
                  {t("rulesTitle")}
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  {t("rulesBody")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  openLink(SUPPORT_URL);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] text-cyan-300/90 hover:text-cyan-200 transition"
              >
                <span>{t("support")}:</span>
                <span className="font-medium">{SUPPORT_URL.replace("https://t.me/", "@")}</span>
              </button>

              <label className="flex items-start gap-2.5 cursor-pointer rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={ageOk}
                  onChange={(e) => setAgeOk(e.target.checked)}
                  className="mt-0.5 accent-cyan-400 w-4 h-4"
                />
                <span className="text-[12px] text-white/60 leading-snug">
                  {t("ageConfirm")}
                </span>
              </label>
            </div>
            <button
              className="w-full h-12 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-40 shadow-[0_4px_24px_rgba(34,211,238,0.25)]"
              disabled={!ageOk}
              onClick={() => {
                if (!ageOk) return;
                localStorage.setItem("gramelle_onboarded_v2", "1");
                setOnboarded(true);
                haptic("light");
              }}
            >
              {t("gotIt")}
            </button>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

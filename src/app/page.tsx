"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useProfile } from "@/hooks/useProfile";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { ReferralsScreen } from "@/components/screens/ReferralsScreen";
import { TransactionsScreen } from "@/components/screens/TransactionsScreen";
import { TasksScreen } from "@/components/screens/TasksScreen";
import { GamesScreen } from "@/components/screens/GamesScreen";
import { RpsScreen } from "@/components/screens/RpsScreen";
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

  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  const showToast = useCallback((msg: string) => setToast(msg), []);


  // Global online (RPS open rooms) — top bar all screens
  useEffect(() => {
    if (!isReady) return;
    let stopped = false;
    const tick = async () => {
      try {
        const rps = await rpsList();
        if (stopped) return;
        const open = (rps.rooms || []).length;
        const playing = rps.mine?.status === "playing" ? 2 : 0;
        setOnlineCount(Math.max(0, open + playing));
      } catch {
        /* keep */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 8000);
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
    const id = setInterval(() => void run(), 20_000);
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

  // Maintenance: everyone blocked except allow-list Telegram IDs
  if (MAINTENANCE_MODE && !isMaintenanceBypass(telegramId)) {
    return <MaintenanceScreen />;
  }

  if (profileLoading) {
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

      {!serverMode && (
        <div className="mx-4 mt-2 mb-1 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-200/90 text-center">
          {t("demoMode")} configured for real play.
        </div>
      )}

      {screen === "games" && (
        <GamesScreen
          onlineCount={onlineCount}
          onSelectRps={() => {
            haptic("light");
            setScreen("rps");
          }}
        />
      )}

      {screen === "rps" && (
        <RpsScreen
          balance={balance}
          telegramId={telegramId}
          username={username}
          photoUrl={profile?.photo_url}
          serverMode={serverMode}
          onBack={() => setScreen("games")}
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
            setScreen("fairness");
          }}
        />
      )}

      {screen === "fairness" && (
        <FairnessScreen
          initialHash={fairnessPrefill?.hash}
          initialSeed={fairnessPrefill?.seed}
          onBack={() => {
            setFairnessPrefill(null);
            setScreen(fairnessPrefill ? "rps" : "profile");
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
          <div className="w-full max-w-md glass-strong rounded-t-3xl p-6 slide-up border-t border-white/10 safe-bottom max-h-[90dvh] overflow-y-auto">
            <h3 className="text-xl font-semibold tracking-tight mb-2">
              {t("howItWorks")}
            </h3>
            <div className="space-y-3 mb-4 text-sm text-white/70">
              {lang === "ru" ? (
                <>
                  <p>
                    <span className="text-cyan-300 font-medium">1. RPS</span> — создайте
                    комнату или присоединитесь к ставке
                  </p>
                  <p>
                    <span className="text-cyan-300 font-medium">2. Выбор</span> —
                    камень / ножницы / бумага
                  </p>
                  <p>
                    <span className="text-cyan-300 font-medium">3. Победа</span> —
                    выигрыш зачисляется на баланс
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <span className="text-cyan-300 font-medium">1. RPS</span> — create
                    a room or join a bet
                  </p>
                  <p>
                    <span className="text-cyan-300 font-medium">2. Choice</span> —
                    rock / paper / scissors
                  </p>
                  <p>
                    <span className="text-cyan-300 font-medium">3. Win</span> —
                    payout credited to your balance
                  </p>
                </>
              )}
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-amber-200/55 truncate">
                      {t("minBetLabel")}
                    </div>
                    <div className="text-[12px] font-semibold text-amber-100/90 tabular-nums">
                      0.25 GRAM
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-amber-200/55 truncate">
                      {t("minDepositLabel")}
                    </div>
                    <div className="text-[12px] font-semibold text-amber-100/90 tabular-nums">
                      0.5 TON
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-amber-200/55 truncate">
                      {t("minWithdrawLabel")}
                    </div>
                    <div className="text-[12px] font-semibold text-amber-100/90 tabular-nums">
                      5 TON
                    </div>
                  </div>
                  <div className="min-w-0 col-span-2">
                    <div className="text-[10px] text-amber-200/55">
                      {t("pendingWdLabel")}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1">
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
                className="w-full text-left text-[12px] text-cyan-300/90 hover:text-cyan-200 transition"
              >
                {t("support")}: {SUPPORT_URL.replace("https://t.me/", "@")}
              </button>
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={ageOk}
                  onChange={(e) => setAgeOk(e.target.checked)}
                  className="mt-0.5 accent-cyan-400"
                />
                <span className="text-[12px] text-white/55 leading-snug">
                  {t("ageConfirm")}
                </span>
              </label>
            </div>
            <button
              className="w-full h-12 rounded-2xl btn-primary text-sm btn-press disabled:opacity-40"
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

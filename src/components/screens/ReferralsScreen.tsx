"use client";

import { useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useI18n } from "@/lib/i18n/context";
import {
  BOT_USERNAME,
  getReferralTier,
  REFERRAL_MIN_WITHDRAW,
  REFERRAL_SHARE_OF_HOUSE_FEE,
} from "@/lib/constants";
import { formatGram } from "@/lib/utils";

interface ReferralsScreenProps {
  earned: number;
  count: number;
  active?: number;
  turnover?: number;
  username: string;
  referralCode?: string | null;
  telegramId?: number | null;
  onBack: () => void;
  onHowItWorks: () => void;
  onCopy: () => void;
  onWithdraw: () => Promise<void>;
  withdrawing?: boolean;
}

export function ReferralsScreen({
  earned,
  count,
  active = 0,
  turnover = 0,
  username,
  referralCode,
  telegramId = null,
  onBack,
  onHowItWorks,
  onCopy,
  onWithdraw,
  withdrawing = false,
}: ReferralsScreenProps) {
  const { t, lang } = useI18n();
  const { setBackButton } = useTelegram();
  useEffect(() => {
    setBackButton(() => {
      onBack();
    });
    return () => setBackButton(null);
  }, [onBack, setBackButton]);

  const tr = (en: string, ru: string) => (lang === "ru" ? ru : en);

  const code =
    referralCode || "ref_" + username.toLowerCase().replace(/\s+/g, "");
  const start = code.startsWith("ref_") ? code : "ref_" + code;
  const refLink = `https://t.me/${BOT_USERNAME}?start=${start}`;

  const activeCount = active || count;
  const tier = getReferralTier(activeCount);
  const canWithdraw = earned >= REFERRAL_MIN_WITHDRAW;
  const sharePct = Math.round(
    (tier?.shareOfHouseFee ?? REFERRAL_SHARE_OF_HOUSE_FEE) * 100
  );

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="flex items-center justify-center px-4 pt-3 pb-3 relative">
        <h2 className="text-base font-semibold tracking-tight">
          {t("referralsTitle")}
        </h2>
        <button
          onClick={onHowItWorks}
          className="absolute right-4 w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/50 btn-press"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </div>

      {/* Savings balance */}
      <div className="mx-4 mb-3 rounded-3xl p-5 border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-transparent">
        <div className="text-[11px] text-white/40 uppercase tracking-widest mb-1">
          {t("refSavings")}
        </div>
        <div className="text-3xl font-semibold tabular-nums text-cyan-300">
          {formatGram(earned)}{" "}
          <span className="text-base text-white/40 font-normal">GRAM</span>
        </div>
        <button
          type="button"
          disabled={!canWithdraw || withdrawing}
          onClick={() => void onWithdraw()}
          className="mt-3 w-full h-11 rounded-xl btn-primary text-sm font-semibold btn-press disabled:opacity-40"
        >
          {withdrawing
            ? tr("Withdrawing…", "Снятие…")
            : canWithdraw
              ? tr(
                  `Withdraw (≥ ${REFERRAL_MIN_WITHDRAW} GRAM)`,
                  `Снять (≥ ${REFERRAL_MIN_WITHDRAW} GRAM)`
                )
              : tr(
                  `Min ${REFERRAL_MIN_WITHDRAW} GRAM`,
                  `Мин. ${REFERRAL_MIN_WITHDRAW} GRAM`
                )}
        </button>
        {tier && (
          <div className="mt-2 text-xs text-cyan-300/80">
            {tr(
              `You earn ${sharePct}% of the platform commission from referral bets`,
              `Ты получаешь ${sharePct}% от комиссии платформы со ставок рефералов`
            )}
          </div>
        )}
      </div>

      <div className="mx-4 mt-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 flex justify-between text-xs">
        <span className="text-white/35">{t("referralTurnover")}</span>
        <span className="tabular-nums text-white/70">
          {formatGram(turnover)} GRAM
        </span>
      </div>

      <div className="mx-4 mt-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 flex justify-between text-xs">
        <span className="text-white/35">{tr("Referrals", "Рефералы")}</span>
        <span className="tabular-nums text-white/70">{count}</span>
      </div>

      {/* How it works */}
      <div className="mx-4 mt-5 space-y-2">
        <div className="text-[11px] text-white/35 uppercase tracking-widest mb-1 px-1">
          {tr("How it works", "Как это работает")}
        </div>
        <div className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3">
          <div className="text-sm text-white/80 leading-relaxed">
            {tr(
              "You get 10% of the platform commission from every bet of your referrals in RPS, Dice and XO. LIVE and SOLO do not count.",
              "Ты получаешь 10% от комиссии платформы с каждой ставки рефералов в RPS, Dice и XO. LIVE и SOLO не участвуют."
            )}
          </div>
          <div className="mt-2 text-xs text-cyan-300/80">
            {tr("Share of house fee", "Доля от комиссии")}: {sharePct}%
          </div>
        </div>
      </div>

      <div className="mx-4 mt-5 rounded-2xl glass p-4 border border-white/[0.07]">
        <div className="text-[11px] text-white/35 uppercase tracking-widest mb-2">
          {t("yourLink")}
        </div>
        <div className="text-[11px] text-white/45 break-all font-mono bg-black/30 rounded-xl px-3 py-2.5 border border-white/[0.04]">
          {refLink}
        </div>
        <button
          onClick={onCopy}
          className="w-full mt-3 h-11 rounded-xl btn-primary text-sm btn-press"
        >
          {t("copyLink")}
        </button>
      </div>
    </div>
  );
}

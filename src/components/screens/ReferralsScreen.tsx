"use client";

import { useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useI18n } from "@/lib/i18n/context";
import {
  BOT_USERNAME,
  REFERRAL_TIERS,
  INDIVIDUAL_TIER,
  isIndividualRefViewer,
  getReferralTier,
  REFERRAL_MIN_WITHDRAW,
} from "@/lib/constants";
import { formatGram, cn } from "@/lib/utils";

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
  const tier = getReferralTier(activeCount, turnover, telegramId);
  const canWithdraw = earned >= REFERRAL_MIN_WITHDRAW;
  const showIndividual = isIndividualRefViewer(telegramId);
  const individualUnlocked = showIndividual && activeCount >= 1;
  const isIndividualActive = tier?.id === "individual";

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
            {t("youEarnShare", {
              n: Math.round(tier.shareOfHouseFee * 100),
            })}
          </div>
        )}
      </div>

      <div className="mx-4 mt-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 flex justify-between text-xs">
        <span className="text-white/35">{t("referralTurnover")}</span>
        <span className="tabular-nums text-white/70">
          {formatGram(turnover)} GRAM
        </span>
      </div>

      {/* ── Individual (only for allow-listed IDs) ── */}
      {showIndividual && (
        <div className="mx-4 mt-5">
          <div className="text-[11px] text-white/35 uppercase tracking-widest mb-2 px-1">
            {tr("Special", "Специальный")}
          </div>
          <div
            className={cn(
              "relative overflow-hidden rounded-3xl border p-4",
              individualUnlocked
                ? "border-fuchsia-400/40 shadow-[0_0_40px_rgba(240,171,252,0.15)]"
                : "border-white/10 opacity-80"
            )}
            style={{
              background: individualUnlocked
                ? "linear-gradient(135deg, rgba(192,38,211,0.25) 0%, rgba(79,70,229,0.18) 50%, rgba(14,165,233,0.12) 100%)"
                : "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            {/* shimmer */}
            <div
              className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30"
              style={{
                background:
                  "radial-gradient(circle, rgba(240,171,252,0.5) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex items-start gap-3">
              <div
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shrink-0",
                  individualUnlocked
                    ? "bg-gradient-to-br from-fuchsia-400 to-indigo-500 text-white shadow-lg shadow-fuchsia-500/30"
                    : "bg-white/10 text-white/50"
                )}
              >
                ✦
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold bg-gradient-to-r from-fuchsia-200 via-pink-200 to-cyan-200 bg-clip-text text-transparent">
                    Individual
                  </span>
                  {isIndividualActive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-fuchsia-500/30 text-fuchsia-100 border border-fuchsia-400/30">
                      {tr("Active", "Активен")}
                    </span>
                  )}
                  {!individualUnlocked && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/45">
                      {tr("Invite 1 friend", "Пригласи 1 друга")}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] text-white/65 leading-relaxed">
                  {tr(
                    "You receive 4% of the house fee from every game your referrals play. The app keeps the rest of the commission.",
                    "Ты получаешь 4% от комиссии (house fee) с каждой игры твоих рефералов. Остальная комиссия остаётся приложению."
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <div className="px-2.5 py-1 rounded-xl bg-black/25 border border-white/10 text-[11px]">
                    <span className="text-white/40">{tr("Your share", "Твоя доля")} </span>
                    <span className="font-bold text-fuchsia-200">4%</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-black/25 border border-white/10 text-[11px]">
                    <span className="text-white/40">{tr("App", "Приложение")} </span>
                    <span className="font-bold text-cyan-200">~1%+</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-black/25 border border-white/10 text-[11px]">
                    <span className="text-white/40">{tr("From", "От")} </span>
                    <span className="font-bold text-white/80">1 {tr("invite", "инвайт")}</span>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-white/35">
                  {tr(
                    "Linked to all games · savings withdraw to balance",
                    "Связано со всеми играми · снятие накоплений на баланс"
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standard tiers */}
      <div className="mx-4 mt-5 space-y-2">
        <div className="text-[11px] text-white/35 uppercase tracking-widest mb-1 px-1">
          {t("levels")}
        </div>
        {REFERRAL_TIERS.map((trTier) => {
          const unlocked =
            !isIndividualActive &&
            !!tier &&
            tier.shareOfHouseFee >= trTier.shareOfHouseFee;
          return (
            <div
              key={trTier.id}
              className={cn(
                "rounded-2xl border px-4 py-3 flex items-center gap-3",
                unlocked
                  ? "border-white/12 bg-white/[0.05]"
                  : "border-white/[0.05] bg-white/[0.02] opacity-70"
              )}
            >
              <span className="text-xl">{trTier.emoji}</span>
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium"
                  style={{ color: trTier.color }}
                >
                  {trTier.name}
                </div>
                <div className="text-[10px] text-white/35">
                  {trTier.minActive}
                  {trTier.maxActive ? `–${trTier.maxActive}` : "+"}{" "}
                  {tr("act.", "акт.")}
                  {trTier.minTurnover > 0
                    ? ` · ${trTier.minTurnover}+ ${tr("turnover", "оборот")}`
                    : ""}
                </div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-cyan-300/90">
                {Math.round(trTier.shareOfHouseFee * 100)}%
              </div>
            </div>
          );
        })}
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

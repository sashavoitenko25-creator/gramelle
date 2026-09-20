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

  const steps = [
    {
      n: "1",
      title: tr("Share link", "Поделись ссылкой"),
      desc: tr("Send your invite to friends", "Отправь инвайт друзьям"),
      emoji: "🔗",
    },
    {
      n: "2",
      title: tr("They play", "Они играют"),
      desc: tr("PvP games", "PvP-игры"),
      emoji: "🎮",
    },
    {
      n: "3",
      title: tr("You earn", "Ты получаешь"),
      desc: tr("From friends' PvP games", "С PvP-игр друзей"),
      emoji: "💎",
    },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top relative overflow-hidden">
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[320px] h-[320px] rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.22) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute top-40 -right-20 w-[200px] h-[200px] rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-center px-4 pt-3 pb-2">
        <h2 className="text-base font-semibold tracking-tight">
          {t("referralsTitle")}
        </h2>
        <button
          onClick={onHowItWorks}
          className="absolute right-4 w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/55 btn-press hover:text-cyan-200/90 transition-colors"
          aria-label={tr("How it works", "Как это работает")}
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

      {/* Hero savings */}
      <div className="relative mx-4 mt-2 mb-4 rounded-[28px] overflow-hidden border border-cyan-400/25 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(145deg, rgba(8,145,178,0.35) 0%, rgba(15,23,42,0.9) 45%, rgba(88,28,135,0.25) 100%)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,rgba(34,211,238,0.25),transparent_55%)]" />
        <div className="relative p-5 pt-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70 font-semibold">
              {t("refSavings")}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-400/15 text-cyan-300 border border-cyan-400/25">
              PvP
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-[40px] font-black tabular-nums tracking-tight text-white leading-none">
              {formatGram(earned)}
            </span>
            <span className="text-sm font-semibold text-cyan-200/50">GRAM</span>
          </div>
          <p className="mt-2 text-[12px] text-white/45 leading-relaxed max-w-[90%]">
            {tr(
              "Share from friends' PvP games",
              "Доля с PvP-игр друзей"
            )}
          </p>
          <button
            type="button"
            disabled={!canWithdraw || withdrawing}
            onClick={() => void onWithdraw()}
            className="mt-4 w-full h-12 rounded-2xl btn-primary text-sm font-bold btn-press disabled:opacity-40 shadow-[0_8px_24px_rgba(34,211,238,0.2)]"
          >
            {withdrawing
              ? tr("Withdrawing…", "Снятие…")
              : canWithdraw
                ? tr("Withdraw to balance", "Снять на баланс")
                : tr(
                    `Min ${REFERRAL_MIN_WITHDRAW} GRAM`,
                    `Мин. ${REFERRAL_MIN_WITHDRAW} GRAM`
                  )}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mx-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-wider text-white/35 mb-1">
            {tr("Referrals", "Рефералы")}
          </div>
          <div className="text-2xl font-bold tabular-nums text-white">
            {count}
          </div>
          <div className="text-[11px] text-white/30 mt-0.5">
            {tr("invited", "приглашено")}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-wider text-white/35 mb-1">
            {t("referralTurnover")}
          </div>
          <div className="text-2xl font-bold tabular-nums text-white">
            {formatGram(turnover)}
          </div>
          <div className="text-[11px] text-white/30 mt-0.5">GRAM</div>
        </div>
      </div>

      {/* Steps */}
      <div className="mx-4 mt-5">
        <div className="text-[11px] text-white/35 uppercase tracking-widest mb-2.5 px-1">
          {tr("How it works", "Как это работает")}
        </div>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/15 border border-white/10 flex items-center justify-center text-lg shrink-0">
                {s.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white/90">
                  {s.title}
                </div>
                <div className="text-[11px] text-white/40 mt-0.5">{s.desc}</div>
              </div>
              <div className="w-6 h-6 rounded-full bg-white/[0.06] text-[10px] font-bold text-white/40 flex items-center justify-center shrink-0">
                {s.n}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2.5 px-1 text-[11px] text-white/30 leading-relaxed">
          {tr(
            "LIVE and SOLO do not count. No signup bonus.",
            "LIVE и SOLO не участвуют. Бонуса за регистрацию нет."
          )}
        </p>
      </div>

      {/* Link card */}
      <div className="mx-4 mt-5 rounded-[24px] border border-white/[0.1] overflow-hidden bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="text-[11px] text-white/40 uppercase tracking-widest">
            {t("yourLink")}
          </div>
          <span className="text-[10px] text-cyan-300/70 font-mono">
            {start}
          </span>
        </div>
        <div className="mx-4 mb-3 rounded-xl bg-black/40 border border-white/[0.06] px-3 py-2.5">
          <div className="text-[11px] text-white/55 break-all font-mono leading-relaxed">
            {refLink}
          </div>
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={onCopy}
            className="w-full h-12 rounded-2xl btn-primary text-sm font-bold btn-press flex items-center justify-center gap-2"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            {t("copyLink")}
          </button>
        </div>
      </div>
    </div>
  );
}

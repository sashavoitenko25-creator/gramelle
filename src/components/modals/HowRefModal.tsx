"use client";

import { useI18n } from "@/lib/i18n/context";
import { REFERRAL_TIERS, REFERRAL_MIN_WITHDRAW } from "@/lib/constants";

interface HowRefModalProps {
  open: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export function HowRefModal({ open, onClose, onCopy }: HowRefModalProps) {
  const { t, lang } = useI18n();

  if (!open) return null;

  const body =
    lang === "ru"
      ? {
          title: "Реферальная программа",
          p1: "Приглашайте друзей по своей ссылке. Когда они играют, вы получаете долю дохода платформы с их ставок — не с депозитов.",
          p2a: "Начисления идут на ",
          p2b: "реферальные накопления",
          p2c: `. Вывод на основной баланс в любой момент (мин. ${REFERRAL_MIN_WITHDRAW} GRAM).`,
          note: "С Silver+ нужен реферальный оборот (сумма ставок друзей). Активные = друзья с ≥1 игрой. Бонуса за регистрацию нет.",
        }
      : {
          title: "Referral program",
          p1: "Invite friends with your link. When they play, you earn a share of platform revenue from their bets — not from deposits.",
          p2a: "Earnings go to your ",
          p2b: "referral savings",
          p2c: `. Withdraw to main balance anytime (min ${REFERRAL_MIN_WITHDRAW} GRAM).`,
          note: "Silver+ also need referral turnover (sum of friends' bets). Active = friends with ≥1 game. No signup bonus.",
        };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 slide-up border-t border-white/10 safe-bottom max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-3">{body.title}</h3>
        <div className="space-y-3 text-sm text-white/65 leading-relaxed mb-4">
          <p>{body.p1}</p>
          <p>
            {body.p2a}
            <span className="text-cyan-300 font-medium">{body.p2b}</span>
            {body.p2c}
          </p>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
            {REFERRAL_TIERS.map((tier) => (
              <div key={tier.id} className="flex justify-between text-xs">
                <span>
                  {tier.emoji} {tier.name}
                </span>
                <span className="text-cyan-300/90">
                  {Math.round(tier.shareOfHouseFee * 100)}%
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/40">{body.note}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCopy}
            className="flex-1 h-11 rounded-xl btn-primary text-sm btn-press"
          >
            {t("copyLink")}
          </button>
          <button
            onClick={onClose}
            className="px-4 h-11 rounded-xl btn-secondary text-sm border border-white/10"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { REFERRAL_JOIN_BONUS, REFERRAL_TIERS } from "@/lib/constants";

interface HowRefModalProps {
  open: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export function HowRefModal({ open, onClose, onCopy }: HowRefModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 slide-up border-t border-white/10 safe-bottom max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-3">Referral program</h3>
        <div className="space-y-3 text-sm text-white/65 leading-relaxed mb-4">
          <p>
            Invite a <span className="text-white/90">new</span> player — get{" "}
            <span className="text-cyan-300 font-medium">{REFERRAL_JOIN_BONUS} GRAM</span>{" "}
            when they open the app for the first time.
          </p>
          <p>
            Then earn a <span className="text-white/90">% of Gramelle commission</span>{" "}
            (5% house edge) from every bet your active friends place — not from deposits.
          </p>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
            {REFERRAL_TIERS.map((t) => (
              <div key={t.id} className="flex justify-between text-xs">
                <span>
                  {t.emoji} {t.name}
                </span>
                <span className="text-cyan-300/90">
                  {Math.round(t.shareOfHouseFee * 100)}% of fee
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/40">
            Silver+ also need referral turnover (sum of friends' bets). Active = friends with ≥1 game.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCopy}
            className="flex-1 h-11 rounded-xl btn-primary text-sm btn-press"
          >
            Copy link
          </button>
          <button
            onClick={onClose}
            className="px-4 h-11 rounded-xl btn-secondary text-sm border border-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

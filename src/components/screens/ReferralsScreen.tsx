"use client";

import { BOT_USERNAME } from "@/lib/constants";
import { formatGram } from "@/lib/utils";

interface ReferralsScreenProps {
  earned: number;
  count: number;
  username: string;
  onBack: () => void;
  onHowItWorks: () => void;
  onCopy: () => void;
}

export function ReferralsScreen({
  earned,
  count,
  username,
  onBack,
  onHowItWorks,
  onCopy,
}: ReferralsScreenProps) {
  const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${username.toLowerCase().replace(/\s+/g, "")}`;

  return (
    <div className="flex flex-col min-h-screen pb-28 safe-top">
      <div className="flex items-center justify-between px-4 pt-3 pb-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/50 btn-press"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h2 className="text-base font-semibold tracking-tight">Referrals</h2>
        <button
          onClick={onHowItWorks}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/50 btn-press"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="mx-4 grid grid-cols-2 gap-3 mt-2">
        <div className="rounded-2xl glass p-4 border border-white/[0.06] text-center">
          <div className="text-2xl font-semibold tabular-nums text-gradient-gold">
            {formatGram(earned)}
          </div>
          <div className="text-[11px] text-white/35 mt-1 uppercase tracking-wider">
            Earned
          </div>
        </div>
        <div className="rounded-2xl glass p-4 border border-white/[0.06] text-center">
          <div className="text-2xl font-semibold tabular-nums text-gradient-cyan">
            {count}
          </div>
          <div className="text-[11px] text-white/35 mt-1 uppercase tracking-wider">
            Friends
          </div>
        </div>
      </div>

      {/* Link card */}
      <div className="mx-4 mt-5 rounded-2xl glass p-4 border border-white/[0.06]">
        <div className="text-[11px] text-white/35 uppercase tracking-widest mb-2">
          Your link
        </div>
        <div className="text-xs text-white/50 break-all font-mono bg-black/30 rounded-xl px-3 py-2.5 border border-white/[0.04]">
          {refLink}
        </div>
        <button
          onClick={onCopy}
          className="w-full mt-3 h-11 rounded-xl btn-primary text-sm btn-press"
        >
          Copy link
        </button>
      </div>

      <p className="mx-4 mt-4 text-center text-xs text-white/25 leading-relaxed">
        Share your link. When friends join and play,<br />you earn rewards.
      </p>
    </div>
  );
}

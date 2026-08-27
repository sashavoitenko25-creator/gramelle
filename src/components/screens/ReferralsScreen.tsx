"use client";

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
  onBack,
  onHowItWorks,
  onCopy,
}: ReferralsScreenProps) {
  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60"
        >
          ←
        </button>
        <h2 className="text-base font-semibold">Referrals</h2>
        <button
          onClick={onHowItWorks}
          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 text-sm"
        >
          ?
        </button>
      </div>

      <div className="mx-4 mt-4 grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl bg-[#16161f] border border-white/5 p-4 text-center">
          <div className="text-2xl font-bold text-cyan-300">
            {formatGram(earned)}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Earned GRAM</div>
        </div>
        <div className="rounded-2xl bg-[#16161f] border border-white/5 p-4 text-center">
          <div className="text-2xl font-bold">{count}</div>
          <div className="text-[11px] text-white/40 mt-1">Friends</div>
        </div>
      </div>

      <div className="mx-4">
        <button
          onClick={onCopy}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold text-sm"
        >
          Copy referral link
        </button>
      </div>
    </div>
  );
}

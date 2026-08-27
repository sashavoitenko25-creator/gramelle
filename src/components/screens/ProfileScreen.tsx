"use client";

import { formatGram } from "@/lib/utils";

interface ProfileScreenProps {
  username: string;
  balance: number;
  onDeposit: () => void;
  onReferrals: () => void;
  onClose?: () => void;
}

export function ProfileScreen({
  username,
  balance,
  onDeposit,
  onReferrals,
}: ProfileScreenProps) {
  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="w-8" />
      </div>

      <div className="flex flex-col items-center pt-6 pb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-3xl mb-3">
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="text-lg font-semibold">@{username}</div>
      </div>

      <div className="mx-4 mb-4 rounded-2xl bg-[#16161f] border border-white/5 p-4">
        <div className="text-xs text-white/40 mb-1">Balance</div>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-cyan-300">
            {formatGram(balance)} GRAM
          </div>
          <button
            onClick={onDeposit}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-sm font-semibold"
          >
            Deposit
          </button>
        </div>
      </div>

      <div className="mx-4 rounded-2xl bg-[#16161f] border border-white/5 overflow-hidden">
        <button
          onClick={onReferrals}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🎁</span>
            <span className="text-sm font-medium">Referrals</span>
          </div>
          <span className="text-white/40">›</span>
        </button>
      </div>
    </div>
  );
}

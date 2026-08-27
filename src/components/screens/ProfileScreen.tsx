"use client";

import { formatGram } from "@/lib/utils";
import { TonIcon } from "@/components/ui/TonIcon";

interface ProfileScreenProps {
  username: string;
  balance: number;
  photoUrl?: string | null;
  wins?: number;
  games?: number;
  biggestWin?: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onReferrals: () => void;
}

export function ProfileScreen({
  username,
  balance,
  photoUrl,
  wins = 0,
  games = 0,
  biggestWin = 0,
  onDeposit,
  onWithdraw,
  onReferrals,
}: ProfileScreenProps) {
  const initial = username.charAt(0).toUpperCase();
  const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;

  return (
    <div className="flex flex-col min-h-screen pb-28 safe-top">
      <div className="px-4 pt-6 pb-2 text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-violet-500/25 to-cyan-500/20 border border-white/10 flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.15)] overflow-hidden">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-white/90">{initial}</span>
          )}
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{username}</h2>
        <p className="text-xs text-white/30 mt-1">Player</p>
      </div>

      <div className="mx-4 mt-6 rounded-3xl glass p-5 border border-white/[0.08]">
        <div className="text-[11px] text-white/35 uppercase tracking-widest mb-1">
          Balance
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <TonIcon size={22} />
            <div className="text-3xl font-semibold tabular-nums text-gradient-cyan">
              {formatGram(balance)}
              <span className="text-sm text-white/30 font-normal ml-1.5">GRAM</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onDeposit}
            className="flex-1 px-4 py-2.5 rounded-xl btn-primary text-xs btn-press"
          >
            Deposit
          </button>
          <button
            onClick={onWithdraw}
            className="flex-1 px-4 py-2.5 rounded-xl btn-secondary text-xs btn-press border border-white/10"
          >
            Withdraw
          </button>
        </div>
      </div>

      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Winrate", value: `${winrate}%` },
          { label: "Wins", value: String(wins) },
          { label: "Best win", value: formatGram(biggestWin) },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-3 text-center"
          >
            <div className="text-sm font-semibold tabular-nums">{s.value}</div>
            <div className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-4 mt-4 space-y-2">
        <button
          onClick={onReferrals}
          className="w-full flex items-center justify-between rounded-2xl bg-white/[0.03] border border-white/[0.05] px-4 py-4 hover:bg-white/[0.05] transition btn-press"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-violet-400">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-sm font-medium">Referrals</div>
              <div className="text-[11px] text-white/30">5% of friends&apos; deposits</div>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/25">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

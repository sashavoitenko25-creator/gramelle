"use client";

import { useState } from "react";
import {
  BOT_USERNAME,
  REFERRAL_TIERS,
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
  onBack,
  onHowItWorks,
  onCopy,
  onWithdraw,
  withdrawing = false,
}: ReferralsScreenProps) {
  const code =
    referralCode ||
    ("ref_" + username.toLowerCase().replace(/\s+/g, ""));
  const start = code.startsWith("ref_") ? code : "ref_" + code;
  const refLink = `https://t.me/${BOT_USERNAME}?start=${start}`;
  const tier = getReferralTier(active || count, turnover);
  const canWithdraw = earned >= REFERRAL_MIN_WITHDRAW;

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="flex items-center justify-between px-4 pt-3 pb-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/50 btn-press"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h2 className="text-base font-semibold tracking-tight">Referrals</h2>
        <button
          onClick={onHowItWorks}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/50 btn-press"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </div>

      {/* Savings balance */}
      <div className="mx-4 mb-3 rounded-3xl p-5 border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-transparent">
        <div className="text-[11px] text-white/40 uppercase tracking-widest mb-1">
          Referral savings
        </div>
        <div className="text-3xl font-semibold tabular-nums text-cyan-300">
          {formatGram(earned)}{" "}
          <span className="text-base text-white/40 font-normal">GRAM</span>
        </div>
        <p className="text-[11px] text-white/35 mt-2 leading-relaxed">
          from friends&apos; play. Withdraw to main balance (min{" "}
          {REFERRAL_MIN_WITHDRAW} GRAM).
        </p>
        <button
          onClick={() => !withdrawing && canWithdraw && onWithdraw()}
          disabled={!canWithdraw || withdrawing}
          className={cn(
            "w-full mt-4 h-11 rounded-xl text-sm font-medium btn-press transition-opacity",
            canWithdraw && !withdrawing
              ? "btn-primary"
              : "bg-white/[0.06] text-white/30 cursor-not-allowed"
          )}
        >
          {withdrawing
            ? "Withdrawing…"
            : canWithdraw
              ? `Withdraw ${formatGram(earned)} GRAM`
              : `Min ${REFERRAL_MIN_WITHDRAW} GRAM to withdraw`}
        </button>
      </div>

      {/* Tier badge */}
      <div
        className="mx-4 mb-4 rounded-3xl p-5 border border-white/[0.08] relative overflow-hidden"
        style={{
          background: tier
            ? `linear-gradient(135deg, ${tier.color}22, transparent 60%)`
            : "rgba(255,255,255,0.03)",
        }}
      >
        <div className="text-[11px] text-white/40 uppercase tracking-widest mb-1">
          Your tier
        </div>
        <div className="text-2xl font-semibold flex items-center gap-2">
          <span>{tier?.emoji || "🌱"}</span>
          <span style={{ color: tier?.color || "#fff" }}>
            {tier?.name || "Starter"}
          </span>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-white/50">
          <span>
            <span className="text-white/80 font-medium">{count}</span> invited
          </span>
          <span>
            <span className="text-white/80 font-medium">{active}</span> active
          </span>
          <span>
            <span className="text-white/80 font-medium tabular-nums">
              {formatGram(turnover)}
            </span>{" "}
            turnover
          </span>
        </div>
        {tier && (
          <div className="mt-2 text-xs text-cyan-300/80">
            You earn {Math.round(tier.shareOfHouseFee * 100)}% share
          </div>
        )}
      </div>

      <div className="mx-4 mt-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 flex justify-between text-xs">
        <span className="text-white/35">Referral turnover</span>
        <span className="tabular-nums text-white/70">
          {formatGram(turnover)} GRAM
        </span>
      </div>

      {/* Tiers list */}
      <div className="mx-4 mt-5 space-y-2">
        <div className="text-[11px] text-white/35 uppercase tracking-widest mb-1 px-1">
          Levels
        </div>
        {REFERRAL_TIERS.map((t) => {
          const unlocked = !!tier && tier.shareOfHouseFee >= t.shareOfHouseFee;
          return (
            <div
              key={t.id}
              className={cn(
                "rounded-2xl border px-4 py-3 flex items-center gap-3",
                unlocked
                  ? "border-white/12 bg-white/[0.05]"
                  : "border-white/[0.05] bg-white/[0.02] opacity-70"
              )}
            >
              <span className="text-xl">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: t.color }}>
                  {t.name}
                </div>
                <div className="text-[10px] text-white/35">
                  {t.minActive}
                  {t.maxActive ? `–${t.maxActive}` : "+"} active
                  {t.minTurnover > 0 ? ` · ${t.minTurnover}+ turnover` : ""}
                </div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-cyan-300/90">
                {Math.round(t.shareOfHouseFee * 100)}%
              </div>
            </div>
          );
        })}
      </div>

      <div className="mx-4 mt-5 rounded-2xl glass p-4 border border-white/[0.07]">
        <div className="text-[11px] text-white/35 uppercase tracking-widest mb-2">
          Your link
        </div>
        <div className="text-[11px] text-white/45 break-all font-mono bg-black/30 rounded-xl px-3 py-2.5 border border-white/[0.04]">
          {refLink}
        </div>
        <button
          onClick={onCopy}
          className="w-full mt-3 h-11 rounded-xl btn-primary text-sm btn-press"
        >
          Copy link
        </button>
      </div>
    </div>
  );
}

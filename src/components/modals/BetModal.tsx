"use client";

import { useState } from "react";
import { formatGram, cn } from "@/lib/utils";

interface BetModalProps {
  open: boolean;
  balance: number;
  minBet?: number;
  maxBet?: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

export function BetModal({ open, balance, minBet = 0.1, maxBet = 500, onClose, onConfirm }: BetModalProps) {
  const [amount, setAmount] = useState("1");
  const num = parseFloat(amount) || 0;

  if (!open) return null;

  const presets = [1, 5, 10, 25];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 slide-up border-t border-white/10 safe-bottom">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold tracking-tight">Place Bet</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/40 btn-press"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full h-14 rounded-2xl bg-black/40 border border-white/10 px-4 text-2xl font-semibold outline-none focus:border-cyan-500/40 transition tabular-nums text-center"
          />
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {presets.map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className={cn(
                "py-2.5 rounded-xl text-sm font-medium transition btn-press",
                num === v
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25"
                  : "bg-white/[0.04] text-white/60 border border-white/[0.06] hover:bg-white/[0.07]"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAmount(balance.toFixed(2))}
          className="w-full py-2 mb-4 text-xs text-white/40 hover:text-white/60 transition"
        >
          Use max · {formatGram(balance)} GRAM
        </button>

        <button
          onClick={() => {
            const ok = num >= minBet && num <= Math.min(maxBet, balance);
            if (ok) onConfirm(num);
          }}
          disabled={num < minBet || num > balance || num > maxBet}
          className="w-full h-12 rounded-2xl btn-primary text-sm btn-press"
        >
          Confirm · {formatGram(num)} GRAM
        </button>
      </div>
    </div>
  );
}

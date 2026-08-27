"use client";

import { useState, useEffect } from "react";
import { MIN_BET } from "@/lib/constants";
import { formatGram } from "@/lib/utils";

interface BetModalProps {
  open: boolean;
  balance: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

export function BetModal({ open, balance, onClose, onConfirm }: BetModalProps) {
  const [amount, setAmount] = useState("1");

  useEffect(() => {
    if (open) {
      setAmount(Math.min(1, balance).toFixed(1));
    }
  }, [open, balance]);

  if (!open) return null;

  const num = parseFloat(amount) || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#16161f] rounded-t-2xl p-5 slide-up border-t border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Place Bet</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50"
          >
            ✕
          </button>
        </div>

        <div className="mb-3">
          <label className="text-xs text-white/40 mb-1 block">Amount (GRAM)</label>
          <input
            type="number"
            min={MIN_BET}
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-lg font-medium outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex gap-2 mb-4">
          {[1, 5, 10].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="flex-1 py-2 rounded-lg bg-white/5 text-sm font-medium hover:bg-white/10 transition"
            >
              {v}
            </button>
          ))}
          <button
            onClick={() => setAmount(balance.toFixed(2))}
            className="flex-1 py-2 rounded-lg bg-white/5 text-sm font-medium hover:bg-white/10 transition"
          >
            MAX
          </button>
        </div>

        <div className="text-xs text-white/40 mb-4">
          Balance: {formatGram(balance)} GRAM
        </div>

        <button
          onClick={() => onConfirm(num)}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-semibold text-sm hover:opacity-90 transition"
        >
          Confirm Bet
        </button>
      </div>
    </div>
  );
}

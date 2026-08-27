"use client";

import { useState } from "react";
import { formatGram, cn } from "@/lib/utils";

interface BetModalProps {
  open: boolean;
  balance: number;
  minBet: number;
  maxBet: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

const PRESETS = [0.5, 1, 5, 10, 25, 50];

export function BetModal({
  open,
  balance,
  minBet,
  maxBet,
  onClose,
  onConfirm,
}: BetModalProps) {
  const [amount, setAmount] = useState("");

  if (!open) return null;

  const val = parseFloat(amount) || 0;
  const can =
    val >= minBet && val <= maxBet && val <= balance && Number.isFinite(val);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 slide-up border-t border-white/10 safe-bottom">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold tracking-tight">Place bet</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/40 btn-press"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-white/35 mb-4">
          Balance <span className="text-white/60 tabular-nums">{formatGram(balance)}</span> GRAM · min {minBet}
        </p>

        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Amount (${minBet}–${maxBet})`}
          className="w-full h-12 rounded-2xl bg-black/35 border border-white/[0.08] px-4 text-base outline-none focus:border-cyan-500/35 tabular-nums mb-3"
        />

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.filter((p) => p >= minBet && p <= maxBet).map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium border transition btn-press",
                val === p
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200"
                  : "bg-white/[0.03] border-white/[0.06] text-white/50"
              )}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() =>
              setAmount(String(Math.min(maxBet, Math.floor(balance * 100) / 100)))
            }
            className="px-3 py-1.5 rounded-xl text-xs font-medium border bg-white/[0.03] border-white/[0.06] text-white/50 btn-press"
          >
            Max
          </button>
        </div>

        <button
          disabled={!can}
          onClick={() => onConfirm(val)}
          className="w-full h-12 rounded-2xl btn-primary text-sm btn-press disabled:opacity-40"
        >
          Confirm · {val > 0 ? formatGram(val) + " GRAM" : "Enter amount"}
        </button>
      </div>
    </div>
  );
}

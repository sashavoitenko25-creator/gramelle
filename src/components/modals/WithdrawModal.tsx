"use client";

import { useState } from "react";
import { MIN_WITHDRAW_TON, MAX_WITHDRAW_TON, GRAM_PER_TON } from "@/lib/constants";
import { requestWithdraw } from "@/lib/api";
import { formatGram } from "@/lib/utils";
import { TonIcon } from "@/components/ui/TonIcon";

interface WithdrawModalProps {
  open: boolean;
  onClose: () => void;
  balance: number;
  serverMode?: boolean;
  onDone: (newBalance?: number) => void;
  showToast: (msg: string) => void;
  haptic: (s?: "light" | "medium" | "heavy") => void;
  hapticSuccess: () => void;
  hapticError: () => void;
}

export function WithdrawModal({
  open,
  onClose,
  balance,
  serverMode = false,
  onDone,
  showToast,
  haptic,
  hapticSuccess,
  hapticError,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const ton = parseFloat(amount) || 0;
  const gram = ton * GRAM_PER_TON;

  const submit = async () => {
    if (loading) return;
    if (ton < MIN_WITHDRAW_TON) {
      showToast(`Min ${MIN_WITHDRAW_TON} TON`);
      return;
    }
    if (ton > MAX_WITHDRAW_TON) {
      showToast(`Max ${MAX_WITHDRAW_TON} TON`);
      return;
    }
    if (gram > balance) {
      showToast("Not enough balance");
      return;
    }
    if (wallet.trim().length < 20) {
      showToast("Enter a valid TON address");
      return;
    }

    haptic("light");
    setLoading(true);

    if (!serverMode) {
      showToast("Withdraw is available in production mode");
      setLoading(false);
      return;
    }

    try {
      const res = await requestWithdraw(ton, wallet.trim());
      hapticSuccess();
      showToast("Withdraw requested · processing");
      onDone(res.balance);
      onClose();
      setAmount("");
      setWallet("");
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 slide-up border-t border-white/10 safe-bottom">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <TonIcon size={20} /> Withdraw TON
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/40 btn-press"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-white/35 mb-4 leading-relaxed">
          1 GRAM = 1 TON. Requests are processed manually. Available:{" "}
          <span className="text-white/70 tabular-nums">{formatGram(balance)} GRAM</span>
        </p>

        <label className="text-[10px] text-white/30 uppercase tracking-wider">Amount (TON)</label>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`${MIN_WITHDRAW_TON} – ${MAX_WITHDRAW_TON}`}
          className="w-full mt-1 mb-3 h-12 rounded-2xl bg-black/30 border border-white/[0.08] px-4 text-sm outline-none focus:border-sky-500/40"
        />

        <label className="text-[10px] text-white/30 uppercase tracking-wider">TON wallet</label>
        <input
          type="text"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="UQ… or EQ…"
          className="w-full mt-1 mb-4 h-12 rounded-2xl bg-black/30 border border-white/[0.08] px-4 text-xs font-mono outline-none focus:border-sky-500/40"
        />

        <button
          onClick={submit}
          disabled={loading}
          className="w-full h-12 rounded-2xl btn-primary text-sm btn-press disabled:opacity-50"
        >
          {loading ? "Submitting…" : `Withdraw ${ton > 0 ? ton + " TON" : ""}`}
        </button>
      </div>
    </div>
  );
}

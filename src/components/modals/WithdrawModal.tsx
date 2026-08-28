"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  MIN_WITHDRAW_TON,
  WITHDRAW_FEE_GRAM,
  DAILY_WITHDRAW_LIMIT_TON,
} from "@/lib/constants";
import { formatGram } from "@/lib/utils";
import { TonIcon } from "@/components/ui/TonIcon";

interface WithdrawModalProps {
  open: boolean;
  onClose: () => void;
  balance: number;
  serverMode: boolean;
  onDone: (balance?: number) => void;
  showToast: (msg: string) => void;
  haptic: (t?: "light" | "medium" | "heavy") => void;
  hapticSuccess: () => void;
  hapticError: () => void;
  prefilledWallet?: string | null;
}

export function WithdrawModal({
  open,
  onClose,
  balance,
  serverMode,
  onDone,
  showToast,
  haptic,
  hapticSuccess,
  hapticError,
  prefilledWallet,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState(prefilledWallet || "");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const val = parseFloat(amount) || 0;
  const fee = WITHDRAW_FEE_GRAM;
  const totalNeed = val + fee;
  const can =
    serverMode &&
    val >= MIN_WITHDRAW_TON &&
    totalNeed <= balance &&
    wallet.trim().length >= 20;

  const submit = async () => {
    if (!can || loading) return;
    setLoading(true);
    haptic("medium");
    try {
      const data = await apiFetch<{ ok: boolean; balance: number; fee: number }>(
        "/api/withdraw",
        {
          method: "POST",
          body: JSON.stringify({ amountTon: val, wallet: wallet.trim() }),
        }
      );
      hapticSuccess();
      showToast(`Withdraw ${val} TON queued · fee ${fee}`);
      onDone(data.balance);
      onClose();
      setAmount("");
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Withdraw failed");
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
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <TonIcon size={20} /> Withdraw TON
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/40"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Balance {formatGram(balance)} GRAM · min {MIN_WITHDRAW_TON} TON · fee {fee}
        </p>

        <label className="text-[11px] text-white/40 uppercase tracking-wider">
          Amount (TON)
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Min ${MIN_WITHDRAW_TON}`}
          className="w-full h-12 mt-1 mb-3 rounded-2xl bg-black/35 border border-white/[0.08] px-4 text-base outline-none focus:border-cyan-500/35 tabular-nums"
        />

        <label className="text-[11px] text-white/40 uppercase tracking-wider">
          TON wallet
        </label>
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="UQ… or EQ…"
          className="w-full h-12 mt-1 mb-3 rounded-2xl bg-black/35 border border-white/[0.08] px-4 text-sm font-mono outline-none focus:border-cyan-500/35"
        />

        {val > 0 && (
          <div className="mb-3 text-xs text-white/45 flex justify-between px-1">
            <span>You receive</span>
            <span className="tabular-nums text-white/80">{val} TON</span>
          </div>
        )}
        {val > 0 && (
          <div className="mb-4 text-xs text-white/45 flex justify-between px-1">
            <span>Debited</span>
            <span className="tabular-nums text-white/80">
              {formatGram(totalNeed)} GRAM (incl. fee)
            </span>
          </div>
        )}

        <button
          disabled={!can || loading}
          onClick={submit}
          className="w-full h-12 rounded-2xl btn-primary text-sm btn-press disabled:opacity-40"
        >
          {loading ? "Submitting…" : "Request withdraw"}
        </button>
      </div>
    </div>
  );
}

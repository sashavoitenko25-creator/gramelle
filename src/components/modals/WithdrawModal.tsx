"use client";

import { useEffect, useState } from "react";
import { useTonAddress, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { apiFetch } from "@/lib/api";
import { MIN_WITHDRAW_TON } from "@/lib/constants";
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
  const [tonConnectUI] = useTonConnectUI();
  const walletConnected = useTonWallet();
  const tonAddress = useTonAddress();

  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);

  const val = Number(amount) || 0;
  const can =
    val >= MIN_WITHDRAW_TON &&
    val <= balance + 1e-9 &&
    wallet.trim().length >= 20;

  useEffect(() => {
    if (!open) return;
    setWallet(tonAddress || prefilledWallet || "");
  }, [open, tonAddress, prefilledWallet]);

  if (!open) return null;

  const submit = async () => {
    if (!can || loading) return;
    if (!serverMode) {
      showToast("Open in Telegram with server configured");
      return;
    }
    setLoading(true);
    haptic("light");
    try {
      const res = await apiFetch<{ ok: boolean; balance: number }>(
        "/api/withdraw",
        {
          method: "POST",
          body: JSON.stringify({ amountTon: val, wallet: wallet.trim() }),
        }
      );
      hapticSuccess();
      showToast("Withdraw requested — pending review");
      onDone(res.balance);
      onClose();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const short =
    wallet.length > 12
      ? wallet.slice(0, 6) + "…" + wallet.slice(-4)
      : wallet;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 slide-up border-t border-white/10 safe-bottom">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Withdraw TON</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/40 btn-press"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 mb-4 flex justify-between text-sm">
          <span className="text-white/40">Available</span>
          <span className="tabular-nums font-medium">{formatGram(balance)} GRAM</span>
        </div>

        <label className="text-[11px] text-white/40 uppercase tracking-widest mb-1.5 block">
          Amount (TON)
        </label>
        <input
          type="number"
          inputMode="decimal"
          min={MIN_WITHDRAW_TON}
          step="0.1"
          placeholder={`Min ${MIN_WITHDRAW_TON}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full h-12 rounded-2xl bg-black/30 border border-white/10 px-4 text-base tabular-nums mb-1 outline-none focus:border-cyan-500/40"
        />
        <p className="text-[11px] text-white/35 mb-4">
          Minimum {MIN_WITHDRAW_TON} TON · 1 TON = 1 GRAM · no fee
        </p>

        <label className="text-[11px] text-white/40 uppercase tracking-widest mb-1.5 block">
          Wallet
        </label>
        {walletConnected && tonAddress && !wallet ? null : null}
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="UQ…"
            className="flex-1 h-12 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm font-mono outline-none focus:border-cyan-500/40"
          />
          {!walletConnected && (
            <button
              type="button"
              onClick={() => tonConnectUI.openModal()}
              className="h-12 px-3 rounded-2xl border border-white/10 bg-white/[0.04] text-xs text-cyan-300 btn-press whitespace-nowrap"
            >
              Connect
            </button>
          )}
        </div>
        {walletConnected && tonAddress && (
          <button
            type="button"
            onClick={() => setWallet(tonAddress)}
            className="text-[11px] text-cyan-300/80 mb-4 btn-press"
          >
            Use connected: {short || tonAddress.slice(0, 6) + "…"}
          </button>
        )}

        {val > 0 && val < MIN_WITHDRAW_TON && (
          <p className="text-[12px] text-amber-300/90 mb-3">Min {MIN_WITHDRAW_TON} TON</p>
        )}
        {val >= MIN_WITHDRAW_TON && val > balance && (
          <p className="text-[12px] text-amber-300/90 mb-3">Not enough balance</p>
        )}

        <button
          onClick={submit}
          disabled={!can || loading}
          className="w-full h-12 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <TonIcon className="w-4 h-4" />
          {loading ? "Submitting…" : `Withdraw ${val > 0 ? formatGram(val) + " TON" : ""}`}
        </button>
        <p className="text-[10px] text-white/30 text-center mt-3">
          Requests are reviewed manually. Status appears in Transactions.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTonAddress, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { apiFetch } from "@/lib/api";
import {
  MIN_WITHDRAW_TON,
  WITHDRAW_FEE_GRAM,
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
  const [tonConnectUI] = useTonConnectUI();
  const walletConnected = useTonWallet();
  const tonAddress = useTonAddress();

  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState("");
  const [editingWallet, setEditingWallet] = useState(false);
  const [loading, setLoading] = useState(false);

  const fee = WITHDRAW_FEE_GRAM;
  const val = Number(amount) || 0;
  const totalNeed = val + fee;
  const can =
    val >= MIN_WITHDRAW_TON &&
    totalNeed <= balance + 1e-9 &&
    wallet.trim().length >= 20;

  // Prefill from TonConnect or saved profile when modal opens
  useEffect(() => {
    if (!open) return;
    setEditingWallet(false);
    const fromConnect = tonAddress || "";
    const fromProfile = prefilledWallet || "";
    setWallet(fromConnect || fromProfile || "");
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
      showToast("Withdraw requested — check Transactions");
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
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <TonIcon size={20} /> Withdraw
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/40"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Balance {formatGram(balance)} GRAM · min {MIN_WITHDRAW_TON}{" "}
          <TonIcon size={11} className="inline-block align-[-2px]" /> · fee{" "}
          {fee}
        </p>

        <label className="text-[11px] text-white/40 uppercase tracking-wider flex items-center gap-1.5">
          Amount <TonIcon size={12} />
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

        {!editingWallet && wallet ? (
          <div className="mt-1 mb-3 flex items-center gap-2 rounded-2xl bg-black/35 border border-white/[0.08] px-3 h-12">
            <TonIcon size={18} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-[#6DD3FF]/80">
                {walletConnected ? "From TON Connect" : "Saved address"}
              </div>
              <div className="text-sm font-mono text-white/90 truncate">
                {short}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingWallet(true)}
              className="shrink-0 h-8 px-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-[11px] text-white/60 hover:text-white/90"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="mt-1 mb-3 space-y-2">
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="UQ… or EQ…"
              className="w-full h-12 rounded-2xl bg-black/35 border border-white/[0.08] px-4 text-sm font-mono outline-none focus:border-cyan-500/35"
              autoFocus={editingWallet}
            />
            <div className="flex gap-2">
              {tonAddress && (
                <button
                  type="button"
                  onClick={() => {
                    setWallet(tonAddress);
                    setEditingWallet(false);
                  }}
                  className="flex-1 h-9 rounded-xl border border-[#0098EA]/30 bg-[#0098EA]/10 text-[11px] font-medium text-sky-100 flex items-center justify-center gap-1.5"
                >
                  <TonIcon size={14} /> Use connected
                </button>
              )}
              {!walletConnected && (
                <button
                  type="button"
                  onClick={() => tonConnectUI.openModal()}
                  className="flex-1 h-9 rounded-xl border border-[#0098EA]/30 bg-[#0098EA]/10 text-[11px] font-medium text-sky-100 flex items-center justify-center gap-1.5"
                >
                  <TonIcon size={14} /> Connect wallet
                </button>
              )}
              {editingWallet && wallet.trim().length >= 20 && (
                <button
                  type="button"
                  onClick={() => setEditingWallet(false)}
                  className="h-9 px-3 rounded-xl border border-white/10 bg-white/[0.05] text-[11px] text-white/70"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}

        {val > 0 && (
          <div className="mb-3 text-xs text-white/45 flex justify-between px-1">
            <span>You receive</span>
            <span className="tabular-nums text-white/80 flex items-center gap-1">
              {val} <TonIcon size={12} />
            </span>
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

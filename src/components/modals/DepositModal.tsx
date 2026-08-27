"use client";

import { useState } from "react";
import {
  STAR_PACKAGES,
  TON_PACKAGES,
  TON_DEPOSIT_ADDRESS,
} from "@/lib/constants";
import {
  requestStarsInvoice,
  buildTonTransferLink,
  gramFromStars,
  gramFromTon,
} from "@/lib/payments";
import { createTonPending, checkTonDeposits } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DepositMethod } from "@/lib/types";

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  onCredit: (gram: number) => void;
  telegramId: number | null;
  username: string;
  openStarsInvoice: (
    link: string
  ) => Promise<"paid" | "cancelled" | "failed" | "pending">;
  openLink: (url: string) => void;
  haptic: (s?: "light" | "medium" | "heavy") => void;
  hapticSuccess: () => void;
  hapticError: () => void;
  showToast: (msg: string) => void;
  serverMode?: boolean;
  onBalanceRefresh?: () => Promise<void> | void;
}

export function DepositModal({
  open,
  onClose,
  onCredit,
  telegramId,
  username,
  openStarsInvoice,
  openLink,
  haptic,
  hapticSuccess,
  hapticError,
  showToast,
  serverMode = false,
  onBalanceRefresh,
}: DepositModalProps) {
  const [method, setMethod] = useState<DepositMethod>("stars");
  const [loading, setLoading] = useState(false);
  const [tonStep, setTonStep] = useState<"pick" | "pay">("pick");
  const [tonAmount, setTonAmount] = useState(1);
  const [tonMemo, setTonMemo] = useState("");

  if (!open) return null;

  const resetAndClose = () => {
    setLoading(false);
    setTonStep("pick");
    onClose();
  };

  const payStars = async (stars: number) => {
    if (loading) return;
    setLoading(true);
    haptic("light");

    const result = await requestStarsInvoice(stars, telegramId, username);

    if (!result.ok || !result.invoiceLink) {
      setLoading(false);
      if (
        result.error?.includes("TELEGRAM_BOT_TOKEN") ||
        result.error?.includes("not configured")
      ) {
        if (!serverMode) {
          const gram = gramFromStars(stars);
          onCredit(gram);
          hapticSuccess();
          showToast("+" + gram + " GRAM (demo)");
          resetAndClose();
          return;
        }
      }
      hapticError();
      showToast(result.error || "Payment failed");
      return;
    }

    const status = await openStarsInvoice(result.invoiceLink);
    setLoading(false);

    if (status === "paid") {
      // Production: webhook credits balance. We only refresh.
      if (serverMode && onBalanceRefresh) {
        // short poll for webhook lag
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 800));
          await onBalanceRefresh();
        }
        hapticSuccess();
        showToast("Payment received");
      } else {
        const gram = gramFromStars(stars);
        onCredit(gram);
        hapticSuccess();
        showToast("+" + gram + " GRAM");
      }
      resetAndClose();
    } else if (status === "cancelled") {
      showToast("Payment cancelled");
    } else {
      hapticError();
      showToast("Payment failed");
    }
  };

  const startTonPay = async (ton: number) => {
    haptic("light");
    setTonAmount(ton);

    if (serverMode) {
      try {
        setLoading(true);
        const res = await createTonPending(ton);
        setTonMemo(res.memo);
        setTonStep("pay");
      } catch (e) {
        hapticError();
        showToast(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    } else {
      const memo =
        "gramelle_" +
        (telegramId || username.toLowerCase().replace(/\s+/g, "")) +
        "_" +
        Date.now().toString(36);
      setTonMemo(memo);
      setTonStep("pay");
    }
  };

  const openTonWallet = () => {
    const link = buildTonTransferLink(tonAmount, tonMemo);
    openLink(link);
  };

  const confirmTon = async () => {
    setLoading(true);
    haptic("light");

    if (serverMode) {
      try {
        const res = await checkTonDeposits();
        if (res.credited?.length) {
          const total = res.credited.reduce((s, c) => s + c.gram, 0);
          if (onBalanceRefresh) await onBalanceRefresh();
          hapticSuccess();
          showToast("+" + total + " GRAM");
          resetAndClose();
        } else {
          showToast(res.error || "Not found yet — wait a bit and retry");
        }
      } catch (e) {
        hapticError();
        showToast(e instanceof Error ? e.message : "Check failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    const gram = gramFromTon(tonAmount);
    onCredit(gram);
    hapticSuccess();
    showToast("+" + gram + " GRAM (demo)");
    resetAndClose();
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(TON_DEPOSIT_ADDRESS);
      hapticSuccess();
      showToast("Address copied");
    } catch {
      showToast(TON_DEPOSIT_ADDRESS);
    }
  };

  const copyMemo = async () => {
    try {
      await navigator.clipboard.writeText(tonMemo);
      hapticSuccess();
      showToast("Memo copied");
    } catch {
      showToast(tonMemo);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && resetAndClose()}
    >
      <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 slide-up border-t border-white/10 safe-bottom max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold tracking-tight">Deposit</h3>
          <button
            onClick={resetAndClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/40 btn-press"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-2 p-1 rounded-2xl bg-black/30 border border-white/[0.06] mb-5">
          <button
            onClick={() => {
              setMethod("stars");
              setTonStep("pick");
            }}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 btn-press",
              method === "stars" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-amber-300">
              <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.8 5.7 21l2.3-7-6-4.6h7.6z" />
            </svg>
            Stars
          </button>
          <button
            onClick={() => {
              setMethod("ton");
              setTonStep("pick");
            }}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 btn-press",
              method === "ton" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            )}
          >
            <span className="text-sky-400 text-xs font-bold">TON</span>
            TON
          </button>
        </div>

        {method === "stars" && (
          <div className="space-y-2.5">
            <p className="text-xs text-white/35 mb-3 leading-relaxed">
              Pay with Telegram Stars. Balance is credited by the server after payment confirmation.
            </p>
            {STAR_PACKAGES.map((p) => (
              <button
                key={p.stars}
                disabled={loading}
                onClick={() => payStars(p.stars)}
                className={cn(
                  "w-full flex items-center justify-between rounded-2xl px-4 py-3.5 border transition btn-press",
                  "popular" in p && p.popular
                    ? "bg-amber-500/[0.08] border-amber-500/25"
                    : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fbbf24">
                      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.8 5.7 21l2.3-7-6-4.6h7.6z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold">{p.label} Stars</div>
                    <div className="text-[11px] text-white/35">
                      {p.gram} GRAM
                      {"bonus" in p && p.bonus ? (
                        <span className="text-emerald-400 ml-1">{p.bonus}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {"popular" in p && p.popular && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-300/90 bg-amber-500/15 px-2 py-1 rounded-lg">
                    Popular
                  </span>
                )}
              </button>
            ))}
            {loading && (
              <p className="text-center text-xs text-white/30 pt-2 pulse-soft">
                Opening invoice…
              </p>
            )}
          </div>
        )}

        {method === "ton" && tonStep === "pick" && (
          <div className="space-y-2.5">
            <p className="text-xs text-white/35 mb-3 leading-relaxed">
              Send TON with the exact memo. Server verifies on-chain and credits GRAM.
            </p>
            {TON_PACKAGES.map((p) => (
              <button
                key={p.ton}
                disabled={loading}
                onClick={() => startTonPay(p.ton)}
                className={cn(
                  "w-full flex items-center justify-between rounded-2xl px-4 py-3.5 border transition btn-press",
                  "popular" in p && p.popular
                    ? "bg-sky-500/[0.08] border-sky-500/25"
                    : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-300 text-xs font-bold">
                    TON
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold">{p.label} TON</div>
                    <div className="text-[11px] text-white/35">
                      {p.gram} GRAM
                      {"bonus" in p && p.bonus ? (
                        <span className="text-emerald-400 ml-1">{p.bonus}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {method === "ton" && tonStep === "pay" && (
          <div className="space-y-3">
            <button
              onClick={() => setTonStep("pick")}
              className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1 mb-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>

            <div className="rounded-2xl bg-black/30 border border-white/[0.06] p-4 space-y-3">
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Amount</div>
                <div className="text-xl font-semibold text-sky-300">
                  {tonAmount} TON
                  <span className="text-sm text-white/30 font-normal ml-2">
                    → {gramFromTon(tonAmount)} GRAM
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Address</div>
                <button
                  onClick={copyAddress}
                  className="w-full text-left text-[11px] font-mono text-white/60 break-all bg-white/[0.03] rounded-xl px-3 py-2 border border-white/[0.05]"
                >
                  {TON_DEPOSIT_ADDRESS}
                </button>
              </div>
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Memo (required)</div>
                <button
                  onClick={copyMemo}
                  className="w-full text-left text-[11px] font-mono text-amber-200/80 break-all bg-white/[0.03] rounded-xl px-3 py-2 border border-white/[0.05]"
                >
                  {tonMemo}
                </button>
              </div>
            </div>

            <button
              onClick={openTonWallet}
              className="w-full h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 text-sky-200 text-sm font-semibold btn-press"
            >
              Open wallet
            </button>
            <button
              onClick={confirmTon}
              disabled={loading}
              className="w-full h-11 rounded-2xl btn-secondary text-sm btn-press disabled:opacity-50"
            >
              {loading ? "Checking…" : "I have sent · verify"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import {
  STAR_PACKAGES,
  TON_PACKAGES,
  TON_DEPOSIT_ADDRESS,
  MIN_DEPOSIT_STARS,
  MIN_DEPOSIT_TON,
  TON_PENDING_TTL_SEC,
} from "@/lib/constants";
import {
  requestStarsInvoice,
  buildTonTransferLink,
  gramFromStars,
  gramFromTon,
} from "@/lib/payments";
import { createTonPending, checkTonDeposits } from "@/lib/api";
import { tonAmountToNano } from "@/lib/tonPayload";
import { cn } from "@/lib/utils";
import type { DepositMethod } from "@/lib/types";
import { TonIcon } from "@/components/ui/TonIcon";
import { GramIcon } from "@/components/ui/GramIcon";
import { StarsIcon } from "@/components/ui/StarsIcon";

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
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const [method, setMethod] = useState<DepositMethod>("stars");
  const [loading, setLoading] = useState(false);
  const [tonStep, setTonStep] = useState<"pick" | "pay">("pick");
  const [tonAmount, setTonAmount] = useState(1);
  const [tonInput, setTonInput] = useState("1");
  const [tonMemo, setTonMemo] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [starsInput, setStarsInput] = useState(
    String(STAR_PACKAGES[0]?.stars || 100)
  );

  const starsAmount = useMemo(
    () => Math.floor(Number(starsInput) || 0),
    [starsInput]
  );
  const starsGram = useMemo(
    () => gramFromStars(Math.max(0, starsAmount)),
    [starsAmount]
  );
  const starsOk = starsAmount >= MIN_DEPOSIT_STARS;
  const tonOk = Number.isFinite(tonAmount) && tonAmount >= MIN_DEPOSIT_TON;

  if (!open) return null;

  const resetAndClose = () => {
    setLoading(false);
    setTonStep("pick");
    setTonMemo("");
    setExpiresAt(null);
    onClose();
  };

  const payStars = async (stars: number) => {
    if (loading) return;
    if (stars < MIN_DEPOSIT_STARS) {
      showToast("Min " + MIN_DEPOSIT_STARS + " Stars");
      hapticError();
      return;
    }
    setLoading(true);
    haptic("light");
    const result = await requestStarsInvoice(stars, telegramId, username);
    if (!result.ok || !result.invoiceLink) {
      setLoading(false);
      if (
        (result.error?.includes("TELEGRAM_BOT_TOKEN") ||
          result.error?.includes("not configured")) &&
        !serverMode
      ) {
        const gram = gramFromStars(stars);
        onCredit(gram);
        hapticSuccess();
        showToast("+" + gram + " GRAM (demo)");
        resetAndClose();
        return;
      }
      hapticError();
      showToast(result.error || "Payment failed");
      return;
    }
    const status = await openStarsInvoice(result.invoiceLink);
    setLoading(false);
    if (status === "paid") {
      if (serverMode && onBalanceRefresh) await onBalanceRefresh();
      else if (!serverMode) onCredit(gramFromStars(stars));
      hapticSuccess();
      showToast("Payment received");
      resetAndClose();
    } else if (status === "cancelled") {
      showToast("Cancelled");
    } else {
      showToast("Pending — balance updates after confirmation");
      if (onBalanceRefresh) setTimeout(() => void onBalanceRefresh(), 2500);
    }
  };

  const startTonDeposit = async (amt: number) => {
    if (loading) return;
    if (!Number.isFinite(amt) || amt < MIN_DEPOSIT_TON) {
      showToast("Min " + MIN_DEPOSIT_TON + " TON");
      hapticError();
      return;
    }
    setTonAmount(amt);
    setTonInput(String(amt));
    setLoading(true);
    haptic("light");
    try {
      if (serverMode) {
        const pending = await createTonPending(amt);
        setTonMemo(pending.memo || "");
        setExpiresAt(
          (pending as { expiresAt?: string }).expiresAt ||
            (pending as { deposit?: { expires_at?: string } }).deposit
              ?.expires_at ||
            null
        );
        setTonStep("pay");
      } else {
        setTonMemo(
          "gramelle_" +
            (telegramId || username.toLowerCase().replace(/\s+/g, "")) +
            "_" +
            Date.now().toString(36)
        );
        setExpiresAt(
          new Date(Date.now() + TON_PENDING_TTL_SEC * 1000).toISOString()
        );
        setTonStep("pay");
      }
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const payWithTonConnect = async () => {
    if (loading || !tonMemo) return;
    if (!wallet) {
      tonConnectUI.openModal();
      return;
    }
    setLoading(true);
    haptic("light");
    try {
      const nano = tonAmountToNano(tonAmount);
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: TON_DEPOSIT_ADDRESS,
            amount: String(nano),
            payload: undefined,
          },
        ],
      });
      // Comment/memo: TonConnect payload varies; also offer manual memo
      showToast("Sent — checking payment…");
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        if (!serverMode) break;
        try {
          const res = await checkTonDeposits();
          if (res.credited?.length) {
            const total = res.credited.reduce((s, c) => s + c.gram, 0);
            if (onBalanceRefresh) await onBalanceRefresh();
            hapticSuccess();
            showToast("+" + total + " GRAM");
            resetAndClose();
            setLoading(false);
            return;
          }
        } catch {
          /* continue */
        }
      }
      showToast("Not confirmed yet — tap Check payment");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cancelled";
      if (!/reject|cancel|abort/i.test(msg)) {
        hapticError();
        showToast(msg);
      }
    } finally {
      setLoading(false);
    }
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
          showToast(
            res.message === "No pending deposits"
              ? "Expired or not found — create a new deposit"
              : res.error || "Not found yet — wait and retry"
          );
        }
      } catch (e) {
        hapticError();
        showToast(e instanceof Error ? e.message : "Check failed");
      } finally {
        setLoading(false);
      }
      return;
    }
    onCredit(gramFromTon(tonAmount));
    hapticSuccess();
    showToast("+" + gramFromTon(tonAmount) + " GRAM (demo)");
    resetAndClose();
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      hapticSuccess();
      showToast(label + " copied");
    } catch {
      showToast(text);
    }
  };

  const minsLeft = expiresAt
    ? Math.max(
        0,
        Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000)
      )
    : Math.floor(TON_PENDING_TTL_SEC / 60);

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

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-2xl bg-black/40 border border-white/[0.06] mb-4">
          {(
            [
              ["stars", "Stars"],
              ["ton", "TON"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setMethod(id);
                setTonStep("pick");
              }}
              className={cn(
                "flex-1 h-10 rounded-xl text-sm font-medium transition btn-press",
                method === id
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* STARS */}
        {method === "stars" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {STAR_PACKAGES.map((p) => (
                <button
                  key={p.stars}
                  disabled={loading}
                  onClick={() => void payStars(p.stars)}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] px-3 py-3.5 text-left btn-press disabled:opacity-50"
                >
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <StarsIcon className="w-4 h-4" />
                    {p.stars}
                    {p.popular && (
                      <span className="text-[9px] text-cyan-300/80 ml-1">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/40 mt-1 flex items-center gap-1">
                    → {p.gram} GRAM
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={starsInput}
                onChange={(e) => setStarsInput(e.target.value)}
                className="flex-1 h-11 rounded-xl bg-black/30 border border-white/10 px-3 text-sm tabular-nums outline-none focus:border-cyan-500/40"
                placeholder={`Min ${MIN_DEPOSIT_STARS}`}
              />
              <button
                disabled={loading || !starsOk}
                onClick={() => void payStars(starsAmount)}
                className="h-11 px-4 rounded-xl btn-primary text-sm font-medium btn-press disabled:opacity-40"
              >
                Pay · {starsGram} GRAM
              </button>
            </div>
          </div>
        )}

        {/* TON pick */}
        {method === "ton" && tonStep === "pick" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {TON_PACKAGES.map((p) => (
                <button
                  key={p.ton}
                  disabled={loading}
                  onClick={() => void startTonDeposit(p.ton)}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] px-3 py-3.5 text-left btn-press disabled:opacity-50"
                >
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <TonIcon className="w-4 h-4" />
                    {p.ton} TON
                  </div>
                  <div className="text-[11px] text-white/40 mt-1 flex items-center gap-1">
                    → {p.gram} <GramIcon size={12} /> GRAM
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={tonInput}
                onChange={(e) => {
                  setTonInput(e.target.value);
                  const n = Number(e.target.value.replace(",", "."));
                  if (Number.isFinite(n)) setTonAmount(+n.toFixed(4));
                }}
                className="flex-1 h-11 rounded-xl bg-black/30 border border-white/10 px-3 text-sm tabular-nums outline-none focus:border-cyan-500/40"
                placeholder={`Min ${MIN_DEPOSIT_TON}`}
              />
              <button
                disabled={loading || !tonOk}
                onClick={() => void startTonDeposit(tonAmount)}
                className="h-11 px-4 rounded-xl btn-primary text-sm font-medium btn-press disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* TON pay */}
        {method === "ton" && tonStep === "pay" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="text-2xl font-semibold tabular-nums flex items-center gap-2">
                <TonIcon className="w-6 h-6" />
                {tonAmount} TON
              </div>
              <div className="text-sm text-white/50 mt-1">
                → {gramFromTon(tonAmount)} GRAM
              </div>
              <div className="text-[11px] text-amber-300/80 mt-2">
                Pending · ~{minsLeft} min left
              </div>
            </div>

            <details className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <summary className="text-xs text-white/50 cursor-pointer py-1">
                Payment details
              </summary>
              <div className="mt-2 space-y-2 pb-1">
                <div>
                  <div className="text-[10px] text-white/35 mb-0.5">Address</div>
                  <button
                    type="button"
                    onClick={() => copy(TON_DEPOSIT_ADDRESS, "Address")}
                    className="w-full text-left text-[11px] font-mono text-white/70 break-all"
                  >
                    {TON_DEPOSIT_ADDRESS}
                  </button>
                </div>
                <div>
                  <div className="text-[10px] text-white/35 mb-0.5">
                    Memo (required)
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(tonMemo, "Memo")}
                    className="w-full text-left text-[11px] font-mono text-cyan-300/90 break-all"
                  >
                    {tonMemo || "—"}
                  </button>
                </div>
              </div>
            </details>

            <button
              disabled={loading}
              onClick={() => void payWithTonConnect()}
              className="w-full h-12 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-50"
            >
              {wallet ? "Pay with wallet" : "Connect wallet & pay"}
            </button>
            <button
              disabled={loading}
              onClick={() => {
                openLink(buildTonTransferLink(tonAmount, tonMemo));
              }}
              className="w-full h-11 rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white/70 btn-press"
            >
              Open in TON wallet app
            </button>
            <button
              disabled={loading}
              onClick={() => void confirmTon()}
              className="w-full h-11 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-sm text-cyan-300 font-medium btn-press disabled:opacity-50"
            >
              {loading ? "Checking…" : "I paid — check payment"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTonStep("pick");
                setTonMemo("");
              }}
              className="w-full text-center text-[12px] text-white/40 py-1"
            >
              ← Change amount
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

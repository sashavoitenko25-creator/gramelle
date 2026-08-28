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
  MAX_DEPOSIT_STARS,
  MIN_DEPOSIT_TON,
  MAX_DEPOSIT_TON,
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
import { StarsIcon } from "@/components/ui/StarsIcon";
import { GRAM_PER_STAR } from "@/lib/constants";

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
  const [starsInput, setStarsInput] = useState(String(STAR_PACKAGES[0]?.stars || 100));

  const starsAmount = useMemo(() => {
    const n = Math.floor(Number(starsInput) || 0);
    return n;
  }, [starsInput]);

  const starsGram = useMemo(() => gramFromStars(Math.max(0, starsAmount)), [starsAmount]);
  const starsOk = starsAmount >= MIN_DEPOSIT_STARS;

  const tonOk =
    Number.isFinite(tonAmount) && tonAmount >= MIN_DEPOSIT_TON;

  if (!open) return null;

  const resetAndClose = () => {
    setLoading(false);
    setTonStep("pick");
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
      if (serverMode && onBalanceRefresh) {
        await onBalanceRefresh();
      } else if (!serverMode) {
        onCredit(gramFromStars(stars));
      }
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

  const applyTonInput = (raw: string) => {
    setTonInput(raw);
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n)) setTonAmount(+n.toFixed(4));
  };

  const startTonDeposit = async (amount?: number) => {
    if (loading) return;
    const amt = amount != null ? amount : tonAmount;
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
        setTonStep("pay");
      } else {
        const memo =
          "gramelle_" +
          (telegramId || username.toLowerCase().replace(/\s+/g, "")) +
          "_" +
          Date.now().toString(36);
        setTonMemo(memo);
        setTonStep("pay");
      }
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const pollCredit = async () => {
    if (!serverMode) return false;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const res = await checkTonDeposits();
        if (res.credited?.length) {
          const total = res.credited.reduce((s, c) => s + c.gram, 0);
          if (onBalanceRefresh) await onBalanceRefresh();
          hapticSuccess();
          showToast("+" + total + " GRAM");
          resetAndClose();
          return true;
        }
      } catch {
        /* continue */
      }
    }
    return false;
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
      // No payload/memo in Connect — wallets reject custom BOC ("Invalid data format").
      // Credit is matched by amount + your pending deposit (see /api/ton/check).
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: TON_DEPOSIT_ADDRESS,
            amount: tonAmountToNano(tonAmount),
          },
        ],
      });
      showToast("Sent — checking network…");
      const ok = await pollCredit();
      if (!ok) showToast("Sent. Tap “I paid” if balance not updated yet");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      if (/reject|cancel|abort|user/i.test(msg)) {
        showToast("Cancelled");
      } else {
        hapticError();
        // Fallback: Tonkeeper deep link includes memo
        try {
          openLink(buildTonTransferLink(tonAmount, tonMemo));
          showToast("Open wallet and confirm transfer");
        } catch {
          showToast(msg);
        }
      }
    } finally {
      setLoading(false);
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

        <div className="flex gap-2 p-1 rounded-2xl bg-black/40 border border-white/[0.06] mb-4">
          {(
            [
              ["stars", "Stars", "stars"] as const,
              ["ton", "TON", "ton"] as const,
            ]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setMethod(id);
                setTonStep("pick");
              }}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold transition btn-press flex items-center justify-center gap-1.5",
                method === id
                  ? "bg-white/10 text-white border border-white/10"
                  : "text-white/40 border border-transparent"
              )}
            >
              {id === "stars" ? <StarsIcon size={16} /> : <TonIcon size={16} />}
              {label}
            </button>
          ))}
        </div>

        {method === "stars" && (
          <div className="space-y-3">
            <p className="text-[11px] text-white/35 leading-relaxed">
              Pay with Telegram Stars. Rate:{" "}
              <span className="text-white/55">1</span>{" "}
              <StarsIcon size={11} className="inline-block align-[-2px]" /> ={" "}
              <span className="text-white/55">0.0085 GRAM</span>
              {" "}· Min {MIN_DEPOSIT_STARS}{" "}
              <StarsIcon size={11} className="inline-block align-[-2px]" />
            </p>

            {/* Custom amount */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
              <label className="text-[10px] uppercase tracking-wider text-white/35">
                Custom amount
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_DEPOSIT_STARS}
                  
                  value={starsInput}
                  onChange={(e) => setStarsInput(e.target.value)}
                  className="flex-1 h-11 rounded-xl bg-black/35 border border-white/10 px-3 text-sm font-semibold tabular-nums outline-none focus:border-cyan-400/40"
                  placeholder={String(MIN_DEPOSIT_STARS)}
                />
                <span className="text-xs text-white/40 shrink-0 flex items-center gap-1">
                  <StarsIcon size={14} /> Stars
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className={starsOk ? "text-white/40" : "text-amber-300/90"}>
                  {starsOk
                    ? `→ ${starsGram.toFixed(4)} GRAM`
                    : `Min ${MIN_DEPOSIT_STARS} Stars`}
                </span>
              </div>
              <button
                type="button"
                disabled={loading || !starsOk}
                onClick={() => payStars(starsAmount)}
                className="mt-3 w-full h-11 rounded-xl btn-primary text-sm font-semibold btn-press disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  "…"
                ) : (
                  <>
                    <StarsIcon size={16} />
                    Pay {starsAmount || 0}
                  </>
                )}
              </button>
            </div>

            <div className="text-[10px] text-white/25 text-center uppercase tracking-wider">
              or quick packages
            </div>

            {STAR_PACKAGES.map((p) => (
              <button
                key={p.stars}
                disabled={loading}
                onClick={() => {
                  setStarsInput(String(p.stars));
                  void payStars(p.stars);
                }}
                className="w-full flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5 hover:bg-white/[0.05] transition btn-press disabled:opacity-50"
              >
                <div className="text-left flex items-center gap-2.5">
                  <StarsIcon size={22} />
                  <div>
                    <div className="text-sm font-semibold">{p.stars} Stars</div>
                    <div className="text-[11px] text-white/35">
                      → {p.gram} GRAM
                    </div>
                  </div>
                </div>
                <span className="text-xs text-cyan-300 font-medium">Buy</span>
              </button>
            ))}
          </div>
        )}

        {method === "ton" && tonStep === "pick" && (
          <div className="space-y-3">
            <p className="text-[11px] text-white/35 leading-relaxed">
              1 TON ≈ 1 GRAM. Min {MIN_DEPOSIT_TON} TON. Prefer{" "}
              <span className="text-sky-300/90">TON Connect</span>.
            </p>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
              <label className="text-[10px] uppercase tracking-wider text-white/35">
                Custom amount
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={MIN_DEPOSIT_TON}
                  
                  step="0.1"
                  value={tonInput}
                  onChange={(e) => applyTonInput(e.target.value)}
                  className="flex-1 h-11 rounded-xl bg-black/35 border border-white/10 px-3 text-sm font-semibold tabular-nums outline-none focus:border-cyan-400/40"
                  placeholder={String(MIN_DEPOSIT_TON)}
                />
                <span className="text-xs text-white/40 shrink-0 flex items-center gap-1">
                  <TonIcon size={14} /> TON
                </span>
              </div>
              <div className="mt-2 text-[11px]">
                <span className={tonOk ? "text-white/40" : "text-amber-300/90"}>
                  {tonOk
                    ? `→ ${gramFromTon(tonAmount)} GRAM`
                    : `Min ${MIN_DEPOSIT_TON} TON`}
                </span>
              </div>
              <button
                type="button"
                disabled={loading || !tonOk}
                onClick={() => void startTonDeposit()}
                className="mt-3 w-full h-11 rounded-xl btn-primary text-sm font-semibold btn-press disabled:opacity-40"
              >
                {loading ? "…" : "Continue"}
              </button>
            </div>

            <div className="text-[10px] text-white/25 text-center uppercase tracking-wider">
              or quick packages
            </div>

            {TON_PACKAGES.map((p) => (
              <button
                key={p.ton}
                disabled={loading}
                onClick={() => void startTonDeposit(p.ton)}
                className="w-full flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5 hover:bg-white/[0.05] transition btn-press disabled:opacity-50"
              >
                <div className="text-left flex items-center gap-2.5">
                  <TonIcon size={22} />
                  <div>
                    <div className="text-sm font-semibold">{p.ton} TON</div>
                    <div className="text-[11px] text-white/35">→ {p.gram} GRAM</div>
                  </div>
                </div>
                <span className="text-xs text-cyan-300 font-medium">Select</span>
              </button>
            ))}
          </div>
        )}

        {method === "ton" && tonStep === "pay" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setTonStep("pick")}
              className="text-[12px] text-white/40 hover:text-white/70"
            >
              ← Back
            </button>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Amount</span>
                <span className="font-semibold tabular-nums">
                  {tonAmount} TON → {gramFromTon(tonAmount)} GRAM
                </span>
              </div>
              <div className="flex items-start justify-between gap-2 text-sm">
                <span className="text-white/40 shrink-0">Address</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="text-[11px] font-mono text-right text-cyan-300/90 break-all"
                >
                  {TON_DEPOSIT_ADDRESS.slice(0, 8)}…{TON_DEPOSIT_ADDRESS.slice(-6)} · copy
                </button>
              </div>
              <div className="flex items-start justify-between gap-2 text-sm">
                <span className="text-white/40 shrink-0">Memo</span>
                <button
                  type="button"
                  onClick={copyMemo}
                  className="text-[11px] font-mono text-right text-amber-200/90 break-all"
                >
                  {tonMemo} · copy
                </button>
              </div>
              <p className="text-[10px] text-amber-200/70 pt-1">
                Memo is required. Without it the deposit cannot be credited.
              </p>
            </div>

            {/* Primary: TON Connect */}
            <button
              type="button"
              disabled={loading}
              onClick={() => void payWithTonConnect()}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#0098EA] to-cyan-500 text-sm font-semibold text-white btn-press shadow-[0_0_28px_rgba(0,152,234,0.25)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 56 56" fill="none">
                <path
                  d="M28 12.2L43.6 22V34L28 43.8L12.4 34V22L28 12.2Z"
                  fill="white"
                />
              </svg>
              {wallet
                ? loading
                  ? "Confirm in wallet…"
                  : "Pay with TON Connect"
                : "Connect & pay"}
            </button>

            <button
              type="button"
              onClick={openTonWallet}
              className="w-full h-11 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-medium text-white/70 btn-press"
            >
              Open Tonkeeper (manual)
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => void confirmTon()}
              className="w-full h-11 rounded-2xl btn-primary text-sm font-semibold btn-press disabled:opacity-40"
            >
              {loading ? "Checking…" : "I paid — check status"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

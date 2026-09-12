"use client";
import { useI18n } from "@/lib/i18n/context";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import {
  TON_PACKAGES,
  TON_DEPOSIT_ADDRESS,
  MIN_DEPOSIT_TON,
  TON_PENDING_TTL_SEC,
} from "@/lib/constants";
import {
  gramFromTon,
} from "@/lib/payments";
import { createTonPending, checkTonDeposits } from "@/lib/api";
import { tonAmountToNano } from "@/lib/tonPayload";
import { cn } from "@/lib/utils";
import { TonIcon } from "@/components/ui/TonIcon";
import { GramIcon } from "@/components/ui/GramIcon";

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  onCredit: (gram: number) => void;
  telegramId: number | null;
  username: string;
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
  openLink,
  haptic,
  hapticSuccess,
  hapticError,
  showToast,
  serverMode = false,
  onBalanceRefresh,
}: DepositModalProps) {
  const { t } = useI18n();

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [loading, setLoading] = useState(false);
  const [tonStep, setTonStep] = useState<"pick" | "pay">("pick");
  const [tonAmount, setTonAmount] = useState(1);
  const [tonInput, setTonInput] = useState("1");
  const [tonMemo, setTonMemo] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const tonOk = Number.isFinite(tonAmount) && tonAmount >= MIN_DEPOSIT_TON;

  const resetAndClose = () => {
    setLoading(false);
    setTonStep("pick");
    setTonMemo("");
    setExpiresAt(null);
    onClose();
  };

  // Auto-detect TON deposit while on pay step (Connect + manual)
  const creditedRef = useRef(false);
  useEffect(() => {
    if (!open || tonStep !== "pay" || !serverMode || !tonMemo) {
      creditedRef.current = false;
      return;
    }
    creditedRef.current = false;
    let stopped = false;
    const tick = async () => {
      if (stopped || creditedRef.current) return;
      try {
        const res = await checkTonDeposits();
        if (stopped) return;
        if (res.credited?.length) {
          creditedRef.current = true;
          const total = res.credited.reduce((s, x) => s + x.gram, 0);
          if (onBalanceRefresh) await onBalanceRefresh();
          hapticSuccess();
          showToast(t("plusGram", { n: total }));
          resetAndClose();
        }
      } catch {
        /* keep polling */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 4000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tonStep, serverMode, tonMemo]);


  if (!open) return null;

  const startTonDeposit = async (amt: number) => {
    if (loading) return;
    if (!Number.isFinite(amt) || amt < MIN_DEPOSIT_TON) {
      showToast(t("minTon", { n: MIN_DEPOSIT_TON }));
      hapticError();
      return;
    }
    // Only move to pay UI — do NOT create server intent / history yet
    setTonAmount(amt);
    setTonInput(String(amt));
    setTonMemo("");
    setExpiresAt(null);
    haptic("light");
    setTonStep("pay");
  };

  const ensurePending = async (amt: number) => {
    if (tonMemo) return tonMemo;
    if (serverMode) {
      const pending = await createTonPending(amt);
      const memo = pending.memo || "";
      setTonMemo(memo);
      setExpiresAt(
        (pending as { expiresAt?: string }).expiresAt ||
          (pending as { deposit?: { expires_at?: string } }).deposit
            ?.expires_at ||
          null
      );
      return memo;
    }
    const memo =
      "gramelle_" +
      (telegramId || username.toLowerCase().replace(/\s+/g, "")) +
      "_" +
      Date.now().toString(36);
    setTonMemo(memo);
    setExpiresAt(
      new Date(Date.now() + TON_PENDING_TTL_SEC * 1000).toISOString()
    );
    return memo;
  };


  const payWithTonConnect = async () => {
    if (loading) return;
    if (!wallet) {
      tonConnectUI.openModal();
      return;
    }
    if (
      !TON_DEPOSIT_ADDRESS ||
      TON_DEPOSIT_ADDRESS.includes("UQAAAA") ||
      TON_DEPOSIT_ADDRESS.length < 20
    ) {
      showToast("Не задан TON-адрес депозита (NEXT_PUBLIC_TON_WALLET)");
      hapticError();
      return;
    }
    setLoading(true);
    haptic("light");
    try {
      const memo = await ensurePending(tonAmount);
      try {
        await navigator.clipboard.writeText(memo);
      } catch {
        /* ignore */
      }

      const nano = tonAmountToNano(tonAmount);
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: TON_DEPOSIT_ADDRESS,
            amount: nano,
          },
        ],
      });
      showToast("Memo скопирован. Вставьте его в комментарий перевода в кошельке!");
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (/reject|cancel|abort|user.?reject/i.test(raw)) {
        return;
      }
      hapticError();
      // Surface short readable error (SDK often wraps as "TonConnect SDK error")
      const short =
        raw.replace(/TonConnectSDKError[:\s]*/i, "").trim() || raw;
      showToast(
        short.slice(0, 100) ||
          "Ошибка TonConnect. Скопируйте адрес и memo, отправьте вручную."
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmTon = async () => {
    setLoading(true);
    haptic("light");
    if (serverMode) {
      try {
        await ensurePending(tonAmount);
        const res = await checkTonDeposits();
        if (res.credited?.length) {
          const total = res.credited.reduce((s, c) => s + c.gram, 0);
          if (onBalanceRefresh) await onBalanceRefresh();
          hapticSuccess();
          showToast(t("plusGram", { n: total }));
          resetAndClose();
        } else {
          showToast(
            res.message === "No pending deposits" /* mapped below */
              ? t("expiredDeposit")
              : res.error || t("notFoundRetry")
          );
        }
      } catch (e) {
        hapticError();
        showToast(e instanceof Error ? e.message : t("checkFailed"));
      } finally {
        setLoading(false);
      }
      return;
    }
    onCredit(gramFromTon(tonAmount));
    hapticSuccess();
    showToast(t("demoGram", { n: gramFromTon(tonAmount) }));
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
          <h3 className="text-lg font-semibold tracking-tight">{t("depositTitle")}</h3>
          <button
            onClick={resetAndClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/40 btn-press"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* TON pick */}
        {tonStep === "pick" && (
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
                    {p.ton} TON
                    <TonIcon className="w-4 h-4" />
                  </div>
                  <div className="text-[11px] text-white/40 mt-1 flex items-center gap-1">
                    → {p.gram} GRAM <GramIcon size={12} />
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
                placeholder={`Мин. ${MIN_DEPOSIT_TON}`}
              />
              <button
                disabled={loading || !tonOk}
                onClick={() => void startTonDeposit(tonAmount)}
                className="h-11 px-4 rounded-xl btn-primary text-sm font-medium btn-press disabled:opacity-40"
              >
                {t("continue")}
              </button>
            </div>
          </div>
        )}

        {/* TON pay */}
        {tonStep === "pay" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="text-2xl font-semibold tabular-nums flex items-center gap-2">
                {tonAmount} TON
                <TonIcon className="w-6 h-6" />
              </div>
              <div className="text-sm text-white/50 mt-1 flex items-center gap-1">
                → {gramFromTon(tonAmount)} GRAM <GramIcon size={14} />
              </div>
              <div className="text-[11px] text-amber-300/80 mt-2">
                {t("pendingMinLeft", { n: minsLeft })}
              </div>
            </div>

            <details className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <summary className="text-xs text-white/50 cursor-pointer py-1">
                {t("paymentDetails")}
              </summary>
              <div className="mt-2 space-y-2 pb-1">
                <div>
                  <div className="text-[10px] text-white/35 mb-0.5">{t("address")}</div>
                  <button
                    type="button"
                    onClick={() => copy(TON_DEPOSIT_ADDRESS, t("address"))}
                    className="w-full text-left text-[11px] font-mono text-white/70 break-all"
                  >
                    {TON_DEPOSIT_ADDRESS}
                  </button>
                </div>
                <div>
                  <div className="text-[10px] text-white/35 mb-0.5">
                    {t("memo")}
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(tonMemo, t("memo"))}
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
              {wallet ? t("payWithWallet") : t("connectWalletPay")}
            </button>
            <p className="text-[11px] text-white/45 text-center leading-snug px-1">
              {serverMode
                ? "Нажмите «Оплатить» и подтвердите в кошельке — баланс обновится автоматически."
                : ""}
            </p>
            <button
              type="button"
              onClick={() => {
                setTonStep("pick");
                setTonMemo("");
              }}
              className="w-full text-center text-[12px] text-white/40 py-1"
            >
              ← Изменить сумму
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

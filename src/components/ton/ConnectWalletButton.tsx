"use client";

import { useEffect, useState } from "react";
import {
  useTonConnectUI,
  useTonWallet,
  useTonAddress,
} from "@tonconnect/ui-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  onAddress?: (addr: string | null) => void;
}

export function ConnectWalletButton({ className, onAddress }: Props) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const address = useTonAddress();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onAddress?.(address || null);
    if (address) {
      setSaving(true);
      apiFetch("/api/wallet", {
        method: "POST",
        body: JSON.stringify({ address }),
      })
        .catch(() => {})
        .finally(() => setSaving(false));
    }
  }, [address, onAddress]);

  if (wallet && address) {
    const short = address.slice(0, 4) + "…" + address.slice(-4);
    return (
      <button
        onClick={() => tonConnectUI.disconnect()}
        className={cn(
          "w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 border border-[#0098EA]/30 bg-[#0098EA]/10 text-left btn-press",
          className
        )}
      >
        <div className="min-w-0">
          <div className="text-[10px] text-[#6DD3FF]/80 uppercase tracking-wider">
            Connected {saving ? "· saving" : ""}
          </div>
          <div className="text-sm font-medium font-mono text-white/90 truncate">
            {short}
          </div>
        </div>
        <span className="text-[11px] text-white/40 shrink-0">Disconnect</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => tonConnectUI.openModal()}
      className={cn(
        "w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 border border-[#0098EA]/35 bg-gradient-to-r from-[#0098EA]/20 to-cyan-500/10 text-sm font-semibold text-sky-100 btn-press shadow-[0_0_24px_rgba(0,152,234,0.15)]",
        className
      )}
    >
      <svg width="18" height="18" viewBox="0 0 56 56" fill="none">
        <path d="M28 12.2L43.6 22V34L28 43.8L12.4 34V22L28 12.2Z" fill="#0098EA" />
      </svg>
      Connect TON Wallet
    </button>
  );
}

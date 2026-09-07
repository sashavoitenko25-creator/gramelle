"use client";

import { TonConnectProvider } from "@/components/ton/TonConnectProvider";
import { LanguageProvider } from "@/lib/i18n/context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <TonConnectProvider>{children}</TonConnectProvider>
    </LanguageProvider>
  );
}

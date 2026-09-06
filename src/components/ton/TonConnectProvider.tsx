"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { ReactNode, useMemo } from "react";

export function TonConnectProvider({ children }: { children: ReactNode }) {
  const manifestUrl = useMemo(() => {
    if (typeof window === "undefined") return "/tonconnect-manifest.json";
    return `${window.location.origin}/tonconnect-manifest.json`;
  }, []);

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        // Return into Gramelle Mini App (not a third-party host label)
        twaReturnUrl:
          typeof window !== "undefined"
            ? `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || "Gramelle_bot"}`
            : undefined,
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}

"use client";

import { TonConnectProvider } from "@/components/ton/TonConnectProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <TonConnectProvider>{children}</TonConnectProvider>;
}

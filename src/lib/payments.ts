import { GRAM_PER_STAR, GRAM_PER_TON, TON_DEPOSIT_ADDRESS } from "./constants";

export type PaymentProvider = "stars" | "ton";

export function gramFromStars(stars: number): number {
  return stars * GRAM_PER_STAR;
}

export function gramFromTon(ton: number): number {
  return Math.round(ton * GRAM_PER_TON * 100) / 100;
}

export function buildTonTransferLink(amountTon: number, comment: string): string {
  const nano = Math.round(amountTon * 1e9);
  const addr = TON_DEPOSIT_ADDRESS;
  return `https://app.tonkeeper.com/transfer/${addr}?amount=${nano}&text=${encodeURIComponent(comment)}`;
}

export function buildTonMemo(telegramId: number | null, username: string): string {
  const id = telegramId ? String(telegramId) : username.toLowerCase().replace(/\s+/g, "");
  return `gramelle_${id}_${Date.now().toString(36)}`;
}

export interface StarsInvoiceResult {
  ok: boolean;
  invoiceLink?: string;
  error?: string;
  payload?: string;
}

function authHeaders(): HeadersInit {
  const initData =
    typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (initData) {
    h["Authorization"] = `tma ${initData}`;
    h["x-telegram-init-data"] = initData;
  }
  return h;
}

export async function requestStarsInvoice(
  stars: number,
  telegramId: number | null,
  username: string
): Promise<StarsInvoiceResult> {
  try {
    const res = await fetch("/api/stars-invoice", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ stars, telegramId, username }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || "Invoice failed" };
    }
    return {
      ok: true,
      invoiceLink: data.invoiceLink,
      payload: data.payload,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

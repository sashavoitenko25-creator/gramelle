import {
  GRAM_PER_TON,
  TON_DEPOSIT_ADDRESS,
  TON_PACKAGES,
} from "./constants";

export type PaymentProvider = "ton";

/** 1 TON = 1 GRAM base rate (package bonuses applied via package.gram) */
export function gramFromTon(ton: number): number {
  const pack = TON_PACKAGES.find((p) => p.ton === ton);
  if (pack) return pack.gram;
  return Math.round(ton * GRAM_PER_TON * 10000) / 10000;
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

/**
 * TON transfer comment payload for TonConnect (base64 BOC).
 * Uses @ton/core so wallets accept the body (no "Invalid data").
 */
import { beginCell } from "@ton/core";

export function tonCommentPayload(comment: string): string {
  const text = String(comment || "").trim();
  if (!text) throw new Error("Empty comment");
  if (text.length > 120) throw new Error("Comment too long");

  return beginCell()
    .storeUint(0, 32) // text comment op
    .storeStringTail(text)
    .endCell()
    .toBoc({ idx: false, crc32: true })
    .toString("base64");
}

export function tonAmountToNano(ton: number): string {
  return String(Math.round(Number(ton) * 1e9));
}

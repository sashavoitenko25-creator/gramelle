import { beginCell } from "@ton/core";

/** Base64 BOC payload: text comment for TON transfer (op 0). */
export function tonCommentPayload(comment: string): string {
  const cell = beginCell()
    .storeUint(0, 32)
    .storeStringTail(comment)
    .endCell();
  return cell.toBoc().toString("base64");
}

export function tonAmountToNano(ton: number): string {
  return String(Math.round(ton * 1e9));
}

/**
 * TON transfer comment as base64 BOC (text_comment op=0).
 * Pure implementation — no @ton/core.
 *
 * Cell data layout: 32 zero bits + UTF-8 bytes (aligned).
 * BOC: magic + flags(no idx, no crc) + 1 cell + 1 root.
 */

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/** Base64 BOC payload for transfer memo/comment. */
export function tonCommentPayload(comment: string): string {
  const text = new TextEncoder().encode(comment);
  if (text.length > 120) {
    throw new Error("Comment too long");
  }

  // data bits = 32 (op) + 8 * text.length  — always byte-aligned
  const dataLen = 4 + text.length;
  const data = new Uint8Array(dataLen);
  data.set(text, 4); // op stays 0

  // Cell: refs_descriptor=0, bits_descriptor=2*(bitLen/8)=2*dataLen
  const cell = new Uint8Array(2 + dataLen);
  cell[0] = 0; // no refs
  cell[1] = 2 * dataLen;
  cell.set(data, 2);

  // BOC without CRC32C (more compatible for small payloads)
  // flags: has_idx=0, has_crc32c=0, has_cache_bits=0, flags=0, size_bytes=1 → 0x01
  const out = new Uint8Array(4 + 1 + 1 + 1 + 1 + 1 + 1 + cell.length);
  let o = 0;
  out[o++] = 0xb5;
  out[o++] = 0xee;
  out[o++] = 0x9c;
  out[o++] = 0x72;
  out[o++] = 0x01; // size_bytes = 1, no crc
  out[o++] = 1; // cells
  out[o++] = 1; // roots
  out[o++] = 0; // absent
  out[o++] = cell.length; // total cells size
  out[o++] = 0; // root index
  out.set(cell, o);

  return toBase64(out);
}

export function tonAmountToNano(ton: number): string {
  return String(Math.round(Number(ton) * 1e9));
}

/**
 * TON transfer comment as base64 BOC (op=0 text comment).
 * TonConnect-compatible — wallet embeds this as the message body.
 */

/** CRC-32C (Castagnoli) — used by TON BOC */
function crc32c(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0x82f63b78 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/**
 * Build BOC for a simple text comment (TL-B: op=0 + UTF-8).
 * Fits in one cell if comment ≤ 120 bytes.
 */
export function tonCommentPayload(comment: string): string {
  const text = new TextEncoder().encode(comment);
  if (text.length === 0) throw new Error("Empty comment");
  if (text.length > 120) throw new Error("Comment too long");

  // Cell data: 32-bit zero (text comment op) + UTF-8 bytes
  const dataLen = 4 + text.length;
  const data = new Uint8Array(dataLen);
  // first 4 bytes already 0 = op 0
  data.set(text, 4);

  // Cell representation: d1, d2, data…
  // d1: level=0, no hashes, not exotic, 0 refs → 0
  // d2: for byte-aligned data of N bytes → 2*N
  const cell = new Uint8Array(2 + dataLen);
  cell[0] = 0;
  cell[1] = 2 * dataLen;
  cell.set(data, 2);

  // BOC: magic | flags | #cells | #roots | #absent | tot_cells_size | root_idx | cells | crc32c
  // flags: has_idx=0, has_crc32c=1, has_cache_bits=0, flags=0, size=1 → 0b01000001 = 0x41
  const body = new Uint8Array(4 + 1 + 1 + 1 + 1 + 1 + 1 + cell.length);
  let o = 0;
  body[o++] = 0xb5;
  body[o++] = 0xee;
  body[o++] = 0x9c;
  body[o++] = 0x72;
  body[o++] = 0x41; // has_crc32c, size_bytes=1
  body[o++] = 1; // cells
  body[o++] = 1; // roots
  body[o++] = 0; // absent
  body[o++] = cell.length; // total cells size (1 byte because size=1)
  body[o++] = 0; // root index 0
  body.set(cell, o);

  const crc = crc32c(body);
  const out = new Uint8Array(body.length + 4);
  out.set(body);
  // little-endian CRC32C
  out[body.length] = crc & 0xff;
  out[body.length + 1] = (crc >>> 8) & 0xff;
  out[body.length + 2] = (crc >>> 16) & 0xff;
  out[body.length + 3] = (crc >>> 24) & 0xff;

  return toBase64(out);
}

export function tonAmountToNano(ton: number): string {
  return String(Math.round(Number(ton) * 1e9));
}

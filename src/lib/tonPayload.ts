/**
 * TON transfer comment as base64 BOC (op=0 text comment).
 * TonConnect-compatible.
 */

/** CRC-32C (Castagnoli) */
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
 * Build BOC for text comment (TL-B: text_comment$0000 data:Text = SnakeData).
 * Simple path: 32-bit 0 + raw UTF-8 (fits in one cell if ≤120 bytes).
 */
export function tonCommentPayload(comment: string): string {
  const text = new TextEncoder().encode(comment);
  if (text.length === 0) throw new Error("Empty comment");
  if (text.length > 120) throw new Error("Comment too long");

  const dataLen = 4 + text.length;
  const data = new Uint8Array(dataLen);
  data.set(text, 4);

  const cell = new Uint8Array(2 + dataLen);
  cell[0] = 0; // no refs, level 0
  cell[1] = 2 * dataLen; // byte-aligned bits
  cell.set(data, 2);

  // BOC with CRC32C
  const bodyLen = 4 + 1 + 1 + 1 + 1 + 1 + 1 + cell.length;
  const body = new Uint8Array(bodyLen);
  let o = 0;
  body[o++] = 0xb5;
  body[o++] = 0xee;
  body[o++] = 0x9c;
  body[o++] = 0x72;
  body[o++] = 0x05; // has_crc32c, size_bytes=1
  body[o++] = 1;
  body[o++] = 1;
  body[o++] = 0;
  body[o++] = cell.length;
  body[o++] = 0;
  body.set(cell, o);

  const crc = crc32c(body);
  const out = new Uint8Array(body.length + 4);
  out.set(body);
  // little-endian CRC
  out[body.length] = crc & 0xff;
  out[body.length + 1] = (crc >>> 8) & 0xff;
  out[body.length + 2] = (crc >>> 16) & 0xff;
  out[body.length + 3] = (crc >>> 24) & 0xff;

  return toBase64(out);
}

export function tonAmountToNano(ton: number): string {
  return String(Math.round(Number(ton) * 1e9));
}

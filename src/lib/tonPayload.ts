/**
 * TON transfer comment as base64 BOC (op=0 text comment).
 * Pure JS — no @ton/core required. Matches @ton/core toBoc({ idx:false, crc32:true }).
 */

/** CRC-32C (Castagnoli), little-endian bytes — same as @ton/core */
function crc32c(source: Uint8Array): Uint8Array {
  let crc = 0 ^ 0xffffffff;
  for (let n = 0; n < source.length; n++) {
    crc ^= source[n];
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0x82f63b78 : crc >>> 1;
    }
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const res = new Uint8Array(4);
  res[0] = crc & 0xff;
  res[1] = (crc >>> 8) & 0xff;
  res[2] = (crc >>> 16) & 0xff;
  res[3] = (crc >>> 24) & 0xff;
  return res;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/**
 * Build BOC for text comment (TL-B: op=0 + UTF-8).
 * Fits in one cell if comment ≤ 120 bytes.
 */
export function tonCommentPayload(comment: string): string {
  const text = new TextEncoder().encode(String(comment || "").trim());
  if (text.length === 0) throw new Error("Empty comment");
  if (text.length > 120) throw new Error("Comment too long");

  // Cell: d1, d2, data (4 zero bytes = op 0, then UTF-8)
  const dataLen = 4 + text.length;
  const cell = new Uint8Array(2 + dataLen);
  cell[0] = 0; // d1: 0 refs
  cell[1] = 2 * dataLen; // d2: byte-aligned
  cell.set(text, 6);

  // BOC: magic | flags | offBytes | #cells | #roots | #absent | totSize | rootIdx | cell | crc32c
  // flags 0x41 = has_crc32c + sizeBytes=1 (no idx)
  const sizeBytes = 1;
  const offsetBytes = 1;
  const totalCellSize = cell.length;
  const body = new Uint8Array(
    4 + 1 + 1 + sizeBytes * 3 + offsetBytes + sizeBytes + totalCellSize
  );
  let o = 0;
  body[o++] = 0xb5;
  body[o++] = 0xee;
  body[o++] = 0x9c;
  body[o++] = 0x72;
  body[o++] = 0x41; // has_crc32c, size=1
  body[o++] = offsetBytes;
  body[o++] = 1; // cells
  body[o++] = 1; // roots
  body[o++] = 0; // absent
  body[o++] = totalCellSize;
  body[o++] = 0; // root index
  body.set(cell, o);

  const crc = crc32c(body);
  const out = new Uint8Array(body.length + 4);
  out.set(body);
  out.set(crc, body.length);
  return toBase64(out);
}

export function tonAmountToNano(ton: number): string {
  return String(Math.round(Number(ton) * 1e9));
}

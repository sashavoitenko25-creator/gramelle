/**
 * Pure TON comment payload (no @ton/core).
 * Builds a single-cell BOC: op=0 + UTF-8 text. Suitable for TonConnect transfer comments.
 */

function crc32c(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0x82f63b78 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/** Base64 BOC payload for text comment (InternalMsgBody text_comment). */
export function tonCommentPayload(comment: string): string {
  const text = new TextEncoder().encode(comment);
  if (text.length > 120) {
    throw new Error("Comment too long for single cell");
  }

  // bits: 32-bit op (0) + utf8 bytes
  const bitLength = 32 + text.length * 8;
  const dataLen = bitLength >> 3; // always multiple of 8
  const data = new Uint8Array(dataLen);
  // first 4 bytes already 0 (op)
  data.set(text, 4);

  // Cell descriptors (no refs, level 0, not exotic)
  const refsDescriptor = 0;
  // bits_descriptor = floor(b/8)+ceil(b/8) = 2 * (bitLength/8) when aligned
  const bitsDescriptor = 2 * dataLen;

  const cellBytes = new Uint8Array(2 + dataLen);
  cellBytes[0] = refsDescriptor;
  cellBytes[1] = bitsDescriptor;
  cellBytes.set(data, 2);

  // BOC with CRC32C, no index, 1 root, 1 cell
  // magic b5ee9c72
  // byte: has_idx(1)|has_crc32c(1)|has_cache_bits(1)|flags(2)|size_bytes(3)
  // size_bytes = 1
  // has_idx=0, has_crc32c=1, has_cache_bits=0, flags=0 → 0b01000_001 = 0x41
  const sizeBytes = 1;
  const cellsNum = 1;
  const rootsNum = 1;
  const absentNum = 0;
  const totalCellsSize = cellBytes.length;
  const rootIndex = 0;

  const payloadLen =
    4 + // magic
    1 + // flags+size
    sizeBytes + // cells
    sizeBytes + // roots
    sizeBytes + // absent
    sizeBytes + // total size
    sizeBytes + // root index
    totalCellsSize +
    4; // crc32c

  const out = new Uint8Array(payloadLen);
  let o = 0;
  out[o++] = 0xb5;
  out[o++] = 0xee;
  out[o++] = 0x9c;
  out[o++] = 0x72;
  out[o++] = 0x40 | sizeBytes; // has_crc32c + size_bytes=1 → 0x41? 
  // bit7 has_idx=0, bit6 has_crc32c=1, bit5 has_cache=0, bits4-3 flags=0, bits2-0 size=1
  // 0b01000001 = 0x41
  out[4] = 0x41;
  o = 5;
  out[o++] = cellsNum;
  out[o++] = rootsNum;
  out[o++] = absentNum;
  out[o++] = totalCellsSize;
  out[o++] = rootIndex;
  out.set(cellBytes, o);
  o += cellBytes.length;

  const crc = crc32c(out.subarray(0, o));
  out[o++] = crc & 0xff;
  out[o++] = (crc >>> 8) & 0xff;
  out[o++] = (crc >>> 16) & 0xff;
  out[o++] = (crc >>> 24) & 0xff;

  return toBase64(out);
}

export function tonAmountToNano(ton: number): string {
  return String(Math.round(ton * 1e9));
}

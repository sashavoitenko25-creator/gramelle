/**
 * Client-safe Provably Fair helpers (mirrors server HMAC RNG).
 * Anyone can recompute the winner from published seeds + bets.
 */

export function hashSeed(seed: string): string {
  // SubtleCrypto not always available in Node path; use Web Crypto when present
  // For pure browser verify we use async; sync fallback for display uses hex compare only.
  return seed; // placeholder — real hash is async in browser
}

/** Deterministic 0..1 — same algorithm as server seededRandom */
export async function seededRandomAsync(
  serverSeed: string,
  clientSeed: string,
  rollId: number
): Promise<number> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(serverSeed),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${clientSeed}:${rollId}`)
  );
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < 7; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  // 13 hex chars like server (parseInt slice 0,13)
  const full = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return parseInt(full.slice(0, 13), 16) / 0x1fffffffffffff;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface VerifyBet {
  telegramId: number;
  username: string;
  amount: number;
}

export interface VerifyInput {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  rollId: number;
  bets: VerifyBet[];
  claimedWinnerTelegramId?: number;
}

export interface VerifyResult {
  ok: boolean;
  hashMatches: boolean;
  computedHash: string;
  roll: number;
  total: number;
  winnerTelegramId: number;
  winnerUsername: string;
  winnerMatchesClaim: boolean | null;
  error?: string;
}

export async function verifyRound(input: VerifyInput): Promise<VerifyResult> {
  try {
    if (!input.serverSeed || !input.serverSeedHash) {
      return {
        ok: false,
        hashMatches: false,
        computedHash: "",
        roll: 0,
        total: 0,
        winnerTelegramId: 0,
        winnerUsername: "",
        winnerMatchesClaim: null,
        error: "Missing seeds",
      };
    }

    const computedHash = await sha256Hex(input.serverSeed);
    const hashMatches =
      computedHash.toLowerCase() === input.serverSeedHash.toLowerCase();

    const bets = input.bets.filter((b) => Number(b.amount) > 0);
    if (bets.length < 1) {
      return {
        ok: false,
        hashMatches,
        computedHash,
        roll: 0,
        total: 0,
        winnerTelegramId: 0,
        winnerUsername: "",
        winnerMatchesClaim: null,
        error: "No bets",
      };
    }

    const total = bets.reduce((s, b) => s + Number(b.amount), 0);
    const roll = await seededRandomAsync(
      input.serverSeed,
      input.clientSeed || "gramelle",
      input.rollId
    );

    let cursor = roll * total;
    let winner = bets[0];
    for (const b of bets) {
      cursor -= Number(b.amount);
      if (cursor <= 0) {
        winner = b;
        break;
      }
    }

    const winnerMatchesClaim =
      input.claimedWinnerTelegramId != null
        ? Number(input.claimedWinnerTelegramId) === Number(winner.telegramId)
        : null;

    const ok =
      hashMatches &&
      (winnerMatchesClaim === null || winnerMatchesClaim === true);

    return {
      ok,
      hashMatches,
      computedHash,
      roll,
      total,
      winnerTelegramId: winner.telegramId,
      winnerUsername: winner.username,
      winnerMatchesClaim,
    };
  } catch (e) {
    return {
      ok: false,
      hashMatches: false,
      computedHash: "",
      roll: 0,
      total: 0,
      winnerTelegramId: 0,
      winnerUsername: "",
      winnerMatchesClaim: null,
      error: e instanceof Error ? e.message : "Verify failed",
    };
  }
}

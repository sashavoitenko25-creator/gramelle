import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { seededRandom } from "@/lib/server/round";

/**
 * Public Provably Fair verification.
 * GET ?rollId=123 — returns finished round data + recomputed winner.
 * POST body { serverSeed, serverSeedHash, clientSeed, rollId, bets } — pure recompute.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const rollId = Number(req.nextUrl.searchParams.get("rollId"));
    if (!Number.isFinite(rollId)) {
      return NextResponse.json({ error: "rollId required" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: round, error } = await db
      .from("rounds")
      .select("*")
      .eq("roll_id", rollId)
      .eq("status", "finished")
      .maybeSingle();

    if (error) throw error;
    if (!round) {
      return NextResponse.json(
        { error: "Finished round not found" },
        { status: 404 }
      );
    }

    const { data: betsData } = await db
      .from("round_bets")
      .select("telegram_id, username, amount, color")
      .eq("round_id", round.id);

    const bets = (betsData || []).map((b) => ({
      telegramId: Number(b.telegram_id),
      username: String(b.username),
      amount: Number(b.amount),
      color: String(b.color || ""),
    }));

    const serverSeed = String(round.server_seed || "");
    const serverSeedHash = String(round.server_seed_hash || "");
    const clientSeed = String(round.client_seed || "gramelle");
    const computedHash = crypto
      .createHash("sha256")
      .update(serverSeed)
      .digest("hex");
    const hashMatches =
      computedHash.toLowerCase() === serverSeedHash.toLowerCase();

    const total = bets.reduce((s, b) => s + b.amount, 0);
    const roll = seededRandom(serverSeed, clientSeed, Number(round.roll_id));
    let cursor = roll * total;
    let winner = bets[0];
    for (const b of bets) {
      cursor -= b.amount;
      if (cursor <= 0) {
        winner = b;
        break;
      }
    }

    const claimed = Number(round.winner_telegram_id);
    const winnerMatches = winner
      ? Number(winner.telegramId) === claimed
      : false;

    return NextResponse.json({
      ok: hashMatches && winnerMatches,
      rollId: Number(round.roll_id),
      mode: round.mode,
      status: round.status,
      serverSeed,
      serverSeedHash,
      clientSeed,
      computedHash,
      hashMatches,
      roll,
      total,
      houseFee: Number(round.house_fee || 0),
      potAfterFee: Number(round.pot_after_fee || 0),
      spinDegrees: Number(round.spin_degrees || 0),
      claimedWinnerTelegramId: claimed,
      computedWinner: winner || null,
      winnerMatches,
      bets,
      createdAt: round.created_at,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verify failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const serverSeed = String(body.serverSeed || "");
    const serverSeedHash = String(body.serverSeedHash || "");
    const clientSeed = String(body.clientSeed || "gramelle");
    const rollId = Number(body.rollId);
    const bets = Array.isArray(body.bets) ? body.bets : [];

    if (!serverSeed || !Number.isFinite(rollId)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const computedHash = crypto
      .createHash("sha256")
      .update(serverSeed)
      .digest("hex");
    const hashMatches = serverSeedHash
      ? computedHash.toLowerCase() === serverSeedHash.toLowerCase()
      : true;

    const normalized = bets.map(
      (b: { telegramId?: number; telegram_id?: number; username?: string; amount?: number }) => ({
        telegramId: Number(b.telegramId ?? b.telegram_id),
        username: String(b.username || ""),
        amount: Number(b.amount || 0),
      })
    );
    const total = normalized.reduce(
      (s: number, b: { amount: number }) => s + b.amount,
      0
    );
    const roll = seededRandom(serverSeed, clientSeed, rollId);
    let cursor = roll * total;
    let winner = normalized[0];
    for (const b of normalized) {
      cursor -= b.amount;
      if (cursor <= 0) {
        winner = b;
        break;
      }
    }

    return NextResponse.json({
      ok: hashMatches,
      computedHash,
      hashMatches,
      roll,
      total,
      winner,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verify failed" },
      { status: 500 }
    );
  }
}

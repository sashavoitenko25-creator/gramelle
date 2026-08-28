import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "No DB" }, { status: 503 });
    }
    const rollId = Number(req.nextUrl.searchParams.get("rollId"));
    if (!Number.isFinite(rollId)) {
      return NextResponse.json({ error: "Invalid rollId" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: round, error } = await db
      .from("rounds")
      .select(
        "id, roll_id, mode, total_bank, house_fee, pot_after_fee, winner_telegram_id, server_seed_hash, server_seed, created_at, status"
      )
      .eq("roll_id", rollId)
      .eq("status", "finished")
      .maybeSingle();

    if (error) throw error;
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const { data: bets } = await db
      .from("round_bets")
      .select("telegram_id, username, amount, color")
      .eq("round_id", round.id);

    const list = bets || [];
    const bank = Number(round.total_bank || 0);
    const pot = Number(round.pot_after_fee || bank);
    const houseFee = Number(round.house_fee || 0);
    const winnerTg =
      round.winner_telegram_id != null
        ? Number(round.winner_telegram_id)
        : null;

    const ids = [...new Set(list.map((b) => b.telegram_id).filter(Boolean))];
    const photoByTg = new Map<number, string>();
    const nameByTg = new Map<number, string>();
    if (ids.length) {
      const { data: profiles } = await db
        .from("profiles")
        .select("telegram_id, photo_url, username")
        .in("telegram_id", ids);
      for (const p of profiles || []) {
        if (p.telegram_id != null) {
          if (p.photo_url) photoByTg.set(Number(p.telegram_id), String(p.photo_url));
          if (p.username) nameByTg.set(Number(p.telegram_id), String(p.username));
        }
      }
    }

    const players = list.map((b) => {
      const amt = Number(b.amount) || 0;
      const chance = bank > 0 ? +((amt / bank) * 100).toFixed(2) : 0;
      const tg = Number(b.telegram_id);
      return {
        username: b.username || nameByTg.get(tg) || "Player",
        amount: amt,
        chance,
        color: b.color,
        photoUrl: photoByTg.get(tg) || null,
        isWinner: winnerTg != null && tg === winnerTg,
      };
    });

    players.sort((a, b) => Number(b.isWinner) - Number(a.isWinner) || b.amount - a.amount);

    const winnerRow = players.find((p) => p.isWinner);
    const winnerAmt = winnerRow?.amount || 0;
    const mult = winnerAmt > 0 ? +(pot / winnerAmt).toFixed(2) : 0;

    return NextResponse.json({
      rollId: Number(round.roll_id),
      mode: round.mode,
      bank,
      pot,
      houseFee,
      winner: winnerRow?.username || "—",
      winnerPhoto: winnerRow?.photoUrl || null,
      chance: winnerRow?.chance || 0,
      mult,
      serverSeedHash: round.server_seed_hash,
      serverSeed: round.server_seed,
      at: round.created_at,
      players,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

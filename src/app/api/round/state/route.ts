import { NextRequest, NextResponse } from "next/server";
import { getRoundState } from "@/lib/server/round";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { DEFAULT_ROOM, type RoomMode } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ round: null, bets: [], demo: true });
    }

    const mode = (req.nextUrl.searchParams.get("mode") as RoomMode) || DEFAULT_ROOM;
    const result = await getRoundState(mode);

    const mapBets = (bets: typeof result.bets) =>
      bets.map((b) => ({
        telegramId: b.telegram_id,
        username: b.username,
        amount: Number(b.amount),
        color: b.color,
        photoUrl: b.photo_url || null,
      }));

    if (result.action === "spun" && result.spin) {
      const s = result.spin;
      return NextResponse.json({
        round: {
          id: s.round.id,
          rollId: s.round.roll_id,
          mode: s.round.mode || mode,
          status: "finished",
          totalBank: s.round.total_bank,
          spinDegrees: s.spinDegrees,
          winnerTelegramId: s.winner.telegram_id,
          serverSeed: s.round.server_seed,
          serverSeedHash: s.round.server_seed_hash,
          houseFee: s.houseFee,
          potAfterFee: s.potAfterFee,
        },
        bets: mapBets(s.bets),
        spinResult: {
          rollId: s.round.roll_id,
          spinDegrees: s.spinDegrees,
          winnerTelegramId: s.winner.telegram_id,
          winnerUsername: s.winner.username,
          mult: s.mult,
          total: s.round.total_bank,
          potAfterFee: s.potAfterFee,
          houseFee: s.houseFee,
          serverSeed: s.round.server_seed!,
          serverSeedHash: s.round.server_seed_hash,
        },
      });
    }

    const round = result.round;
    return NextResponse.json({
      round: round
        ? {
            id: round.id,
            rollId: round.roll_id,
            mode: round.mode || mode,
            status: round.status,
            totalBank: round.total_bank,
            countdownEndsAt: round.countdown_ends_at,
            serverSeedHash: round.server_seed_hash,
            spinDegrees: round.spin_degrees,
            winnerTelegramId: round.winner_telegram_id,
          }
        : null,
      bets: mapBets(result.bets),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed",
        round: null,
        bets: [],
      },
      { status: 500 }
    );
  }
}

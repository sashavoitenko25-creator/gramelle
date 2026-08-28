import { NextRequest, NextResponse } from "next/server";
import {
  getRoundState,
  getRecentFinishedSpin,
  ensureOpenRound,
  enrichBetsWithPhotos,
  getOpenRound,
} from "@/lib/server/round";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { DEFAULT_ROOM, type RoomMode } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ round: null, bets: [], demo: true });
    }

    const mode =
      (req.nextUrl.searchParams.get("mode") as RoomMode) || DEFAULT_ROOM;
    const result = await getRoundState(mode);

    const mapBets = (
      bets: { telegram_id: number; username: string; amount: number; color: string; photo_url?: string | null }[]
    ) =>
      bets.map((b) => ({
        telegramId: b.telegram_id,
        username: b.username,
        amount: Number(b.amount),
        color: b.color,
        photoUrl: b.photo_url || null,
      }));

    // Authoritative spin this tick
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

    // Late client: recent finished spin + current open lobby
    const recent = await getRecentFinishedSpin(mode, 14000);
    let open = result.round;
    let openBets = result.bets;
    if (!open || open.status === "finished") {
      open = await ensureOpenRound(mode);
      const db = getAdminClient();
      const { data: betsData } = await db
        .from("round_bets")
        .select("telegram_id, username, amount, color")
        .eq("round_id", open.id);
      openBets = await enrichBetsWithPhotos((betsData || []) as typeof result.bets);
    }

    const payload: Record<string, unknown> = {
      round: open
        ? {
            id: open.id,
            rollId: open.roll_id,
            mode: open.mode || mode,
            status: open.status,
            totalBank: open.total_bank,
            countdownEndsAt: open.countdown_ends_at,
            serverSeedHash: open.server_seed_hash,
            spinDegrees: open.spin_degrees,
            winnerTelegramId: open.winner_telegram_id,
          }
        : null,
      bets: mapBets(openBets || []),
    };

    if (recent && recent.spinDegrees > 0) {
      payload.spinResult = {
        rollId: recent.round.roll_id,
        spinDegrees: recent.spinDegrees,
        winnerTelegramId: recent.winner.telegram_id,
        winnerUsername: recent.winner.username,
        mult: recent.mult,
        total: recent.round.total_bank,
        potAfterFee: recent.potAfterFee,
        houseFee: recent.houseFee,
        serverSeed: recent.round.server_seed,
        serverSeedHash: recent.round.server_seed_hash,
        bets: mapBets(recent.bets),
      };
    }

    return NextResponse.json(payload);
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

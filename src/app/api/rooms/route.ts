import { NextResponse } from "next/server";
import { ROOMS, type RoomMode } from "@/lib/constants";
import { getOpenRound } from "@/lib/server/round";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { getAdminClient } from "@/lib/server/supabase";

export async function GET() {
  const rooms = await Promise.all(
    (Object.keys(ROOMS) as RoomMode[]).map(async (id) => {
      const cfg = ROOMS[id];
      let players = 0;
      let bank = 0;
      let status = "open";
      let rollId: number | null = null;

      if (isSupabaseConfigured()) {
        try {
          const round = await getOpenRound(id);
          if (round) {
            status = round.status;
            bank = Number(round.total_bank);
            rollId = round.roll_id;
            const db = getAdminClient();
            const { count } = await db
              .from("round_bets")
              .select("*", { count: "exact", head: true })
              .eq("round_id", round.id);
            players = count || 0;
          }
        } catch {
          // ignore
        }
      }

      return {
        id,
        name: cfg.name,
        description: cfg.description,
        minBet: cfg.minBet,
        maxBet: cfg.maxBet,
        houseEdge: cfg.houseEdge,
        maxPlayers: cfg.maxPlayers,
        countdownSec: cfg.countdownSec,
        players,
        bank,
        status,
        rollId,
      };
    })
  );

  return NextResponse.json({ rooms });
}

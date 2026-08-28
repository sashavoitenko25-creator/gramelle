import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

/** Public feed of last finished rounds (no auth). */
export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ items: [], demo: true });
    }
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") || 12),
      30
    );
    const mode = req.nextUrl.searchParams.get("mode");
    const db = getAdminClient();

    let q = db
      .from("rounds")
      .select(
        "id, roll_id, mode, total_bank, house_fee, pot_after_fee, winner_telegram_id, server_seed_hash, server_seed, created_at"
      )
      .eq("status", "finished")
      .order("roll_id", { ascending: false })
      .limit(limit);

    if (mode === "classic" || mode === "high") {
      q = q.eq("mode", mode);
    }

    const { data: rounds, error } = await q;
    if (error) throw error;
    if (!rounds?.length) return NextResponse.json({ items: [] });

    const rollIds = rounds.map((r) => r.roll_id);
    const { data: hist } = await db
      .from("game_history")
      .select("roll_id, winner, chance")
      .in("roll_id", rollIds);

    const byRoll = new Map<number, { winner: string; chance: number }>();
    for (const h of hist || []) {
      const rid = Number(h.roll_id);
      if (!byRoll.has(rid)) {
        byRoll.set(rid, {
          winner: String(h.winner || "—"),
          chance: Number(h.chance || 0),
        });
      }
    }

    const items = rounds.map((r) => {
      const meta = byRoll.get(Number(r.roll_id));
      return {
        rollId: Number(r.roll_id),
        mode: r.mode,
        bank: Number(r.total_bank || 0),
        pot: Number(r.pot_after_fee || r.total_bank || 0),
        houseFee: Number(r.house_fee || 0),
        winner: meta?.winner || "—",
        chance: meta?.chance || 0,
        serverSeedHash: r.server_seed_hash,
        hasSeed: Boolean(r.server_seed),
        at: r.created_at,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { items: [], error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

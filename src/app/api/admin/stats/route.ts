import { NextRequest, NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/lib/server/admin";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

/** Safe count: if table missing, return 0 instead of breaking whole stats */
async function safeCount(
  db: ReturnType<typeof getAdminClient>,
  table: string,
  filters?: (q: any) => any
): Promise<number> {
  try {
    let q = db.from(table).select("id", { count: "exact", head: true });
    if (filters) q = filters(q);
    const { count, error } = await q;
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "No DB" }, { status: 503 });
    }
    const db = getAdminClient();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      players,
      banned,
      pendingWd,
      { data: deposits },
      { data: bets },
      rpsFinished,
      raceFinished,
      diceFinished,
      xoFinished,
    ] = await Promise.all([
      safeCount(db, "profiles"),
      safeCount(db, "profiles", (q) => q.eq("banned", true)),
      safeCount(db, "withdrawals", (q) => q.eq("status", "pending")),
      db
        .from("ledger")
        .select("amount")
        .in("reason", ["deposit_ton", "deposit_stars"])
        .gte("created_at", since),
      db.from("ledger").select("amount").eq("reason", "bet").gte("created_at", since),
      safeCount(db, "rps_rooms", (q) =>
        q.eq("status", "finished").gte("created_at", since)
      ),
      safeCount(db, "race_rooms", (q) =>
        q.eq("status", "finished").gte("created_at", since)
      ),
      safeCount(db, "dice_rooms", (q) =>
        q.eq("status", "finished").gte("created_at", since)
      ),
      safeCount(db, "xo_rooms", (q) =>
        q.eq("status", "finished").gte("created_at", since)
      ),
    ]);

    const depositVol = (deposits || []).reduce(
      (s, r) => s + Number(r.amount || 0),
      0
    );
    const betVol = (bets || []).reduce(
      (s, r) => s + Math.abs(Number(r.amount || 0)),
      0
    );

    const rounds24h = rpsFinished + raceFinished + diceFinished + xoFinished;

    return NextResponse.json({
      players,
      banned,
      pendingWithdrawals: pendingWd,
      deposits24h: +depositVol.toFixed(2),
      bets24h: +betVol.toFixed(2),
      // frontend expects this key
      rounds24h,
      // detailed breakdown (optional for UI)
      rpsFinished24h: rpsFinished,
      raceFinished24h: raceFinished,
      diceFinished24h: diceFinished,
      xoFinished24h: xoFinished,
    });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/stats]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

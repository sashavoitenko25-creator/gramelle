import { NextRequest, NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/lib/server/admin";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "No DB" }, { status: 503 });
    }
    const db = getAdminClient();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: players },
      { count: banned },
      { count: pendingWd },
      { data: deposits },
      { data: bets },
      { count: rounds24 },
    ] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("profiles").select("id", { count: "exact", head: true }).eq("banned", true),
      db
        .from("withdrawals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      db
        .from("ledger")
        .select("amount")
        .in("reason", ["deposit_stars", "deposit_ton"])
        .gte("created_at", since),
      db.from("ledger").select("amount").eq("reason", "bet").gte("created_at", since),
      db
        .from("rounds")
        .select("id", { count: "exact", head: true })
        .eq("status", "finished")
        .gte("created_at", since),
    ]);

    const depositVol = (deposits || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const betVol = (bets || []).reduce((s, r) => s + Math.abs(Number(r.amount || 0)), 0);

    return NextResponse.json({
      players: players || 0,
      banned: banned || 0,
      pendingWithdrawals: pendingWd || 0,
      deposits24h: +depositVol.toFixed(2),
      bets24h: +betVol.toFixed(2),
      rounds24h: rounds24 || 0,
    });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

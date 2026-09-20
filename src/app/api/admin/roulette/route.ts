import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/server/admin";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { ROULETTE_SLOT_COUNT } from "@/lib/rouletteConstants";

export const dynamic = "force-dynamic";

type Color = "red" | "black" | "green";

function emptyCounts(): Record<Color, number> {
  return { red: 0, black: 0, green: 0 };
}

function pct(n: number, total: number) {
  if (total <= 0) return 0;
  return +((n / total) * 100).toFixed(2);
}

/** Exact count via PostgREST head+count (not capped by row limit). */
async function countColor(
  db: ReturnType<typeof getAdminClient>,
  color: Color,
  sinceIso?: string
): Promise<number> {
  let q = db
    .from("roulette_rounds")
    .select("id", { count: "exact", head: true })
    .eq("status", "settled")
    .eq("result_color", color);
  if (sinceIso) q = q.gte("created_at", sinceIso);
  const { count, error } = await q;
  if (error) {
    console.warn("[admin/roulette] count", color, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "No DB" }, { status: 503 });
    }
    const db = getAdminClient();
    const now = Date.now();
    const since24 = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Exact totals — not limited by max-rows (1000)
    const colors: Color[] = ["red", "black", "green"];
    const [allR, allB, allG, d7R, d7B, d7G, d24R, d24B, d24G] =
      await Promise.all([
        countColor(db, "red"),
        countColor(db, "black"),
        countColor(db, "green"),
        countColor(db, "red", since7d),
        countColor(db, "black", since7d),
        countColor(db, "green", since7d),
        countColor(db, "red", since24),
        countColor(db, "black", since24),
        countColor(db, "green", since24),
      ]);

    const all = { red: allR, black: allB, green: allG };
    const d7 = { red: d7R, black: d7B, green: d7G };
    const d24 = { red: d24R, black: d24B, green: d24G };

    const totalAll = all.red + all.black + all.green;
    const total24 = d24.red + d24.black + d24.green;
    const total7 = d7.red + d7.black + d7.green;

    const expected = {
      red: +((7 / ROULETTE_SLOT_COUNT) * 100).toFixed(2),
      black: +((7 / ROULETTE_SLOT_COUNT) * 100).toFixed(2),
      green: +((1 / ROULETTE_SLOT_COUNT) * 100).toFixed(2),
    };

    // Recent strip + hourly (last 24h sample for charts — not the totals)
    const { data: recentRows } = await db
      .from("roulette_rounds")
      .select("id, result_color, result_slot, created_at")
      .eq("status", "settled")
      .not("result_color", "is", null)
      .order("created_at", { ascending: false })
      .limit(120);

    const recent = (recentRows || []).map((r) => ({
      id: r.id as string,
      color: r.result_color as Color,
      slot: r.result_slot as number | null,
      at: r.created_at as string,
    }));

    const byHour: number[] = Array.from({ length: 24 }, () => 0);
    const byHourColor: Record<Color, number[]> = {
      red: Array.from({ length: 24 }, () => 0),
      black: Array.from({ length: 24 }, () => 0),
      green: Array.from({ length: 24 }, () => 0),
    };

    // Hourly chart: fetch 24h rows in pages (up to ~5k)
    let page = 0;
    const pageSize = 1000;
    let fetched24 = 0;
    for (;;) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data: chunk } = await db
        .from("roulette_rounds")
        .select("result_color, created_at")
        .eq("status", "settled")
        .not("result_color", "is", null)
        .gte("created_at", since24)
        .order("created_at", { ascending: false })
        .range(from, to);
      const rows = chunk || [];
      if (rows.length === 0) break;
      for (const r of rows) {
        const c = r.result_color as Color;
        if (c !== "red" && c !== "black" && c !== "green") continue;
        const hour = new Date(r.created_at as string).getHours();
        byHour[hour] += 1;
        byHourColor[c][hour] += 1;
        fetched24 += 1;
      }
      if (rows.length < pageSize) break;
      page += 1;
      if (page > 20) break; // safety
    }

    // Economy 24h from bets (paginated)
    let stake24 = 0;
    let payout24 = 0;
    let betsCount24 = 0;
    const players = new Set<number>();
    {
      let bp = 0;
      for (;;) {
        const from = bp * pageSize;
        const to = from + pageSize - 1;
        const { data: bets } = await db
          .from("roulette_bets")
          .select("telegram_id, amount, payout, created_at")
          .gte("created_at", since24)
          .order("created_at", { ascending: false })
          .range(from, to);
        const rows = bets || [];
        if (rows.length === 0) break;
        for (const b of rows) {
          stake24 += Number(b.amount) || 0;
          payout24 += b.payout != null ? Number(b.payout) : 0;
          betsCount24 += 1;
          players.add(Number(b.telegram_id));
        }
        if (rows.length < pageSize) break;
        bp += 1;
        if (bp > 30) break;
      }
    }
    const house24 = +(stake24 - payout24).toFixed(4);

    // Streaks on recent strip
    let maxStreak = { color: "red" as Color, len: 0 };
    let cur: Color | null = null;
    let curLen = 0;
    for (const r of recent) {
      if (r.color === cur) {
        curLen += 1;
      } else {
        cur = r.color;
        curLen = 1;
      }
      if (curLen > maxStreak.len) {
        maxStreak = { color: cur, len: curLen };
      }
    }

    const { data: active } = await db
      .from("roulette_rounds")
      .select("id, status, bet_ends_at, created_at")
      .in("status", ["betting", "spinning"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      expected,
      totals: {
        all: {
          ...all,
          total: totalAll,
          pct: {
            red: pct(all.red, totalAll),
            black: pct(all.black, totalAll),
            green: pct(all.green, totalAll),
          },
        },
        d24: {
          ...d24,
          total: total24,
          pct: {
            red: pct(d24.red, total24),
            black: pct(d24.black, total24),
            green: pct(d24.green, total24),
          },
        },
        d7: {
          ...d7,
          total: total7,
          pct: {
            red: pct(d7.red, total7),
            black: pct(d7.black, total7),
            green: pct(d7.green, total7),
          },
        },
      },
      recent,
      byHour,
      byHourColor,
      economy24h: {
        stake: +stake24.toFixed(4),
        payout: +payout24.toFixed(4),
        house: house24,
        bets: betsCount24,
        players: players.size,
      },
      maxStreak,
      active: active || null,
      sampledRounds: totalAll,
      hourlySampled: fetched24,
    });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/roulette]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

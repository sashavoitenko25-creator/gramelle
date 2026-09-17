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

    // Settled rounds with results
    const { data: rounds } = await db
      .from("roulette_rounds")
      .select(
        "id, result_color, result_slot, created_at, bet_ends_at, spin_ends_at, result_ends_at, status"
      )
      .eq("status", "settled")
      .not("result_color", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000);

    const list = rounds || [];
    const all = emptyCounts();
    const d24 = emptyCounts();
    const d7 = emptyCounts();
    const byHour: number[] = Array.from({ length: 24 }, () => 0);
    const byHourColor: Record<Color, number[]> = {
      red: Array.from({ length: 24 }, () => 0),
      black: Array.from({ length: 24 }, () => 0),
      green: Array.from({ length: 24 }, () => 0),
    };

    for (const r of list) {
      const c = r.result_color as Color;
      if (c !== "red" && c !== "black" && c !== "green") continue;
      all[c] += 1;
      const t = new Date(r.created_at as string).getTime();
      if (t >= now - 7 * 24 * 60 * 60 * 1000) d7[c] += 1;
      if (t >= now - 24 * 60 * 60 * 1000) {
        d24[c] += 1;
        const hour = new Date(r.created_at as string).getHours();
        byHour[hour] += 1;
        byHourColor[c][hour] += 1;
      }
    }

    const totalAll = all.red + all.black + all.green;
    const total24 = d24.red + d24.black + d24.green;
    const total7 = d7.red + d7.black + d7.green;

    // Expected theoretical: 7 red, 7 black, 1 green out of 15
    const expected = {
      red: +((7 / ROULETTE_SLOT_COUNT) * 100).toFixed(2),
      black: +((7 / ROULETTE_SLOT_COUNT) * 100).toFixed(2),
      green: +((1 / ROULETTE_SLOT_COUNT) * 100).toFixed(2),
    };

    // Recent strip
    const recent = list.slice(0, 80).map((r) => ({
      id: r.id as string,
      color: r.result_color as Color,
      slot: r.result_slot as number | null,
      at: r.created_at as string,
    }));

    // Stakes / payouts from bets on settled rounds in 24h
    const settledIds24 = list
      .filter((r) => new Date(r.created_at as string).getTime() >= now - 24 * 60 * 60 * 1000)
      .map((r) => r.id as string);

    let stake24 = 0;
    let payout24 = 0;
    let betsCount24 = 0;
    let uniquePlayers24 = 0;

    if (settledIds24.length > 0) {
      // chunk in if needed
      const chunk = settledIds24.slice(0, 500);
      const { data: bets } = await db
        .from("roulette_bets")
        .select("telegram_id, amount, payout, color, round_id")
        .in("round_id", chunk);

      const players = new Set<number>();
      for (const b of bets || []) {
        const a = Number(b.amount) || 0;
        const p = b.payout != null ? Number(b.payout) : 0;
        stake24 += a;
        payout24 += p;
        betsCount24 += 1;
        players.add(Number(b.telegram_id));
      }
      uniquePlayers24 = players.size;
    }

    const house24 = +(stake24 - payout24).toFixed(4);

    // Streaks on recent
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

    // Active round
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
        all: { ...all, total: totalAll, pct: {
          red: pct(all.red, totalAll),
          black: pct(all.black, totalAll),
          green: pct(all.green, totalAll),
        }},
        d24: { ...d24, total: total24, pct: {
          red: pct(d24.red, total24),
          black: pct(d24.black, total24),
          green: pct(d24.green, total24),
        }},
        d7: { ...d7, total: total7, pct: {
          red: pct(d7.red, total7),
          black: pct(d7.black, total7),
          green: pct(d7.green, total7),
        }},
      },
      recent,
      byHour,
      byHourColor,
      economy24h: {
        stake: +stake24.toFixed(4),
        payout: +payout24.toFixed(4),
        house: house24,
        bets: betsCount24,
        players: uniquePlayers24,
      },
      maxStreak,
      active: active || null,
      sampledRounds: list.length,
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

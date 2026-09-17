import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { advanceRoulette, getRouletteState } from "@/lib/server/roulette";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export const revalidate = 0;

/**
 * External cron (cron-job.org) — Vercel Hobby does not run our crons.
 *
 * Setup on cron-job.org:
 *   URL:  https://YOUR-DOMAIN/api/roulette/process?secret=YOUR_CRON_SECRET
 *   Method: GET
 *   Interval: every 1 minute
 *
 * Optional header (instead of query):
 *   Authorization: Bearer YOUR_CRON_SECRET
 *   or  x-cron-secret: YOUR_CRON_SECRET
 *
 * Env: CRON_SECRET (same value as in the URL/header)
 */
function authorize(req: NextRequest): boolean {
  const expected = (process.env.CRON_SECRET || "").trim();
  // No secret configured → allow (local / first deploy)
  if (!expected) return true;

  const auth = (req.headers.get("authorization") || "").trim();
  if (auth === `Bearer ${expected}`) return true;

  const x = (req.headers.get("x-cron-secret") || "").trim();
  if (x === expected) return true;

  const q = (req.nextUrl.searchParams.get("secret") || "").trim();
  if (q === expected) return true;

  return false;
}

async function run(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
  }

  const round = await advanceRoulette();
  // Lightweight response for cron — full state not required
  return NextResponse.json({
    ok: true,
    advanced: true,
    round: {
      id: round.id,
      status: round.status,
      betEndsAt: round.bet_ends_at,
      spinEndsAt: round.spin_ends_at,
      resultEndsAt: round.result_ends_at,
      resultColor: round.result_color,
      resultSlot: round.result_slot,
    },
    serverMs: Date.now(),
  });
}

export async function GET(req: NextRequest) {
  try {
    return await run(req);
  } catch (e) {
    console.error("[roulette/process GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    return await run(req);
  } catch (e) {
    console.error("[roulette/process POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

// Some probes use HEAD
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

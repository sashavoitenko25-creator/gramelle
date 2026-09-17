import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { advanceRoulette, getRouletteState } from "@/lib/server/roulette";

export const dynamic = "force-dynamic";

/**
 * Advance LIVE roulette clock without players.
 * Call via:
 *   - Vercel Cron → GET/POST /api/roulette/process
 *   - cron-job.org with header Authorization: Bearer $CRON_SECRET
 * Clients also advance via GET /api/roulette/state (catch-up on open).
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    const headerCron = req.headers.get("x-cron-secret") || "";
    const q = req.nextUrl.searchParams.get("secret") || "";
    const ok =
      auth === `Bearer ${secret}` ||
      headerCron === secret ||
      q === secret;
    // Allow unauthenticated only when CRON_SECRET is not set (dev)
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
  }

  await advanceRoulette();
  const data = await getRouletteState(null);
  return NextResponse.json({ ok: true, ...data });
}

export async function GET(req: NextRequest) {
  try {
    return await run(req);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    return await run(req);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

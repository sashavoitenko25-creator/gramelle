import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { processPendingTonDeposits } from "@/lib/server/tonDeposits";

/**
 * Same model as /api/round/tick:
 * - cron-job.org can call freely (or with Bearer CRON_SECRET)
 * - CRON_STRICT=1 → only Bearer / Vercel cron
 */
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");
    const isCron =
      !!cronSecret &&
      (auth === `Bearer ${cronSecret}` ||
        req.headers.get("x-vercel-cron") === "1");

    if (
      process.env.CRON_STRICT === "1" &&
      cronSecret &&
      !isCron &&
      auth !== `Bearer ${cronSecret}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, demo: true, credited: 0 });
    }

    const { credited } = await processPendingTonDeposits();
    return NextResponse.json({
      ok: true,
      credited: credited.length,
      items: credited,
      isCron,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Process failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { processStuckRpsRooms } from "@/lib/server/rps";

/**
 * RPS stuck-room settler — call from cron-job.org or Vercel Cron every 1 min.
 * Finalizes playing rooms after reveal_at so payouts happen even if both clients left.
 *
 * Auth (same as /api/ton/process):
 * - If CRON_SECRET is set → Authorization: Bearer <secret> required
 * - Vercel Cron header x-vercel-cron: 1 also accepted
 */
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const auth = req.headers.get("authorization") || "";
    const vercelCron = req.headers.get("x-vercel-cron") === "1";
    const bearerOk = !!cronSecret && auth === `Bearer ${cronSecret}`;

    if (cronSecret && !bearerOk && !vercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, demo: true, finished: 0 });
    }

    const { finished, checked } = await processStuckRpsRooms(40);
    return NextResponse.json({
      ok: true,
      checked,
      finished: finished.length,
      ids: finished,
      isCron: bearerOk || vercelCron,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Process failed" },
      { status: 500 }
    );
  }
}

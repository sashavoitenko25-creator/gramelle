import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { processPendingTonDeposits } from "@/lib/server/tonDeposits";

/**
 * Background processor for ALL pending TON deposits.
 * - Vercel Cron: GET /api/ton/process (x-vercel-cron header)
 * - External cron (cron-job.org): GET with Authorization: Bearer $CRON_SECRET
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
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    const isBearer =
      !!cronSecret && auth === `Bearer ${cronSecret}`;

    if (cronSecret && !isVercelCron && !isBearer) {
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
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Process failed" },
      { status: 500 }
    );
  }
}

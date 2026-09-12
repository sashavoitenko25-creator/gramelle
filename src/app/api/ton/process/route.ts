import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { processPendingTonDeposits } from "@/lib/server/tonDeposits";

/**
 * TON deposit settler — call from Vercel Cron or cron-job.org
 * - If CRON_SECRET is set → Authorization: Bearer <secret> required
 * - Vercel Cron sends x-vercel-cron: 1 (accepted when secret matches OR vercel header)
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
      return NextResponse.json({ ok: true, demo: true, credited: 0 });
    }

    const { credited } = await processPendingTonDeposits();
    return NextResponse.json({
      ok: true,
      credited: credited.length,
      items: credited,
      isCron: bearerOk || vercelCron,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Process failed" },
      { status: 500 }
    );
  }
}

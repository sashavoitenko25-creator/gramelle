import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { processStuckDiceRooms } from "@/lib/server/dice";

/**
 * Dice stuck-room settler — cron every 1 min.
 * - Auto-rolls AFK players after turn_deadline
 * - Cancels stale open tables and refunds
 *
 * Auth (same as /api/rps/process):
 * - CRON_SECRET → Authorization: Bearer <secret>
 * - Vercel Cron header x-vercel-cron: 1
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
      return NextResponse.json({
        ok: true,
        demo: true,
        autoRolled: 0,
        cancelled: 0,
      });
    }

    const result = await processStuckDiceRooms(40);
    return NextResponse.json({
      ok: true,
      ...result,
      isCron: bearerOk || vercelCron,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Process failed" },
      { status: 500 }
    );
  }
}

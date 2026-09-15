import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { processXoTimeouts } from "@/lib/server/xo";

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
      return NextResponse.json({ ok: true, finished: [], checked: 0, demo: true });
    }
    const result = await processXoTimeouts(30);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

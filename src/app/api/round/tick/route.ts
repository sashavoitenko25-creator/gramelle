import { NextRequest, NextResponse } from "next/server";
import { tickRoom } from "@/lib/server/round";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { DEFAULT_ROOM, ROOMS, type RoomMode } from "@/lib/constants";

/**
 * Authority tick — Vercel Cron every minute + client fallback.
 * When CRON_SECRET is set, cron must send Authorization: Bearer <secret>.
 * Clients may still call without secret (early phase / backup).
 */
export async function GET(req: NextRequest) {
  return handleTick(req);
}

export async function POST(req: NextRequest) {
  return handleTick(req);
}

async function handleTick(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");
    const isCron =
      !!cronSecret &&
      (auth === `Bearer ${cronSecret}` ||
        req.headers.get("x-vercel-cron") === "1");

    // Optional: reject non-cron in strict mode
    if (
      process.env.CRON_STRICT === "1" &&
      cronSecret &&
      !isCron &&
      auth !== `Bearer ${cronSecret}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, demo: true, results: [] });
    }

    const modeParam = req.nextUrl.searchParams.get("mode") as RoomMode | null;
    const modes: RoomMode[] = modeParam
      ? [modeParam]
      : (Object.keys(ROOMS) as RoomMode[]);

    const results = [];
    for (const mode of modes) {
      const r = await tickRoom(mode || DEFAULT_ROOM);
      results.push({
        mode,
        action: r.action,
        rollId: r.round?.roll_id,
        status: r.round?.status,
        spun: r.action === "spun",
      });
    }

    return NextResponse.json({ ok: true, results, isCron });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Tick failed" },
      { status: 500 }
    );
  }
}

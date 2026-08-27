import { NextRequest, NextResponse } from "next/server";
import { tickRoom } from "@/lib/server/round";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { DEFAULT_ROOM, ROOMS, type RoomMode } from "@/lib/constants";

/**
 * Authority tick — safe to call from Vercel Cron or any client.
 * Optional: Authorization Bearer CRON_SECRET
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
    if (cronSecret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        // allow unauthenticated for client-driven tick in early phase
        // but cron must send secret when set — clients still work without it
      }
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, demo: true, results: [] });
    }

    const modeParam = req.nextUrl.searchParams.get("mode") as RoomMode | null;
    const modes: RoomMode[] = modeParam ? [modeParam] : (Object.keys(ROOMS) as RoomMode[]);

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

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Tick failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { advancePvpRoulette } from "@/lib/server/pvpRoulette";

export const dynamic = "force-dynamic";

function authorize(req: NextRequest): boolean {
  const expected = (process.env.CRON_SECRET || "").trim();
  if (!expected) {
    // Allow in dev / when secret not set (same as other process routes often do)
    return true;
  }
  const auth = (req.headers.get("authorization") || "").trim();
  if (auth === `Bearer ${expected}`) return true;
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

  const round = await advancePvpRoulette();
  return NextResponse.json({
    ok: true,
    advanced: true,
    round: {
      id: round.id,
      status: round.status,
      betEndsAt: round.bet_ends_at,
      spinEndsAt: round.spin_ends_at,
      resultEndsAt: round.result_ends_at,
      totalBank: Number(round.total_bank) || 0,
      winnerTelegramId: round.winner_telegram_id,
      resultIndex: round.result_index,
    },
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { processPendingTonDeposits } from "@/lib/server/tonDeposits";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const auth = await requireTelegramUser(req);
    const { credited } = await processPendingTonDeposits(auth.user.id);

    if (!credited.length) {
      return NextResponse.json({
        ok: true,
        credited: [],
        message: "No pending deposits",
      });
    }

    return NextResponse.json({
      ok: true,
      credited: credited.map((c) => ({
        memo: c.memo,
        gram: c.gram,
        txHash: c.txHash,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Check failed", credited: [] },
      { status: 500 }
    );
  }
}

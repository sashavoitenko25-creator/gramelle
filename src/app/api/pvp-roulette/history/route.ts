import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, getAdminClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 503 });
    }
    const limit = Math.min(
      50,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 20))
    );
    const db = getAdminClient();
    const { data: rounds } = await db
      .from("pvp_roulette_rounds")
      .select(
        "id, winner_telegram_id, total_bank, winner_amount, created_at, status"
      )
      .eq("status", "finished")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!rounds?.length) {
      return NextResponse.json({ ok: true, history: [] });
    }

    const winnerIds = [
      ...new Set(
        rounds
          .map((r) => r.winner_telegram_id)
          .filter((id): id is number => id != null)
      ),
    ];
    const nameMap = new Map<number, string>();
    const photoMap = new Map<number, string | null>();
    if (winnerIds.length) {
      const { data: profiles } = await db
        .from("profiles")
        .select("telegram_id, username, photo_url")
        .in("telegram_id", winnerIds);
      for (const p of profiles || []) {
        const tid = Number(p.telegram_id);
        nameMap.set(tid, p.username || "Player");
        photoMap.set(tid, (p as { photo_url?: string | null }).photo_url || null);
      }
    }

    const history = rounds.map((r) => {
      const tid =
        r.winner_telegram_id != null ? Number(r.winner_telegram_id) : null;
      return {
        id: r.id,
        winnerTelegramId: tid,
        winnerUsername: tid != null ? nameMap.get(tid) || "Player" : undefined,
        winnerAvatarUrl: tid != null ? photoMap.get(tid) ?? null : null,
        totalBank: Number(r.total_bank) || 0,
        winnerAmount: r.winner_amount != null ? Number(r.winner_amount) : null,
        createdAt: r.created_at,
      };
    });

    return NextResponse.json({ ok: true, history });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

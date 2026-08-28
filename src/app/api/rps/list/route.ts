import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { listOpenRooms, listRecentFinished, getMyActiveRoom } from "@/lib/server/rps";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ demo: true, rooms: [], recent: [], mine: null });
    }

    let telegramId: number | null = null;
    try {
      const auth = await requireTelegramUser(req);
      telegramId = auth.user.id;
    } catch {
      // public list allowed without auth
    }

    const [rooms, recent, mine] = await Promise.all([
      listOpenRooms(telegramId),
      listRecentFinished(12),
      telegramId ? getMyActiveRoom(telegramId) : Promise.resolve(null),
    ]);

    return NextResponse.json({ ok: true, rooms, recent, mine });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

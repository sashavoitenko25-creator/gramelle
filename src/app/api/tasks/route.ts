import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { TASKS, taskChannelLink } from "@/lib/constants";

/** List tasks + completion status for current user */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTelegramUser(req);
    const tg = auth.user.id;

    const completed = new Set<string>();
    if (isSupabaseConfigured()) {
      const db = getAdminClient();
      const { data } = await db
        .from("task_completions")
        .select("task_id")
        .eq("telegram_id", tg);
      for (const row of data || []) completed.add(String(row.task_id));
    }

    const tasks = TASKS.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      channel: t.channel.replace(/^@/, ""),
      channelLink: taskChannelLink(t),
      rewardGram: t.rewardGram,
      completed: completed.has(t.id),
    }));

    return NextResponse.json({ ok: true, tasks });
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

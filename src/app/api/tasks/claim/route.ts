import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser, getBotToken } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { creditBalance } from "@/lib/server/ledger";
import { TASKS, type TaskId } from "@/lib/constants";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertNotBanned } from "@/lib/server/ban";
import { notifyUser, fmtAmount } from "@/lib/server/notify";

function channelIdCandidates(channel: string): string[] {
  const raw = channel.trim();
  if (!raw) return [];
  // numeric private / public id
  if (/^-?\d+$/.test(raw)) {
    const n = raw.startsWith("-") ? raw : `-${raw}`;
    const digits = n.replace(/^-/, "");
    const with100 = digits.startsWith("100") ? n : `-100${digits}`;
    // unique preserve order
    return [...new Set([n, with100, raw])];
  }
  const u = raw.replace(/^@/, "");
  return [`@${u}`, u];
}

async function isChannelMember(
  channel: string,
  userId: number
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const token = getBotToken();
  const candidates = channelIdCandidates(channel);
  let lastError = "Cannot verify subscription. Make sure the bot is admin of the channel.";

  for (const chatId of candidates) {
    const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${userId}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      lastError = data.description || lastError;
      continue;
    }
    const status = String(data.result?.status || "");
    const member =
      status === "member" ||
      status === "administrator" ||
      status === "creator" ||
      status === "restricted";
    return { ok: member, status };
  }
  return { ok: false, error: lastError };
}

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const auth = await requireTelegramUser(req);
    const rl = rateLimit(`task:${auth.user.id}`, 20, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    await assertNotBanned(auth.user.id);

    const body = await req.json().catch(() => ({}));
    const taskId = String(body.taskId || "") as TaskId;
    const task = TASKS.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Unknown task" }, { status: 400 });
    }

    const db = getAdminClient();

    const { data: existing } = await db
      .from("task_completions")
      .select("id")
      .eq("telegram_id", auth.user.id)
      .eq("task_id", taskId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "Task already completed", completed: true },
        { status: 400 }
      );
    }

    const check = await isChannelMember(task.channel, auth.user.id);
    if (!check.ok) {
      return NextResponse.json(
        {
          error:
            check.error ||
            "Not subscribed yet. Open the channel, join, then press Check again.",
          status: check.status || null,
        },
        { status: 400 }
      );
    }

    const { error: insErr } = await db.from("task_completions").insert({
      telegram_id: auth.user.id,
      task_id: taskId,
      reward_gram: task.rewardGram,
    });
    if (insErr) {
      if (/duplicate|unique/i.test(insErr.message || "")) {
        return NextResponse.json(
          { error: "Task already completed", completed: true },
          { status: 400 }
        );
      }
      throw insErr;
    }

    const { balance } = await creditBalance(
      auth.user.id,
      task.rewardGram,
      "task_reward",
      { task_id: taskId, channel: task.channel }
    );

    try {
      await notifyUser(
        auth.user.id,
        `✅ <b>Task completed</b>
+${fmtAmount(task.rewardGram, "GRAM")}
${task.title}`
      );
    } catch {}

    return NextResponse.json({
      ok: true,
      completed: true,
      rewardGram: task.rewardGram,
      balance,
      taskId,
    });
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

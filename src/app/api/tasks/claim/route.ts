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
  if (/^-?\d+$/.test(raw)) {
    const neg = raw.startsWith("-") ? raw : `-${raw}`;
    const abs = neg.replace(/^-/, "");
    // Channels/supergroups in Bot API are almost always -100XXXXXXXXXX
    const forms: string[] = [];
    if (abs.startsWith("100")) {
      forms.push(`-${abs}`, abs, neg);
    } else {
      forms.push(`-100${abs}`, neg, `-${abs}`, abs);
    }
    // also strip -100 if someone stored full form and we need short
    if (abs.startsWith("100") && abs.length > 3) {
      forms.push(`-${abs.slice(3)}`);
    }
    return [...new Set(forms)];
  }
  const u = raw.replace(/^@/, "");
  return [`@${u}`, u];
}

function friendlyChatError(desc: string): string {
  const d = (desc || "").toLowerCase();
  if (d.includes("chat not found") || d.includes("chat_id is empty")) {
    return "Канал не найден. Бот должен быть админом канала.";
  }
  if (d.includes("bot is not a member") || d.includes("not enough rights")) {
    return "Бот не админ канала. Добавьте бота администратором.";
  }
  if (d.includes("user not found")) {
    return "Open the app from Telegram and try again.";
  }
  return desc || "Не удалось проверить подписку.";
}

async function isChannelMember(
  channel: string,
  userId: number
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const token = getBotToken();
  const candidates = channelIdCandidates(channel);
  let lastError = "Не удалось проверить подписку. Make sure the bot is admin of the channel.";

  for (const chatId of candidates) {
    const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${userId}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        lastError = friendlyChatError(String(data.description || lastError));
        continue;
      }
      const status = String(data.result?.status || "");
      // left / kicked = not subscribed
      if (status === "left" || status === "kicked") {
        return {
          ok: false,
          status,
          error: "Вы ещё не подписаны. Откройте канал, подпишитесь и нажмите «Проверить».",
        };
      }
      const member =
        status === "member" ||
        status === "administrator" ||
        status === "creator" ||
        status === "restricted";
      if (member) return { ok: true, status };
      return {
        ok: false,
        status,
        error: "Вы ещё не подписаны. Откройте канал, подпишитесь и нажмите «Проверить».",
      };
    } catch {
      continue;
    }
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
        { error: "Задание уже выполнено", completed: true },
        { status: 400 }
      );
    }

    const check = await isChannelMember(task.channel, auth.user.id);
    if (!check.ok) {
      return NextResponse.json(
        {
          error:
            check.error ||
            "Вы ещё не подписаны. Откройте канал, подпишитесь и нажмите «Проверить».",
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
          { error: "Задание уже выполнено", completed: true },
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
        `✅ <b>Задание выполнено</b>
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

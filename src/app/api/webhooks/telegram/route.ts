import { NextRequest, NextResponse } from "next/server";
import { getBotToken } from "@/lib/server/telegram";
import { creditBalance } from "@/lib/server/ledger";
import { notifyUser, fmtAmount } from "@/lib/server/notify";
import { BOT_USERNAME, GRAM_PER_STAR, SUPPORT_URL } from "@/lib/constants";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

const START_TEXT = `✨ <b>Gramelle</b>
PvP-игры и рулетка на <b>GRAM</b>

━━━━━━━━━━━━━━━━
🎯 <b>Игры</b>
• ✊ Камень · Ножницы · Бумага
• 🎲 Dice
• ⭕ Крестики-нолики
• 🎰 PvP Roulette — общий банк, один победитель
• 🎡 LIVE Roulette — красное / чёрное / зелёное

━━━━━━━━━━━━━━━━
⚡ <b>Как начать</b>
1️⃣ Пополни баланс через <b>TON</b>
2️⃣ Выбери режим и сделай ставку
3️⃣ Победи — забери выигрыш

🔐 Честный рандом: у каждой партии есть <b>Hash</b> и <b>Seed</b>

━━━━━━━━━━━━━━━━
💎 <b>Рефералка</b>
Приглашай друзей — <b>10%</b> от комиссии (RPS · Dice · XO · PvP Roulette)
LIVE и SOLO не участвуют

📌 Мин. ставка <b>0.25 GRAM</b>
⏱ Вывод обычно до часа
🔞 Только 18+ · Играй ответственно

Нажми <b>Играть</b> ↓`;

async function tgApi(method: string, body: Record<string, unknown>) {
  const token = getBotToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

/**
 * Telegram Bot webhook.
 * - /start welcome + Mini App button
 * - successful_payment for Stars (XTR)
 * - pre_checkout_query
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const header = req.headers.get("x-telegram-bot-api-secret-token");
      if (header !== secret) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const update = await req.json();

    // /start
    const msg = update?.message;
    if (msg?.text && typeof msg.text === "string" && msg.chat?.id) {
      const text = msg.text.trim();
      if (text === "/start" || text.startsWith("/start ")) {
        const payload = text.startsWith("/start ")
          ? text.slice(7).trim()
          : "";
        // Bind referral from deep link t.me/bot?start=ref_xxx
        if (payload && payload.includes("ref") && isSupabaseConfigured()) {
          try {
            const fromId = msg.from?.id;
            if (fromId) {
              const { bindReferral } = await import("@/lib/server/referral");
              const uname =
                msg.from?.username ||
                msg.from?.first_name ||
                "Player" + String(fromId).slice(-4);
              await bindReferral(Number(fromId), payload, uname);
            }
          } catch {
            /* non-fatal */
          }
        }

        // Always production Mini App URL (not VERCEL_URL / preview — those hit Deployment Protection)
        const webAppUrl = (
          process.env.NEXT_PUBLIC_APP_URL ||
          "https://gramelle-gamma.vercel.app"
        ).replace(/\/$/, "");

        await tgApi("sendMessage", {
          chat_id: msg.chat.id,
          text: START_TEXT,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎮  Играть",
                  web_app: { url: webAppUrl },
                },
              ],
              [
                {
                  text: "📢 Канал",
                  url: "https://t.me/GramellePlay",
                },
                {
                  text: "💬 Поддержка",
                  url: SUPPORT_URL,
                },
              ],
            ],
          },
        });
        return NextResponse.json({ ok: true });
      }
    }

    const payment = update?.message?.successful_payment;
    if (payment && isSupabaseConfigured()) {
      const currency = payment.currency as string;
      const totalAmount = Number(payment.total_amount);
      const payload = String(payment.invoice_payload || "");
      const fromId = update.message.from?.id as number | undefined;

      if (currency === "XTR" && fromId && totalAmount > 0) {
        const db = getAdminClient();

        const { data: existing } = await db
          .from("ledger")
          .select("id")
          .eq("reason", "deposit_stars")
          .contains("meta", { payload })
          .maybeSingle();

        if (!existing) {
          const gram = totalAmount * GRAM_PER_STAR;
          await creditBalance(fromId, gram, "deposit_stars", {
            payload,
            stars: totalAmount,
            telegram_payment_charge_id: payment.telegram_payment_charge_id,
            provider_payment_charge_id: payment.provider_payment_charge_id,
          });
          await notifyUser(
            fromId,
            `✅ <b>Депозит зачислен</b>\n` +
              `+${fmtAmount(gram, "GRAM")} (Stars)\n` +
              `Статус: <b>Успешно</b>`
          );
        }
      }
    }

    if (update?.pre_checkout_query) {
      const id = update.pre_checkout_query.id;
      await tgApi("answerPreCheckoutQuery", {
        pre_checkout_query_id: id,
        ok: true,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("webhook error", e);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "gramelle-telegram-webhook" });
}

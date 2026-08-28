import { NextRequest, NextResponse } from "next/server";
import { getBotToken } from "@/lib/server/telegram";
import { creditBalance, creditReferralOnDeposit } from "@/lib/server/ledger";
import { BOT_USERNAME, GRAM_PER_STAR } from "@/lib/constants";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

const START_TEXT = `Welcome to Gramelle — PvP roulette on TON.

How it works:
1. Deposit Stars or TON → get GRAM
2. Place a bet into the round bank
3. Your share of the bank = your win chance
4. Winner takes 95% of the pot (5% house)

Provably fair: each round commits a seed hash before the spin. Verify any finished roll in the app.

Rules:
• Classic from 0.25 GRAM · High from 10 GRAM
• Entertainment only. Play responsibly.
• 18+

Open the Mini App to play.`;

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
        const webAppUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "https://gramelle-gamma.vercel.app");

        await tgApi("sendMessage", {
          chat_id: msg.chat.id,
          text: START_TEXT,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Play Gramelle",
                  web_app: { url: webAppUrl },
                },
              ],
              [
                {
                  text: "Channel / support",
                  url: process.env.NEXT_PUBLIC_SUPPORT_URL || "https://t.me/" + BOT_USERNAME,
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
          try {
            await creditReferralOnDeposit(fromId, gram, {
              payload,
              stars: totalAmount,
            });
          } catch (e) {
            console.warn("referral credit failed", e);
          }
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

import { NextRequest, NextResponse } from "next/server";
import { getBotToken } from "@/lib/server/telegram";
import { creditBalance, creditReferralOnDeposit } from "@/lib/server/ledger";
import { GRAM_PER_STAR } from "@/lib/constants";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";

/**
 * Telegram Bot webhook.
 * Handles successful_payment for Stars (XTR).
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
            await creditReferralOnDeposit(fromId, gram, { payload, stars: totalAmount });
          } catch (e) {
            console.warn("referral credit failed", e);
          }
        }
      }
    }

    if (update?.pre_checkout_query) {
      const token = getBotToken();
      const id = update.pre_checkout_query.id;
      await fetch(`https://api.telegram.org/bot${token}/answerPreCheckoutQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_checkout_query_id: id, ok: true }),
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

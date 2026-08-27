import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser, getBotToken } from "@/lib/server/telegram";
import { GRAM_PER_STAR } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    let telegramId: number;
    let username: string;

    try {
      const auth = await requireTelegramUser(req);
      telegramId = auth.user.id;
      username =
        auth.user.username ||
        auth.user.first_name ||
        String(auth.user.id);
    } catch {
      // allow body fallback only in development without initData
      if (process.env.NODE_ENV === "production") {
        throw new AuthError("Missing Telegram auth");
      }
      const body = await req.clone().json();
      telegramId = Number(body.telegramId) || 0;
      username = body.username || "dev";
      if (!telegramId) throw new AuthError("Missing Telegram auth");
    }

    const body = await req.json();
    const stars = Math.floor(Number(body.stars) || 0);
    if (stars < 1 || stars > 100_000) {
      return NextResponse.json({ error: "Invalid stars amount" }, { status: 400 });
    }

    let token: string;
    try {
      token = getBotToken();
    } catch {
      return NextResponse.json(
        {
          error:
            "TELEGRAM_BOT_TOKEN is not configured. Add it to enable Stars payments.",
        },
        { status: 503 }
      );
    }

    const gram = stars * GRAM_PER_STAR;
    const payload = `stars_${stars}_${telegramId}_${Date.now()}`;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/createInvoiceLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Gramelle Deposit",
          description: `Top up ${gram} GRAM`,
          payload,
          currency: "XTR",
          prices: [{ label: `${gram} GRAM`, amount: stars }],
        }),
      }
    );

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      return NextResponse.json(
        { error: tgData.description || "Telegram API error" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      invoiceLink: tgData.result as string,
      payload,
      stars,
      gram,
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

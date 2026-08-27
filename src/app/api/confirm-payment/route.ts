import { NextResponse } from "next/server";

/**
 * Deprecated: balance is credited only via Telegram webhook
 * (successful_payment) or /api/ton/check after on-chain confirm.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Client-side payment confirm is disabled. Stars are credited via bot webhook; TON via /api/ton/check.",
    },
    { status: 410 }
  );
}

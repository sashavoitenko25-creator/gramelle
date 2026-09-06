import { NextRequest, NextResponse } from "next/server";

/**
 * TonConnect manifest — always branded as Gramelle.
 * Uses current host / NEXT_PUBLIC_APP_URL (no hardcoded third-party domains).
 */
export async function GET(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const origin = envUrl || req.nextUrl.origin;

  const body = {
    url: origin,
    name: "Gramelle",
    iconUrl: `${origin}/gram-badge.png`,
    termsOfUseUrl: `${origin}/`,
    privacyPolicyUrl: `${origin}/`,
  };

  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}

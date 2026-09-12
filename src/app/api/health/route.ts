import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/server/supabase";

/** Public liveness for uptime monitors */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "gramelle",
    ts: new Date().toISOString(),
    db: isSupabaseConfigured(),
    game: "rps",
  });
}

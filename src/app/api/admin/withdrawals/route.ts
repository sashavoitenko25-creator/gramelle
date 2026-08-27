import { NextRequest, NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/lib/server/admin";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { creditBalance } from "@/lib/server/ledger";
import { trackEvent } from "@/lib/server/sentry";

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "No DB" }, { status: 503 });
    }
    const status = req.nextUrl.searchParams.get("status") || "pending";
    const db = getAdminClient();
    const q = db
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status !== "all") q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/** Complete or reject a withdrawal */
export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "No DB" }, { status: 503 });
    }
    const body = await req.json();
    const id = String(body.id || "");
    const action = String(body.action || ""); // complete | reject
    const txHash = body.tx_hash ? String(body.tx_hash) : null;
    const note = body.note ? String(body.note) : null;

    if (!id || !["complete", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: row, error } = await db
      .from("withdrawals")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!["pending", "processing"].includes(row.status)) {
      return NextResponse.json({ error: "Already processed" }, { status: 400 });
    }

    if (action === "complete") {
      const { error: upErr } = await db
        .from("withdrawals")
        .update({
          status: "completed",
          tx_hash: txHash,
          admin_note: note,
          processed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .in("status", ["pending", "processing"]);
      if (upErr) throw upErr;
      await trackEvent("withdraw_completed", { id, amount: row.amount_ton });
      return NextResponse.json({ ok: true, status: "completed" });
    }

    // reject + refund
    const { data: updated } = await db
      .from("withdrawals")
      .update({
        status: "rejected",
        admin_note: note || "rejected",
        processed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .in("status", ["pending", "processing"])
      .select("id")
      .maybeSingle();

    if (!updated) {
      return NextResponse.json({ error: "Already processed" }, { status: 400 });
    }

    await creditBalance(row.telegram_id, Number(row.amount_gram), "refund", {
      withdrawal_id: id,
      reason: "withdraw_rejected",
    });
    await trackEvent("withdraw_rejected", { id, amount: row.amount_ton });

    return NextResponse.json({ ok: true, status: "rejected", refunded: true });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTelegramUser } from "@/lib/server/telegram";
import { getAdminClient, isSupabaseConfigured } from "@/lib/server/supabase";
import { creditBalance, getOrCreateProfile } from "@/lib/server/ledger";
import {
  MIN_WITHDRAW_TON,
  MAX_WITHDRAW_TON,
  GRAM_PER_TON,
  WITHDRAW_FEE_GRAM,
  DAILY_WITHDRAW_LIMIT_TON,
  MAX_PENDING_WITHDRAWALS,
} from "@/lib/constants";
// antifraud imported below if needed
import { creditHouse } from "@/lib/server/house";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertNotBanned } from "@/lib/server/ban";

/**
 * Request TON withdrawal.
 * Debits (amount + 0.2 fee) immediately; admin sends amount on-chain.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const auth = await requireTelegramUser(req);

    const rl = rateLimit(`wd:${auth.user.id}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many withdraw requests" }, { status: 429 });
    }
    
    await assertNotBanned(auth.user.id);

    // Anti-abuse: pending count + daily volume
    {
      const dbCheck = getAdminClient();
      const { count } = await dbCheck
        .from("withdrawals")
        .select("id", { count: "exact", head: true })
        .eq("telegram_id", auth.user.id)
        .in("status", ["pending", "processing"]);
      if ((count || 0) >= MAX_PENDING_WITHDRAWALS) {
        return NextResponse.json(
          { error: `Max ${MAX_PENDING_WITHDRAWALS} pending withdrawals` },
          { status: 400 }
        );
      }
    }

        const body = await req.json();
    const amountTon = Number(body.amountTon ?? body.amount);
    const wallet = String(body.wallet || body.address || "").trim();

    if (!Number.isFinite(amountTon) || amountTon < MIN_WITHDRAW_TON) {
      return NextResponse.json(
        { error: `Minimum withdraw is ${MIN_WITHDRAW_TON} TON` },
        { status: 400 }
      );
    }
    if (amountTon > MAX_WITHDRAW_TON) {
      return NextResponse.json(
        { error: `Maximum withdraw is ${MAX_WITHDRAW_TON} TON` },
        { status: 400 }
      );
    }
    if (!wallet || wallet.length < 20) {
      return NextResponse.json({ error: "Invalid TON wallet address" }, { status: 400 });
    }

    // Daily volume limit (UTC day)
    {
      const dbDay = getAdminClient();
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { data: todayRows } = await dbDay
        .from("withdrawals")
        .select("amount_ton")
        .eq("telegram_id", auth.user.id)
        .gte("created_at", dayStart.toISOString())
        .in("status", ["pending", "processing", "completed"]);
      const used = (todayRows || []).reduce(
        (s, r) => s + Number(r.amount_ton || 0),
        0
      );
      if (used + amountTon > DAILY_WITHDRAW_LIMIT_TON) {
        const left = Math.max(0, DAILY_WITHDRAW_LIMIT_TON - used);
        return NextResponse.json(
          {
            error: `Daily limit ${DAILY_WITHDRAW_LIMIT_TON} TON (left ${left.toFixed(2)})`,
          },
          { status: 400 }
        );
      }
    }

    const amountGram = +(amountTon * GRAM_PER_TON).toFixed(4);
    const fee = WITHDRAW_FEE_GRAM;
    const totalDebit = +(amountGram + fee).toFixed(4);

    const profile = await getOrCreateProfile(auth.user.id);
    if (Number(profile.balance) < totalDebit) {
      return NextResponse.json(
        {
          error: `Need ${totalDebit} GRAM (incl. ${fee} fee)`,
        },
        { status: 400 }
      );
    }

    const db = getAdminClient();

    const { count } = await db
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("telegram_id", auth.user.id)
      .in("status", ["pending", "processing"]);

    if ((count || 0) >= 3) {
      return NextResponse.json(
        { error: "Too many pending withdrawals" },
        { status: 429 }
      );
    }

    const { balance } = await creditBalance(auth.user.id, -totalDebit, "withdraw", {
      amount_ton: amountTon,
      amount_gram: amountGram,
      fee,
      wallet,
    });

    try {
      await creditHouse(fee, "profit", "withdraw_fee", {
        telegram_id: auth.user.id,
        amount_ton: amountTon,
      });
    } catch {}

    const { data: row, error } = await db
      .from("withdrawals")
      .insert({
        telegram_id: auth.user.id,
        profile_id: profile.id,
        amount_gram: amountGram,
        amount_ton: amountTon,
        wallet_address: wallet,
        status: "pending",
        fee_gram: fee,
      })
      .select("id, amount_ton, amount_gram, status, created_at")
      .single();

    if (error) {
      await creditBalance(auth.user.id, totalDebit, "refund", {
        reason: "withdraw_failed",
      });
      throw error;
    }

    try {
      const adminTg = process.env.ADMIN_TELEGRAM_ID;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (adminTg && token) {
        const text =
          'Withdraw request
' +
          'User: ' + auth.user.id + '
' +
          'Amount: ' + amountTon + ' TON
' +
          'Wallet: ' + wallet + '
' +
          'Open: ' + (process.env.NEXT_PUBLIC_APP_URL || '') + '/admin';
        await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: adminTg, text }),
        });
      }
    } catch {}

    return NextResponse.json({
      ok: true,
      withdrawal: row,
      balance,
      fee,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Withdraw failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ items: [], demo: true });
    }
    const auth = await requireTelegramUser(req);
    const db = getAdminClient();
    const { data } = await db
      .from("withdrawals")
      .select(
        "id, amount_ton, amount_gram, wallet_address, status, created_at, processed_at, tx_hash, fee_gram"
      )
      .eq("telegram_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    return NextResponse.json({ items: data || [] });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

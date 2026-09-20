/**
 * LIVE Roulette "Paravoz" — 10 correct color guesses in a row → 10 GRAM bonus.
 */
import { getAdminClient } from "./supabase";
import { creditBalance } from "./ledger";
import type { RouletteColor } from "@/lib/rouletteConstants";
import { isRouletteShowcaseBot } from "./rouletteBots";

export const PARAVOZ_TARGET = 10;
/** 10 TON ≡ 10 GRAM (1:1) */
export const PARAVOZ_BONUS_GRAM = 10;

export type ParavozState = {
  streak: number;
  target: number;
  colors: RouletteColor[];
  bonusGram: number;
};

export type ParavozWin = {
  id: string;
  telegramId: number;
  username: string;
  streak: number;
  bonusGram: number;
  colors: RouletteColor[];
  at: string;
};

type BetLite = {
  telegram_id: number;
  username?: string;
  color: RouletteColor;
  amount: number;
};

/**
 * After a round settles: update streaks for everyone who bet (real users only).
 * Win = had stake on the result color. Loss = only wrong colors. No bet = skip.
 * Bonus once when streak hits exactly TARGET.
 */
export async function applyParavozAfterRound(opts: {
  resultColor: RouletteColor;
  bets: BetLite[];
}): Promise<void> {
  const { resultColor, bets } = opts;
  const byUser = new Map<
    number,
    { username: string; onWin: number; onLose: number }
  >();

  for (const b of bets) {
    const tid = Number(b.telegram_id);
    if (!tid || isRouletteShowcaseBot(tid)) continue;
    const amt = Number(b.amount) || 0;
    if (amt <= 0) continue;
    const cur = byUser.get(tid) || {
      username: String(b.username || "Player").slice(0, 64),
      onWin: 0,
      onLose: 0,
    };
    if (b.username) cur.username = String(b.username).slice(0, 64);
    if (b.color === resultColor) cur.onWin += amt;
    else cur.onLose += amt;
    byUser.set(tid, cur);
  }

  if (byUser.size === 0) return;
  const db = getAdminClient();

  for (const [tid, u] of byUser) {
    const guessed = u.onWin > 0;
    try {
      const { data: row } = await db
        .from("roulette_paravoz")
        .select("streak, colors")
        .eq("telegram_id", tid)
        .maybeSingle();

      let streak = Number(row?.streak) || 0;
      let colors: RouletteColor[] = Array.isArray(row?.colors)
        ? (row!.colors as RouletteColor[])
        : [];

      if (guessed) {
        streak += 1;
        colors = [...colors, resultColor].slice(-50);
      } else {
        streak = 0;
        colors = [];
      }

      await db.from("roulette_paravoz").upsert(
        {
          telegram_id: tid,
          streak,
          colors,
          username: u.username,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" }
      );

      // Bonus exactly at 10 consecutive (once per streak run)
      if (guessed && streak === PARAVOZ_TARGET) {
        try {
          await creditBalance(tid, PARAVOZ_BONUS_GRAM, "win", {
            kind: "paravoz_bonus",
            streak,
            bonus: PARAVOZ_BONUS_GRAM,
          });
        } catch (e) {
          console.error("[paravoz] credit", tid, e);
        }
        try {
          await db.from("roulette_paravoz_wins").insert({
            telegram_id: tid,
            username: u.username,
            streak,
            bonus_gram: PARAVOZ_BONUS_GRAM,
            colors: colors.slice(-PARAVOZ_TARGET),
          });
        } catch (e) {
          console.error("[paravoz] win row", tid, e);
        }
      }
    } catch (e) {
      console.error("[paravoz] user", tid, e);
    }
  }
}

export async function getParavozForUser(
  telegramId: number | null | undefined
): Promise<ParavozState> {
  const empty: ParavozState = {
    streak: 0,
    target: PARAVOZ_TARGET,
    colors: [],
    bonusGram: PARAVOZ_BONUS_GRAM,
  };
  if (!telegramId || telegramId <= 0 || isRouletteShowcaseBot(telegramId)) {
    return empty;
  }
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("roulette_paravoz")
      .select("streak, colors")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    if (!data) return empty;
    return {
      streak: Number(data.streak) || 0,
      target: PARAVOZ_TARGET,
      colors: Array.isArray(data.colors) ? (data.colors as RouletteColor[]) : [],
      bonusGram: PARAVOZ_BONUS_GRAM,
    };
  } catch {
    return empty;
  }
}

export async function getParavozWinners(limit = 20): Promise<ParavozWin[]> {
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("roulette_paravoz_wins")
      .select("id, telegram_id, username, streak, bonus_gram, colors, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data || []).map((r) => ({
      id: r.id as string,
      telegramId: Number(r.telegram_id),
      username: String(r.username || "Player"),
      streak: Number(r.streak) || PARAVOZ_TARGET,
      bonusGram: Number(r.bonus_gram) || PARAVOZ_BONUS_GRAM,
      colors: Array.isArray(r.colors) ? (r.colors as RouletteColor[]) : [],
      at: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

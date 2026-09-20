/**
 * LIVE Roulette "Paravoz" — 10 correct guesses in a row → bonus.
 * Exactly +1 cell per settled round per player. Skip/miss → reset.
 * Showcase bots included in streak display (no real bonus credit).
 */
import { getAdminClient } from "./supabase";
import { creditBalance } from "./ledger";
import type { RouletteColor } from "@/lib/rouletteConstants";
import {
  isRouletteShowcaseBot,
  botPhotoUrl,
  ROULETTE_BOTS,
} from "./rouletteBots";

export const PARAVOZ_TARGET = 10;
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

export type ParavozParticipant = {
  telegramId: number;
  username: string;
  photoUrl: string | null;
  streak: number;
  colors: RouletteColor[];
};

type BetLite = {
  telegram_id: number;
  username?: string;
  color: RouletteColor;
  amount: number;
};

/** In-memory guard (multi-instance still protected by DB last_round_id) */
const appliedRounds = new Set<string>();

/**
 * Apply streak updates once per roundId.
 * Win → +1 only. Loss/skip → 0. Never +2 for one round.
 */
export async function applyParavozAfterRound(opts: {
  resultColor: RouletteColor;
  bets: BetLite[];
  roundId: string;
}): Promise<void> {
  const { resultColor, bets, roundId } = opts;
  if (!roundId) return;
  if (appliedRounds.has(roundId)) return;
  appliedRounds.add(roundId);
  if (appliedRounds.size > 200) {
    const first = appliedRounds.values().next().value;
    if (first) appliedRounds.delete(first);
  }

  const byUser = new Map<
    number,
    { username: string; onWin: number; onLose: number }
  >();

  for (const b of bets) {
    const tid = Number(b.telegram_id);
    if (!tid) continue;
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

  const db = getAdminClient();

  // Anyone with active streak (skip → reset) + everyone who bet this round
  const { data: activeRows } = await db
    .from("roulette_paravoz")
    .select("telegram_id, streak, colors, username, last_round_id")
    .gt("streak", 0);

  const toProcess = new Set<number>();
  for (const tid of byUser.keys()) toProcess.add(tid);
  for (const r of activeRows || []) {
    const tid = Number(r.telegram_id);
    if (tid) toProcess.add(tid);
  }
  if (toProcess.size === 0) return;

  for (const tid of toProcess) {
    const u = byUser.get(tid);
    const played = !!u;
    const guessed = !!(u && u.onWin > 0);
    const isBot = isRouletteShowcaseBot(tid);

    try {
      const { data: row } = await db
        .from("roulette_paravoz")
        .select("streak, colors, username, last_round_id")
        .eq("telegram_id", tid)
        .maybeSingle();

      // Already applied for this round → never double-count
      if (row?.last_round_id && String(row.last_round_id) === String(roundId)) {
        continue;
      }

      let streak = Number(row?.streak) || 0;
      let colors: RouletteColor[] = Array.isArray(row?.colors)
        ? (row!.colors as RouletteColor[])
        : [];
      const username = (
        u?.username ||
        row?.username ||
        (isBot
          ? ROULETTE_BOTS.find((b) => b.id === tid)?.username || "Player"
          : "Player")
      )
        .toString()
        .slice(0, 64);

      if (!played) {
        if (streak === 0 && colors.length === 0) continue;
        streak = 0;
        colors = [];
      } else if (guessed) {
        // Exactly +1 for this round
        streak += 1;
        colors = [...colors, resultColor].slice(-50);
      } else {
        streak = 0;
        colors = [];
      }

      const payload: Record<string, unknown> = {
        telegram_id: tid,
        streak,
        colors,
        username,
        last_round_id: roundId,
        updated_at: new Date().toISOString(),
      };

      const { error: upErr } = await db
        .from("roulette_paravoz")
        .upsert(payload, { onConflict: "telegram_id" });
      if (upErr) {
        // Column last_round_id may be missing — retry without it
        if (String(upErr.message || "").includes("last_round_id")) {
          delete payload.last_round_id;
          await db
            .from("roulette_paravoz")
            .upsert(payload, { onConflict: "telegram_id" });
        } else {
          console.error("[paravoz] upsert", tid, upErr.message);
        }
      }

      // Bonus only for real users at exactly 10
      if (played && guessed && streak === PARAVOZ_TARGET && !isBot) {
        try {
          await creditBalance(tid, PARAVOZ_BONUS_GRAM, "win", {
            kind: "paravoz_bonus",
            streak,
            bonus: PARAVOZ_BONUS_GRAM,
            round_id: roundId,
          });
        } catch (e) {
          console.error("[paravoz] credit", tid, e);
        }
        try {
          await db.from("roulette_paravoz_wins").insert({
            telegram_id: tid,
            username,
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
  if (!telegramId || telegramId <= 0) return empty;
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

export async function getParavozParticipants(
  limit = 30
): Promise<ParavozParticipant[]> {
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("roulette_paravoz")
      .select("telegram_id, username, streak, colors")
      .gt("streak", 0)
      .order("streak", { ascending: false })
      .limit(limit);
    const rows = data || [];
    if (rows.length === 0) return [];

    const realIds = rows
      .map((r) => Number(r.telegram_id))
      .filter((id) => !isRouletteShowcaseBot(id));
    const photoMap = new Map<number, string | null>();
    if (realIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("telegram_id, photo_url")
        .in("telegram_id", realIds);
      for (const pr of profiles || []) {
        photoMap.set(Number(pr.telegram_id), (pr.photo_url as string) || null);
      }
    }

    return rows.map((r) => {
      const tid = Number(r.telegram_id);
      const bot = isRouletteShowcaseBot(tid);
      return {
        telegramId: tid,
        username:
          String(r.username || "") ||
          (bot
            ? ROULETTE_BOTS.find((b) => b.id === tid)?.username || "Player"
            : "Player"),
        photoUrl: bot ? botPhotoUrl(tid) : photoMap.get(tid) ?? null,
        streak: Number(r.streak) || 0,
        colors: Array.isArray(r.colors) ? (r.colors as RouletteColor[]) : [],
      };
    });
  } catch {
    return [];
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

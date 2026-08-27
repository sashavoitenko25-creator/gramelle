"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { HistoryItem } from "@/lib/types";

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("game_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.warn("History load error", error);
        return;
      }

      if (data?.length) {
        setHistory(
          data.map((h) => ({
            id: h.roll_id,
            winner: h.winner,
            chance: Number(h.chance),
            win: Number(h.win_amount),
            mult: Number(h.mult),
            bet: Number(h.bet),
            time: new Date(h.created_at),
            type: "Classic",
            isMe: !!h.is_me,
          }))
        );
      }
    } catch (e) {
      console.warn("History exception", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveItem = useCallback(async (item: HistoryItem) => {
    setHistory((prev) => [item, ...prev]);
    try {
      await supabase.from("game_history").insert({
        roll_id: item.id,
        winner: item.winner,
        chance: item.chance,
        win_amount: item.win,
        mult: item.mult,
        bet: item.bet,
        is_me: item.isMe,
      });
    } catch (e) {
      console.warn("Save history error", e);
    }
  }, []);

  return { history, saveItem, loading, reload: load };
}

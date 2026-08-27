"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { HistoryItem } from "@/lib/types";

const LOCAL_HISTORY_KEY = "gramelle_history_v2";

function loadLocalHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Omit<HistoryItem, "time"> & { time: string }>;
    return parsed.map((h) => ({ ...h, time: new Date(h.time) }));
  } catch {
    return [];
  }
}

function saveLocalHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(
      LOCAL_HISTORY_KEY,
      JSON.stringify(items.slice(0, 50))
    );
  } catch {
    // ignore
  }
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const local = loadLocalHistory();
    setHistory(local);

    try {
      const { data, error } = await supabase
        .from("game_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data?.length) {
        const remote = data.map((h) => ({
          id: h.roll_id,
          winner: h.winner,
          chance: Number(h.chance),
          win: Number(h.win_amount),
          mult: Number(h.mult),
          bet: Number(h.bet),
          time: new Date(h.created_at),
          type: "Classic",
          isMe: !!h.is_me,
        }));
        // Prefer remote if available, merge unique by id
        const map = new Map<number, HistoryItem>();
        [...remote, ...local].forEach((h) => {
          if (!map.has(h.id)) map.set(h.id, h);
        });
        const merged = Array.from(map.values()).sort(
          (a, b) => b.time.getTime() - a.time.getTime()
        );
        setHistory(merged);
        saveLocalHistory(merged);
      }
    } catch (e) {
      console.warn("History remote error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveItem = useCallback(async (item: HistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 50);
      saveLocalHistory(next);
      return next;
    });

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

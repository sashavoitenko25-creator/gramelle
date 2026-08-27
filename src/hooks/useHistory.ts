"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { HistoryItem } from "@/lib/types";

const LOCAL_HISTORY_KEY = "gramelle_history_v4";

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
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    // ignore
  }
}

export function useHistory(telegramId?: number | null) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Clear legacy junk keys once
    try {
      localStorage.removeItem("gramelle_history_v2");
      localStorage.removeItem("gramelle_history_v3");
    } catch {}

    const local = loadLocalHistory();
    setHistory(local);

    try {
      const data = await apiFetch<{
        items: Array<{
          id: number;
          winner: string;
          chance: number;
          win: number;
          mult: number;
          bet: number;
          time: string;
          isMe?: boolean;
          iWon?: boolean;
        }>;
        demo?: boolean;
      }>("/api/history?limit=40");

      if (data.demo) {
        setLoading(false);
        return;
      }

      if (data.items?.length) {
        const remote: HistoryItem[] = data.items.map((h) => ({
          id: h.id,
          winner: h.iWon ? "You" : h.winner,
          chance: h.chance,
          win: h.win,
          mult: h.mult,
          bet: h.bet,
          time: new Date(h.time),
          type: "PvP",
          isMe: !!h.iWon,
        }));
        setHistory(remote);
        saveLocalHistory(remote);
      } else if (!local.length) {
        setHistory([]);
      }
    } catch {
      // keep local
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, telegramId]);

  /** Local optimistic row after a spin (server already wrote DB) */
  const saveItem = useCallback(async (item: HistoryItem) => {
    setHistory((prev) => {
      if (prev.some((h) => h.id === item.id && h.bet === item.bet)) return prev;
      const next = [item, ...prev].slice(0, 50);
      saveLocalHistory(next);
      return next;
    });
  }, []);

  const clearLocal = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(LOCAL_HISTORY_KEY);
    } catch {}
  }, []);

  return { history, saveItem, loading, reload: load, clearLocal };
}

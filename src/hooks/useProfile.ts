"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { START_BALANCE } from "@/lib/constants";
import { fetchSession } from "@/lib/api";
import type { Profile } from "@/lib/types";

interface UseProfileOptions {
  username: string | null;
  telegramId: number | null;
  isReady: boolean;
  startParam: string | null;
}

const LOCAL_KEY = "gramelle_profile_v5";
/** Never leave the skeleton on screen longer than this */
const MAX_LOADING_MS = 7_000;

function loadLocal(name: string, telegramId: number | null): Profile {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      if (telegramId && p.telegram_id === telegramId) return p;
      if (!telegramId && p.username === name) return p;
    }
  } catch {
    // ignore
  }
  return {
    id: "local_" + (telegramId || name),
    username: name,
    balance: START_BALANCE,
    referral_code: "ref_" + name.toLowerCase().replace(/\s+/g, ""),
    ref_earned: 0,
    ref_count: 0,
    telegram_id: telegramId,
  };
}

function saveLocal(p: Profile) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

/**
 * Profile + balance.
 * Shows cached local profile ASAP, then refreshes from server.
 * Hard timeout so the skeleton never sticks forever.
 */
export function useProfile({
  username,
  telegramId,
  isReady,
  startParam,
}: UseProfileOptions) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [loading, setLoading] = useState(true);
  const [serverMode, setServerMode] = useState(false);
  const loadGen = useRef(0);

  const applyLocal = useCallback(
    (name: string, tid: number | null) => {
      const local = loadLocal(name, tid);
      setProfile(local);
      setBalance(local.balance);
      setServerMode(false);
    },
    []
  );

  const load = useCallback(async () => {
    if (!isReady) return;
    const gen = ++loadGen.current;

    try {
      localStorage.removeItem("gramelle_profile_v3");
      localStorage.removeItem("gramelle_history_v2");
    } catch {
      /* */
    }

    const name =
      username ||
      (typeof window !== "undefined"
        ? localStorage.getItem("gramelle_username")
        : null) ||
      "Player" + Math.floor(Math.random() * 9000 + 1000);

    if (typeof window !== "undefined") {
      localStorage.setItem("gramelle_username", name);
    }

    // Paint cached profile immediately — don't wait for network
    const cached = loadLocal(name, telegramId);
    if (gen === loadGen.current) {
      setProfile(cached);
      setBalance(cached.balance);
    }

    const initData =
      typeof window !== "undefined" ? window.Telegram?.WebApp?.initData : "";

    if (!initData) {
      if (gen === loadGen.current) {
        applyLocal(name, telegramId);
        setLoading(false);
      }
      return;
    }

    try {
      const session = await fetchSession(startParam);
      if (gen !== loadGen.current) return;

      if (session.ok && session.profile) {
        const p: Profile = {
          id: session.profile.id,
          username: session.profile.username,
          balance: session.profile.balance,
          referral_code: session.profile.referral_code,
          ref_earned: session.profile.ref_earned,
          ref_count: session.profile.ref_count,
          telegram_id: session.user?.telegramId ?? telegramId,
          photo_url: session.profile.photo_url,
          biggest_win: session.profile.biggest_win,
          wins: session.profile.wins,
          games: session.profile.games,
          ref_active: session.profile.ref_active,
          ref_turnover: session.profile.ref_turnover,
          wager_remaining: session.profile.wager_remaining ?? 0,
        };
        setProfile(p);
        setBalance(p.balance);
        saveLocal(p);
        setServerMode(true);
        setLoading(false);
        return;
      }
    } catch {
      // network / timeout — keep cached
    }

    if (gen === loadGen.current) {
      // Keep whatever we painted from cache
      setLoading(false);
    }
  }, [username, telegramId, isReady, startParam, applyLocal]);

  useEffect(() => {
    void load();
  }, [load]);

  // Absolute safety: never stay on skeleton > MAX_LOADING_MS
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => {
      setLoading(false);
    }, MAX_LOADING_MS);
    return () => clearTimeout(t);
  }, [loading]);

  const saveBalance = useCallback(
    async (newBalance: number, refEarned?: number, refCount?: number) => {
      setBalance(newBalance);
      setProfile((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          balance: newBalance,
          ...(refEarned !== undefined && { ref_earned: refEarned }),
          ...(refCount !== undefined && { ref_count: refCount }),
        };
        saveLocal(next);
        return next;
      });
    },
    []
  );

  const setBalanceFromServer = useCallback((newBalance: number) => {
    setBalance(newBalance);
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, balance: newBalance };
      saveLocal(next);
      return next;
    });
  }, []);

  return {
    profile,
    balance,
    setBalance,
    saveBalance,
    setBalanceFromServer,
    loading,
    serverMode,
    reload: load,
    username: profile?.username || username || "Player",
  };
}

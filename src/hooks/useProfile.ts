"use client";

import { useCallback, useEffect, useState } from "react";
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
 * Production: balance comes only from server session / bet / payment APIs.
 * Demo (no server): localStorage fallback.
 */
export function useProfile({
  username,
  telegramId,
  isReady,
}: UseProfileOptions) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [loading, setLoading] = useState(true);
  const [serverMode, setServerMode] = useState(false);

  const load = useCallback(async () => {
    if (!isReady) return;
    try {
      localStorage.removeItem("gramelle_profile_v3");
      localStorage.removeItem("gramelle_history_v2");
    } catch {}

    const name =
      username ||
      (typeof window !== "undefined"
        ? localStorage.getItem("gramelle_username")
        : null) ||
      "Player" + Math.floor(Math.random() * 9000 + 1000);

    if (typeof window !== "undefined") {
      localStorage.setItem("gramelle_username", name);
    }

    // Try secure server session first
    try {
      const initData =
        typeof window !== "undefined"
          ? window.Telegram?.WebApp?.initData
          : "";
      if (initData) {
        const session = await fetchSession();
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
          };
          setProfile(p);
          setBalance(p.balance);
          saveLocal(p);
          setServerMode(true);
          setLoading(false);
          return;
        }
      }
    } catch {
      // fall through to local demo
    }

    const local = loadLocal(name, telegramId);
    setProfile(local);
    setBalance(local.balance);
    setServerMode(false);
    setLoading(false);
  }, [username, telegramId, isReady]);

  useEffect(() => {
    load();
  }, [load]);

  /** Local-only balance update (demo). In server mode prefer setBalanceFromServer. */
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

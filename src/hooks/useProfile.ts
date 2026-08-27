"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { START_BALANCE } from "@/lib/constants";
import type { Profile } from "@/lib/types";

interface UseProfileOptions {
  username: string | null;
  telegramId: number | null;
  isReady: boolean;
}

export function useProfile({ username, telegramId, isReady }: UseProfileOptions) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [loading, setLoading] = useState(true);

  const loadOrCreate = useCallback(async () => {
    if (!isReady) return;
    const name =
      username ||
      localStorage.getItem("gramelle_username") ||
      "Player" + Math.floor(Math.random() * 9000 + 1000);

    localStorage.setItem("gramelle_username", name);

    try {
      let data: Profile | null = null;

      if (telegramId) {
        const { data: byTg } = await supabase
          .from("profiles")
          .select("*")
          .eq("telegram_id", telegramId)
          .maybeSingle();
        data = byTg as Profile | null;
      }

      if (!data) {
        const { data: byName } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", name)
          .maybeSingle();
        data = byName as Profile | null;
      }

      if (!data) {
        const code = "ref_" + name.toLowerCase().replace(/\s/g, "");
        const insertData: Record<string, unknown> = {
          username: name,
          balance: START_BALANCE,
          referral_code: code,
          ref_earned: 0,
          ref_count: 0,
        };
        if (telegramId) insertData.telegram_id = telegramId;

        const { data: created, error } = await supabase
          .from("profiles")
          .insert(insertData)
          .select()
          .single();

        if (!error && created) data = created as Profile;
      }

      if (data) {
        setProfile(data);
        setBalance(Number(data.balance) || START_BALANCE);
      } else {
        setProfile({
          id: "",
          username: name,
          balance: START_BALANCE,
          referral_code: "ref_" + name.toLowerCase(),
          ref_earned: 0,
          ref_count: 0,
          telegram_id: telegramId,
        });
      }
    } catch (e) {
      console.warn("Profile error", e);
      setProfile({
        id: "",
        username: name,
        balance: START_BALANCE,
        referral_code: "ref_" + name.toLowerCase(),
        ref_earned: 0,
        ref_count: 0,
        telegram_id: telegramId,
      });
    } finally {
      setLoading(false);
    }
  }, [username, telegramId, isReady]);

  useEffect(() => {
    loadOrCreate();
  }, [loadOrCreate]);

  const saveBalance = useCallback(
    async (newBalance: number, refEarned?: number, refCount?: number) => {
      setBalance(newBalance);
      if (!profile?.id) return;
      try {
        await supabase
          .from("profiles")
          .update({
            balance: newBalance,
            ...(refEarned !== undefined && { ref_earned: refEarned }),
            ...(refCount !== undefined && { ref_count: refCount }),
          })
          .eq("id", profile.id);
      } catch (e) {
        console.warn("Save balance error", e);
      }
    },
    [profile?.id]
  );

  return {
    profile,
    balance,
    setBalance,
    saveBalance,
    loading,
    username: profile?.username || username || "Player",
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";

type Tab = "withdrawals" | "players" | "stats";

interface Withdrawal {
  id: string;
  telegram_id: number;
  amount_ton: number;
  amount_gram: number;
  wallet_address: string;
  status: string;
  created_at: string;
  tx_hash?: string;
}

interface Player {
  id: string;
  username: string;
  telegram_id: number;
  balance: number;
  banned: boolean;
  ban_reason?: string;
  wins?: number;
  games?: number;
  created_at: string;
}

interface Stats {
  players: number;
  banned: number;
  pendingWithdrawals: number;
  deposits24h: number;
  bets24h: number;
  rounds24h: number;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("withdrawals");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [txHash, setTxHash] = useState<Record<string, string>>({});

  useEffect(() => {
    const s = sessionStorage.getItem("gramelle_admin_secret");
    if (s) {
      setSecret(s);
      setAuthed(true);
    }
  }, []);

  const headers = useCallback((): HeadersInit => {
    return {
      "Content-Type": "application/json",
      "x-admin-secret": secret,
    };
  }, [secret]);

  const login = () => {
    if (!secret.trim()) return;
    sessionStorage.setItem("gramelle_admin_secret", secret.trim());
    setSecret(secret.trim());
    setAuthed(true);
  };

  const logout = () => {
    sessionStorage.removeItem("gramelle_admin_secret");
    setAuthed(false);
    setSecret("");
  };

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/withdrawals?status=pending", {
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setWithdrawals(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      if (String(e).includes("Unauthorized")) logout();
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/players${q}`, { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPlayers(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [headers, search]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "withdrawals") loadWithdrawals();
    if (tab === "players") loadPlayers();
    if (tab === "stats") loadStats();
  }, [authed, tab, loadWithdrawals, loadPlayers, loadStats]);

  const actWithdraw = async (id: string, action: "complete" | "reject") => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          id,
          action,
          tx_hash: txHash[id] || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await loadWithdrawals();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const toggleBan = async (telegramId: number, banned: boolean) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          telegram_id: telegramId,
          banned,
          reason: banned ? "Banned by admin" : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await loadPlayers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center p-6">
        <div className="w-full max-w-sm glass-strong rounded-3xl p-6 border border-white/10">
          <h1 className="text-xl font-semibold mb-1">Gramelle Admin</h1>
          <p className="text-xs text-white/40 mb-5">Enter ADMIN_SECRET from env</p>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Secret"
            className="w-full h-12 rounded-2xl bg-black/40 border border-white/10 px-4 text-sm outline-none focus:border-cyan-500/40 mb-3"
          />
          <button
            onClick={login}
            className="w-full h-11 rounded-2xl btn-primary text-sm"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-bg text-white pb-16">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
            <p className="text-xs text-white/35 mt-0.5">Gramelle control panel</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-white/40 hover:text-white/70 px-3 py-1.5 rounded-lg border border-white/10"
          >
            Logout
          </button>
        </div>

        <div className="flex gap-2 mb-5 p-1 rounded-2xl bg-black/30 border border-white/[0.06]">
          {(
            [
              ["withdrawals", "Withdrawals"],
              ["players", "Players"],
              ["stats", "Stats"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition ${
                tab === id
                  ? "bg-white/10 text-white border border-white/10"
                  : "text-white/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-xs text-white/30 mb-3 pulse-soft">Loading…</p>
        )}

        {tab === "stats" && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ["Players", stats.players],
              ["Banned", stats.banned],
              ["Pending WD", stats.pendingWithdrawals],
              ["Deposits 24h", stats.deposits24h],
              ["Bets 24h", stats.bets24h],
              ["Rounds 24h", stats.rounds24h],
            ].map(([k, v]) => (
              <div
                key={String(k)}
                className="rounded-2xl glass p-4 border border-white/[0.07]"
              >
                <div className="text-2xl font-semibold tabular-nums">{v}</div>
                <div className="text-[10px] text-white/35 uppercase tracking-wider mt-1">
                  {k}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "withdrawals" && (
          <div className="space-y-3">
            <button
              onClick={loadWithdrawals}
              className="text-xs text-cyan-300/80 hover:text-cyan-200"
            >
              Refresh
            </button>
            {withdrawals.length === 0 && !loading && (
              <p className="text-sm text-white/35 py-8 text-center">
                No pending withdrawals
              </p>
            )}
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 space-y-2"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-sky-300">
                    {w.amount_ton} TON
                  </span>
                  <span className="text-white/30 text-xs">
                    tg:{w.telegram_id}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-white/45 break-all">
                  {w.wallet_address}
                </p>
                <p className="text-[10px] text-white/25">
                  {new Date(w.created_at).toLocaleString()}
                </p>
                <input
                  placeholder="tx hash (optional)"
                  value={txHash[w.id] || ""}
                  onChange={(e) =>
                    setTxHash((prev) => ({ ...prev, [w.id]: e.target.value }))
                  }
                  className="w-full h-9 rounded-xl bg-black/30 border border-white/10 px-3 text-xs font-mono outline-none"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => actWithdraw(w.id, "complete")}
                    className="flex-1 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-semibold"
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => actWithdraw(w.id, "reject")}
                    className="flex-1 h-9 rounded-xl bg-red-500/15 border border-red-500/25 text-red-200 text-xs font-semibold"
                  >
                    Reject + refund
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "players" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search username or telegram id"
                className="flex-1 h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm outline-none"
              />
              <button
                onClick={loadPlayers}
                className="px-4 rounded-xl btn-secondary text-xs border border-white/10"
              >
                Search
              </button>
            </div>
            {players.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.username}{" "}
                    {p.banned && (
                      <span className="text-[10px] text-red-300 ml-1">BANNED</span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/35 mt-0.5">
                    tg:{p.telegram_id} · bal {Number(p.balance).toFixed(2)} ·{" "}
                    {p.wins || 0}/{p.games || 0} wins
                  </div>
                </div>
                <button
                  onClick={() => toggleBan(p.telegram_id, !p.banned)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold border ${
                    p.banned
                      ? "border-emerald-500/30 text-emerald-200 bg-emerald-500/10"
                      : "border-red-500/30 text-red-200 bg-red-500/10"
                  }`}
                >
                  {p.banned ? "Unban" : "Ban"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

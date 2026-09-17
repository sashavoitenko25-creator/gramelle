"use client";

import { useCallback, useEffect, useState } from "react";

type Tab = "withdrawals" | "players" | "stats" | "roulette";

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
  rpsFinished24h?: number;
  raceFinished24h?: number;
  diceFinished24h?: number;
  xoFinished24h?: number;
}

type RouletteColor = "red" | "black" | "green";

interface RouletteColorBucket {
  red: number;
  black: number;
  green: number;
  total: number;
  pct: { red: number; black: number; green: number };
}

interface RouletteAnalytics {
  ok: boolean;
  expected: { red: number; black: number; green: number };
  totals: {
    all: RouletteColorBucket;
    d24: RouletteColorBucket;
    d7: RouletteColorBucket;
  };
  recent: { id: string; color: RouletteColor; slot: number | null; at: string }[];
  byHour: number[];
  byHourColor: Record<RouletteColor, number[]>;
  economy24h: {
    stake: number;
    payout: number;
    house: number;
    bets: number;
    players: number;
  };
  maxStreak: { color: RouletteColor; len: number };
  active: {
    id: string;
    status: string;
    bet_ends_at?: string;
    created_at?: string;
  } | null;
  sampledRounds: number;
}

const COLOR_LABEL: Record<RouletteColor, string> = {
  red: "Red",
  black: "Black",
  green: "Green",
};

const COLOR_DOT: Record<RouletteColor, string> = {
  red: "bg-rose-500",
  black: "bg-slate-400",
  green: "bg-emerald-400",
};

const COLOR_TEXT: Record<RouletteColor, string> = {
  red: "text-rose-300",
  black: "text-slate-300",
  green: "text-emerald-300",
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("withdrawals");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [roulette, setRoulette] = useState<RouletteAnalytics | null>(null);
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
      const normalized: Stats = {
        players: Number(data.players) || 0,
        banned: Number(data.banned) || 0,
        pendingWithdrawals: Number(data.pendingWithdrawals) || 0,
        deposits24h: Number(data.deposits24h) || 0,
        bets24h: Number(data.bets24h) || 0,
        rounds24h: Number(data.rounds24h) || Number(data.rpsFinished24h) || 0,
        rpsFinished24h: Number(data.rpsFinished24h) || 0,
        raceFinished24h: Number(data.raceFinished24h) || 0,
        diceFinished24h: Number(data.diceFinished24h) || 0,
        xoFinished24h: Number(data.xoFinished24h) || 0,
      };
      setStats(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const loadRoulette = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/roulette", { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRoulette(data as RouletteAnalytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setRoulette(null);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "withdrawals") loadWithdrawals();
    if (tab === "players") loadPlayers();
    if (tab === "stats") loadStats();
    if (tab === "roulette") loadRoulette();
  }, [authed, tab, loadWithdrawals, loadPlayers, loadStats, loadRoulette]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

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
          <button onClick={login} className="w-full h-11 rounded-2xl btn-primary text-sm">
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

        <div className="flex gap-1.5 mb-5 p-1 rounded-2xl bg-black/30 border border-white/[0.06] overflow-x-auto">
          {(
            [
              ["withdrawals", "Withdrawals"],
              ["players", "Players"],
              ["stats", "Stats"],
              ["roulette", "Roulette"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 min-w-[4.5rem] py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
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

        {/* ─── STATS ─── */}
        {tab === "stats" && (
          <>
            {stats ? (
              <div className="space-y-4">
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

                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2 px-1">
                    Games finished (24h)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      ["RPS", stats.rpsFinished24h ?? 0],
                      ["Race", stats.raceFinished24h ?? 0],
                      ["Dice", stats.diceFinished24h ?? 0],
                      ["XO", stats.xoFinished24h ?? 0],
                    ].map(([k, v]) => (
                      <div
                        key={String(k)}
                        className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3"
                      >
                        <div className="text-lg font-semibold tabular-nums">{v}</div>
                        <div className="text-[10px] text-white/35 mt-0.5">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={loadStats}
                  className="text-xs text-cyan-300/80 hover:text-cyan-200"
                >
                  Refresh stats
                </button>
              </div>
            ) : (
              !loading && (
                <p className="text-sm text-white/35 py-8 text-center">
                  No stats data. Check ADMIN_SECRET and Supabase.
                </p>
              )
            )}
          </>
        )}

        {/* ─── ROULETTE ─── */}
        {tab === "roulette" && (
          <>
            {roulette ? (
              <div className="space-y-5">
                {/* Active round */}
                <div className="rounded-2xl glass p-4 border border-white/[0.07]">
                  <div className="text-[10px] text-white/35 uppercase tracking-wider mb-1">
                    Active round
                  </div>
                  {roulette.active ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold capitalize text-cyan-200">
                          {roulette.active.status}
                        </div>
                        <div className="text-[11px] font-mono text-white/40 mt-0.5 truncate max-w-[220px]">
                          {roulette.active.id}
                        </div>
                      </div>
                      {roulette.active.bet_ends_at && (
                        <div className="text-[11px] text-white/45 text-right">
                          bet ends
                          <br />
                          {new Date(roulette.active.bet_ends_at).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-white/40">No active round</p>
                  )}
                </div>

                {/* Economy 24h */}
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2 px-1">
                    Economy 24h
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      ["Stake", roulette.economy24h.stake],
                      ["Payout", roulette.economy24h.payout],
                      ["House", roulette.economy24h.house],
                      ["Bets", roulette.economy24h.bets],
                      ["Players", roulette.economy24h.players],
                      ["Sampled", roulette.sampledRounds],
                    ].map(([k, v]) => (
                      <div
                        key={String(k)}
                        className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3"
                      >
                        <div
                          className={`text-lg font-semibold tabular-nums ${
                            k === "House"
                              ? Number(v) >= 0
                                ? "text-emerald-300"
                                : "text-rose-300"
                              : ""
                          }`}
                        >
                          {typeof v === "number" &&
                          k !== "Bets" &&
                          k !== "Players" &&
                          k !== "Sampled"
                            ? Number(v).toFixed(2)
                            : v}
                        </div>
                        <div className="text-[10px] text-white/35 mt-0.5">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Color distribution */}
                {(
                  [
                    ["24h", roulette.totals.d24],
                    ["7d", roulette.totals.d7],
                    ["All", roulette.totals.all],
                  ] as const
                ).map(([label, bucket]) => (
                  <div key={label}>
                    <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2 px-1">
                      Results · {label} ({bucket.total})
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {(["red", "black", "green"] as RouletteColor[]).map((c) => (
                        <div
                          key={c}
                          className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${COLOR_DOT[c]}`} />
                            <span className={`text-[11px] font-medium ${COLOR_TEXT[c]}`}>
                              {COLOR_LABEL[c]}
                            </span>
                          </div>
                          <div className="text-xl font-semibold tabular-nums">{bucket[c]}</div>
                          <div className="text-[10px] text-white/35 mt-0.5">
                            {bucket.pct[c]}%
                            <span className="text-white/25">
                              {" "}
                              · exp {roulette.expected[c]}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Max streak */}
                <div className="rounded-2xl glass p-4 border border-white/[0.07] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-white/35 uppercase tracking-wider mb-1">
                      Max streak (recent)
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[roulette.maxStreak.color]}`}
                      />
                      <span
                        className={`text-sm font-semibold ${COLOR_TEXT[roulette.maxStreak.color]}`}
                      >
                        {COLOR_LABEL[roulette.maxStreak.color]} × {roulette.maxStreak.len}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recent strip */}
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider">
                      Recent results
                    </p>
                    <button
                      onClick={loadRoulette}
                      className="text-xs text-cyan-300/80 hover:text-cyan-200"
                    >
                      Refresh
                    </button>
                  </div>
                  {roulette.recent.length === 0 ? (
                    <p className="text-sm text-white/35 py-6 text-center">
                      No settled rounds yet
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {roulette.recent.map((r) => (
                        <div
                          key={r.id}
                          title={`${r.color}${r.slot != null ? ` #${r.slot}` : ""} · ${new Date(r.at).toLocaleString()}`}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border ${
                            r.color === "red"
                              ? "bg-rose-500/25 border-rose-500/40 text-rose-200"
                              : r.color === "green"
                                ? "bg-emerald-500/25 border-emerald-500/40 text-emerald-200"
                                : "bg-slate-500/25 border-slate-400/40 text-slate-200"
                          }`}
                        >
                          {r.color === "red" ? "R" : r.color === "green" ? "G" : "B"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* By hour (24h) */}
                {roulette.byHour?.some((n) => n > 0) && (
                  <div>
                    <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2 px-1">
                      Rounds by hour (24h)
                    </p>
                    <div className="flex items-end gap-0.5 h-16 px-1">
                      {roulette.byHour.map((n, h) => {
                        const max = Math.max(...roulette.byHour, 1);
                        const hgt = Math.max(2, (n / max) * 56);
                        return (
                          <div
                            key={h}
                            title={`${h}:00 — ${n}`}
                            className="flex-1 rounded-t bg-cyan-400/40 hover:bg-cyan-300/60 transition-colors"
                            style={{ height: hgt }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] text-white/25 px-1 mt-1">
                      <span>0</span>
                      <span>6</span>
                      <span>12</span>
                      <span>18</span>
                      <span>23</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              !loading && (
                <p className="text-sm text-white/35 py-8 text-center">
                  No roulette data. Check tables roulette_rounds / roulette_bets.
                </p>
              )
            )}
          </>
        )}

        {/* ─── WITHDRAWALS ─── */}
        {tab === "withdrawals" && (
          <div className="space-y-3">
            <button
              onClick={loadWithdrawals}
              className="text-xs text-cyan-300/80 hover:text-cyan-200"
            >
              Refresh
            </button>
            {withdrawals.length === 0 && !loading && (
              <p className="text-sm text-white/35 py-8 text-center">No pending withdrawals</p>
            )}
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 space-y-2"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-sky-300">{w.amount_ton} TON</span>
                  <span className="text-white/30 text-xs">tg:{w.telegram_id}</span>
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
                    type="button"
                    onClick={() => copy(w.wallet_address)}
                    className="flex-1 h-8 rounded-xl bg-white/[0.05] border border-white/10 text-white/60 text-[11px] font-medium"
                  >
                    Copy wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(String(w.amount_ton))}
                    className="h-8 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white/60 text-[11px] font-medium"
                  >
                    Copy amt
                  </button>
                </div>
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

        {/* ─── PLAYERS ─── */}
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
                    tg:{p.telegram_id} · bal {p.balance}
                    {p.games != null ? ` · ${p.wins ?? 0}/${p.games} wins` : ""}
                  </div>
                </div>
                <button
                  onClick={() => toggleBan(p.telegram_id, !p.banned)}
                  className={`shrink-0 h-8 px-3 rounded-xl text-[11px] font-semibold border ${
                    p.banned
                      ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-200"
                      : "bg-red-500/15 border-red-500/25 text-red-200"
                  }`}
                >
                  {p.banned ? "Unban" : "Ban"}
                </button>
              </div>
            ))}
            {players.length === 0 && !loading && (
              <p className="text-sm text-white/35 py-8 text-center">No players found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

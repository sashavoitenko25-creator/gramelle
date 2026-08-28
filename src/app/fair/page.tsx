"use client";

import { useEffect, useState } from "react";
import { HOUSE_EDGE, MIN_BET, ROOMS } from "@/lib/constants";

interface RecentItem {
  rollId: number;
  mode: string;
  pot: number;
  winner: string;
  chance: number;
  hasSeed: boolean;
}

interface Stats {
  rounds24h?: number;
  bets24h?: number;
}

export default function FairPage() {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [rollId, setRollId] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    hashMatches?: boolean;
    winnerMatches?: boolean;
    computedWinner?: { username: string; amount: number } | null;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/rounds/recent?limit=8")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  }, []);

  const verify = async () => {
    const id = Number(rollId);
    if (!Number.isFinite(id)) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/verify?rollId=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
    } catch (e) {
      setResult({
        ok: false,
        error: e instanceof Error ? e.message : "Failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-bg text-white">
      <div className="max-w-lg mx-auto px-4 pt-10 pb-16">
        <div className="mb-8">
          <p className="text-[11px] text-cyan-300/70 uppercase tracking-[0.14em] mb-2">
            Gramelle
          </p>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            Provably Fair
          </h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Every round commits a server seed hash before bets close. After the
            spin, the seed is revealed — anyone can recompute the winner.
          </p>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 mb-5 space-y-3 text-sm text-white/65">
          <p>
            <span className="text-white/90 font-medium">1. Commit</span> — hash
            of the secret seed is shown while the round is open.
          </p>
          <p>
            <span className="text-white/90 font-medium">2. Spin</span> — winner
            is chosen with HMAC-SHA256 from seed + roll id, weighted by bets.
          </p>
          <p>
            <span className="text-white/90 font-medium">3. Reveal</span> — seed
            is published; SHA256(seed) must match the hash.
          </p>
          <p className="text-xs text-white/35 pt-1">
            House edge {(HOUSE_EDGE * 100).toFixed(0)}% · Classic from {MIN_BET}{" "}
            GRAM · High from {ROOMS.high.minBet} GRAM
          </p>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-black/30 p-5 mb-5">
          <h2 className="text-sm font-semibold mb-3">Verify a roll</h2>
          <div className="flex gap-2">
            <input
              type="number"
              value={rollId}
              onChange={(e) => setRollId(e.target.value)}
              placeholder="Roll ID"
              className="flex-1 h-11 rounded-2xl bg-black/40 border border-white/10 px-4 text-sm outline-none focus:border-cyan-500/35"
            />
            <button
              onClick={verify}
              disabled={loading}
              className="h-11 px-4 rounded-2xl btn-primary text-sm disabled:opacity-40"
            >
              {loading ? "…" : "Check"}
            </button>
          </div>
          {result && (
            <div
              className={`mt-3 rounded-xl px-3 py-2.5 text-xs border ${
                result.ok
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-200"
                  : "bg-red-500/10 border-red-500/25 text-red-200"
              }`}
            >
              {result.error
                ? result.error
                : result.ok
                  ? `✓ Fair — @${result.computedWinner?.username || "?"} won`
                  : "✗ Verification failed"}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[11px] text-white/35 uppercase tracking-[0.12em] mb-3">
              Recent finished
            </h2>
            <div className="space-y-2">
              {items.map((r) => (
                <button
                  key={r.rollId}
                  type="button"
                  onClick={() => {
                    setRollId(String(r.rollId));
                    setResult(null);
                  }}
                  className="w-full flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left hover:border-cyan-500/25 transition"
                >
                  <div>
                    <div className="text-sm text-white/80">
                      #{r.rollId} · @{r.winner}
                    </div>
                    <div className="text-[11px] text-white/30 mt-0.5">
                      {r.mode} · {r.chance}% chance
                    </div>
                  </div>
                  <div className="text-sm tabular-nums text-cyan-300/80">
                    {Number(r.pot).toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-white/35 leading-relaxed">
          Entertainment only. 18+. Not available where restricted. Play
          responsibly. Gramelle does not offer financial advice.
        </div>

        <p className="text-center text-[11px] text-white/25 mt-6">
          <a href="/" className="hover:text-white/50 transition">
            ← Back to app
          </a>
        </p>
      </div>
    </div>
  );
}

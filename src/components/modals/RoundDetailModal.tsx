"use client";

import { useEffect, useState } from "react";
import { formatGram, cn } from "@/lib/utils";

interface PlayerRow {
  username: string;
  amount: number;
  chance: number;
  color?: string;
  photoUrl?: string | null;
  isWinner?: boolean;
}

interface DetailData {
  rollId: number;
  mode?: string;
  bank: number;
  pot: number;
  houseFee: number;
  winner: string;
  winnerPhoto?: string | null;
  chance: number;
  mult?: number;
  serverSeedHash?: string | null;
  serverSeed?: string | null;
  at?: string;
  players: PlayerRow[];
}

interface Props {
  open: boolean;
  rollId: number | null;
  onClose: () => void;
}

function Avatar({
  name,
  photoUrl,
  size = 36,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const letter = (name || "?").replace(/^@/, "").charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full overflow-hidden bg-white/10 border border-white/12 flex items-center justify-center shrink-0 font-semibold text-white/80"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        letter
      )}
    </div>
  );
}

function copyText(text: string) {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

export function RoundDetailModal({ open, rollId, onClose }: Props) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || rollId == null) {
      setData(null);
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/rounds/detail?rollId=${rollId}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed");
        if (alive) setData(j);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Failed");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, rollId]);

  if (!open) return null;

  const hash = data?.serverSeedHash;
  const seed = data?.serverSeed;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-[#0a0a12] border border-white/[0.08] shadow-[0_-20px_80px_rgba(0,0,0,0.55)] slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-[#0a0a12]/95 backdrop-blur-md px-5 pt-4 pb-3 border-b border-white/[0.05]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Roll #{rollId}
              </h2>
              {data?.at && (
                <p className="text-[11px] text-white/35 mt-0.5">
                  {new Date(data.at).toLocaleString()}
                  {data.mode ? ` · ${data.mode}` : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/50"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {loading && (
            <p className="text-xs text-white/35 text-center py-8 pulse-soft">
              Loading…
            </p>
          )}
          {error && (
            <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {data && (
            <>
              {/* Fairness */}
              <div className="space-y-2">
                {hash && (
                  <button
                    type="button"
                    onClick={() => copyText(hash)}
                    className="w-full flex items-center justify-between gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.07] px-3.5 py-2.5 text-left"
                  >
                    <span className="text-[10px] text-white/35 uppercase tracking-wider shrink-0">
                      Hash
                    </span>
                    <span className="text-[11px] font-mono text-white/60 truncate">
                      {hash.slice(0, 10)}…{hash.slice(-6)}
                    </span>
                  </button>
                )}
                {seed && (
                  <button
                    type="button"
                    onClick={() => copyText(seed)}
                    className="w-full flex items-center justify-between gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.07] px-3.5 py-2.5 text-left"
                  >
                    <span className="text-[10px] text-white/35 uppercase tracking-wider shrink-0">
                      Seed
                    </span>
                    <span className="text-[11px] font-mono text-white/60 truncate">
                      {seed.slice(0, 8)}…{seed.slice(-6)}
                    </span>
                  </button>
                )}
              </div>

              {/* Winner card */}
              <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-violet-500/5 p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-300/60 mb-2.5">
                  Winner
                </div>
                <div className="flex items-center gap-3">
                  <Avatar
                    name={data.winner}
                    photoUrl={data.winnerPhoto}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold truncate">
                      @{data.winner}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      {data.chance.toFixed(2)}% chance
                      {data.mult != null && (
                        <span className="text-white/25"> · x{data.mult}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[15px] font-semibold text-emerald-300 tabular-nums">
                      +{formatGram(data.pot)}
                    </div>
                    <div className="text-[10px] text-white/30">GRAM</div>
                  </div>
                </div>
              </div>

              {/* Players */}
              <div className="space-y-2">
                {data.players.map((pl, i) => (
                  <div
                    key={`${pl.username}-${i}`}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                      pl.isWinner
                        ? "border-cyan-400/20 bg-cyan-500/[0.06]"
                        : "border-white/[0.06] bg-white/[0.03]"
                    )}
                  >
                    <Avatar name={pl.username} photoUrl={pl.photoUrl} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        @{pl.username}
                      </div>
                      <div className="text-[11px] text-white/35 tabular-nums">
                        {pl.chance.toFixed(2)}%
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-white/80">
                      {formatGram(pl.amount)}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-center text-[10px] text-white/25 pt-1 pb-2">
                Bank {formatGram(data.bank)} · house {formatGram(data.houseFee)}{" "}
                GRAM
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

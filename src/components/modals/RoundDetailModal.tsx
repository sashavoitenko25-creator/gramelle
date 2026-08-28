"use client";

import { useEffect, useState } from "react";
import { formatGram, cn } from "@/lib/utils";

interface PlayerRow {
  telegramId?: number;
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
  clientSeed?: string | null;
  at?: string;
  players: PlayerRow[];
  rollInfo?: Record<string, { amount: number; username: string }>;
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

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={label || "Copy"}
      onClick={(e) => {
        e.stopPropagation();
        copyText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className={cn(
        "shrink-0 h-7 w-7 rounded-lg border flex items-center justify-center transition",
        done
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
          : "border-white/10 bg-white/[0.05] text-white/45 hover:text-white/80"
      )}
    >
      {done ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 012-2h10" />
        </svg>
      )}
    </button>
  );
}

export function RoundDetailModal({ open, rollId, onClose }: Props) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legit, setLegit] = useState<"idle" | "loading" | "ok" | "fail">("idle");
  const [legitMsg, setLegitMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || rollId == null) {
      setData(null);
      setError(null);
      setLegit("idle");
      setLegitMsg(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setLegit("idle");
    setLegitMsg(null);
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

  const downloadRollInfo = () => {
    if (!data) return;
    const payload =
      data.rollInfo ||
      Object.fromEntries(
        (data.players || []).map((p) => [
          String(p.telegramId || p.username),
          { amount: +Number(p.amount).toFixed(4), username: p.username },
        ])
      );
    const json = JSON.stringify(payload);
    const filename = `gramelle-spin-${data.rollId}.json`;
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      /* ignore */
    }
    // Telegram WebView often blocks downloads — copy as fallback
    try {
      void navigator.clipboard.writeText(json);
    } catch {
      /* ignore */
    }
  };

  const runLegitCheck = async () => {
    if (rollId == null) return;
    setLegit("loading");
    setLegitMsg(null);
    try {
      const res = await fetch(`/api/verify?rollId=${rollId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Verify failed");
      const ok = Boolean(j.ok && j.hashMatches && j.winnerMatches);
      if (ok) {
        setLegit("ok");
        setLegitMsg("Hash matches seed · winner recomputed correctly");
      } else {
        setLegit("fail");
        const parts: string[] = [];
        if (!j.hashMatches) parts.push("hash ≠ seed");
        if (!j.winnerMatches) parts.push("winner mismatch");
        setLegitMsg(parts.join(" · ") || "Verification failed");
      }
    } catch (e) {
      setLegit("fail");
      setLegitMsg(e instanceof Error ? e.message : "Verify failed");
    }
  };

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
              {/* Fairness rows with copy */}
              <div className="space-y-2">
                {hash && (
                  <div className="w-full flex items-center gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.07] px-3 py-2">
                    <span className="text-[10px] text-white/35 uppercase tracking-wider shrink-0 w-10">
                      Hash
                    </span>
                    <span className="text-[11px] font-mono text-white/60 truncate flex-1">
                      {hash.slice(0, 12)}…{hash.slice(-8)}
                    </span>
                    <CopyBtn text={hash} label="Copy hash" />
                  </div>
                )}
                {seed && (
                  <div className="w-full flex items-center gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.07] px-3 py-2">
                    <span className="text-[10px] text-white/35 uppercase tracking-wider shrink-0 w-10">
                      Seed
                    </span>
                    <span className="text-[11px] font-mono text-white/60 truncate flex-1">
                      {seed.slice(0, 10)}…{seed.slice(-8)}
                    </span>
                    <CopyBtn text={seed} label="Copy seed" />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={downloadRollInfo}
                  className="h-11 rounded-2xl bg-white/[0.05] border border-white/10 text-[12px] font-semibold text-white/75 hover:bg-white/[0.08] transition flex items-center justify-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12M7 10l5 5 5-5M5 19h14" />
                  </svg>
                  Roll info
                </button>
                <button
                  type="button"
                  onClick={runLegitCheck}
                  disabled={legit === "loading"}
                  className={cn(
                    "h-11 rounded-2xl border text-[12px] font-semibold transition flex items-center justify-center gap-1.5",
                    legit === "ok"
                      ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200 shadow-[0_0_24px_rgba(52,211,153,0.25)]"
                      : legit === "fail"
                        ? "bg-red-500/15 border-red-400/35 text-red-200"
                        : "bg-cyan-500/10 border-cyan-400/25 text-cyan-100 hover:bg-cyan-500/15"
                  )}
                >
                  {legit === "loading" ? (
                    "Checking…"
                  ) : legit === "ok" ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      Legit
                    </>
                  ) : legit === "fail" ? (
                    "Failed"
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" />
                      </svg>
                      Legit Check
                    </>
                  )}
                </button>
              </div>

              {legitMsg && (
                <p
                  className={cn(
                    "text-[11px] text-center rounded-xl px-3 py-2 border",
                    legit === "ok"
                      ? "text-emerald-200/90 bg-emerald-500/10 border-emerald-500/20"
                      : "text-red-200/90 bg-red-500/10 border-red-500/20"
                  )}
                >
                  {legitMsg}
                </p>
              )}

              {/* Winner */}
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
                Bank {formatGram(data.bank)} GRAM
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

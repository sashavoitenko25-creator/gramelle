"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface VerifyModalProps {
  open: boolean;
  onClose: () => void;
  initialRollId?: number | null;
}

interface VerifyResponse {
  ok: boolean;
  rollId: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  computedHash: string;
  hashMatches: boolean;
  roll: number;
  total: number;
  houseFee: number;
  potAfterFee: number;
  claimedWinnerTelegramId: number;
  computedWinner: {
    telegramId: number;
    username: string;
    amount: number;
  } | null;
  winnerMatches: boolean;
  bets: Array<{
    telegramId: number;
    username: string;
    amount: number;
  }>;
  error?: string;
}

export function VerifyModal({ open, onClose, initialRollId }: VerifyModalProps) {
  const [rollId, setRollId] = useState(
    initialRollId != null ? String(initialRollId) : ""
  );

  useEffect(() => {
    if (open && initialRollId != null) {
      setRollId(String(initialRollId));
      setResult(null);
      setError(null);
    }
  }, [open, initialRollId]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const run = async () => {
    const id = Number(rollId);
    if (!Number.isFinite(id)) {
      setError("Enter a valid roll ID");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<VerifyResponse>(
        `/api/verify?rollId=${id}`,
        { method: "GET" }
      );
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 slide-up border-t border-white/10 safe-bottom max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold tracking-tight">
            Provably Fair
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/40"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Recompute the winner from published server seed + bets. Hash must
          match the commitment shown before the spin.
        </p>

        <label className="text-[11px] text-white/40 uppercase tracking-wider">
          Roll ID
        </label>
        <div className="flex gap-2 mt-1 mb-4">
          <input
            type="number"
            value={rollId}
            onChange={(e) => setRollId(e.target.value)}
            placeholder="e.g. 1006"
            className="flex-1 h-11 rounded-2xl bg-black/35 border border-white/[0.08] px-4 text-sm outline-none focus:border-cyan-500/35 tabular-nums"
          />
          <button
            onClick={run}
            disabled={loading}
            className="h-11 px-4 rounded-2xl btn-primary text-sm btn-press disabled:opacity-40"
          >
            {loading ? "…" : "Verify"}
          </button>
        </div>

        {error && (
          <div className="mb-3 text-xs text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3 text-xs">
            <div
              className={`rounded-xl px-3 py-2.5 border ${
                result.ok
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-200"
                  : "bg-red-500/10 border-red-500/25 text-red-200"
              }`}
            >
              {result.ok
                ? "✓ Round is fair — hash & winner match"
                : "✗ Verification failed"}
            </div>

            <Row label="Hash match" value={result.hashMatches ? "yes" : "no"} />
            <Row
              label="Winner match"
              value={result.winnerMatches ? "yes" : "no"}
            />
            <Row
              label="Winner"
              value={
                result.computedWinner
                  ? `@${result.computedWinner.username} (${result.computedWinner.amount} GRAM)`
                  : "—"
              }
            />
            <Row label="Bank" value={`${result.total} GRAM`} />
            
            <Row label="Pot after fee" value={`${result.potAfterFee} GRAM`} />
            <Row label="Roll (0–1)" value={result.roll.toFixed(8)} />

            <div className="pt-1">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Server seed
              </div>
              <code className="block text-[10px] text-white/50 break-all font-mono bg-black/30 rounded-lg p-2">
                {result.serverSeed}
              </code>
            </div>
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Committed hash
              </div>
              <code className="block text-[10px] text-white/50 break-all font-mono bg-black/30 rounded-lg p-2">
                {result.serverSeedHash}
              </code>
            </div>
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                SHA256(seed)
              </div>
              <code className="block text-[10px] text-white/50 break-all font-mono bg-black/30 rounded-lg p-2">
                {result.computedHash}
              </code>
            </div>

            {result.bets?.length > 0 && (
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">
                  Bets
                </div>
                <div className="space-y-1">
                  {result.bets.map((b) => (
                    <div
                      key={b.telegramId}
                      className="flex justify-between text-[11px] text-white/55 px-1"
                    >
                      <span>@{b.username}</span>
                      <span className="tabular-nums">{b.amount} GRAM</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-white/55">
      <span className="text-white/35">{label}</span>
      <span className="text-right text-white/75 tabular-nums">{value}</span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface FairnessScreenProps {
  onBack: () => void;
  initialHash?: string;
  initialSeed?: string;
}

export function FairnessScreen({
  onBack,
  initialHash = "",
  initialSeed = "",
}: FairnessScreenProps) {
  const { lang } = useI18n();
  const [seed, setSeed] = useState(initialSeed);
  const [hash, setHash] = useState(initialHash);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"ok" | "fail" | null>(null);
  const [computed, setComputed] = useState<string | null>(null);

  useEffect(() => {
    setSeed(initialSeed || "");
    setHash(initialHash || "");
    setResult(null);
    setComputed(null);
  }, [initialSeed, initialHash]);

  const verify = async () => {
    const s = seed.trim();
    const h = hash.trim().toLowerCase();
    if (!s || !h) {
      setResult(null);
      setComputed(null);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const dig = await sha256Hex(s);
      setComputed(dig);
      setResult(dig === h ? "ok" : "fail");
    } catch {
      setResult("fail");
      setComputed(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-4 pt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/70 btn-press"
        >
          ←
        </button>
        <div>
          <div className="text-base font-semibold">
            {lang === "ru" ? "Проверка честности" : "Fairness check"}
          </div>
          <div className="text-[11px] text-white/35">SHA-256 · seed ↔ hash</div>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <p className="text-[12px] text-white/45 leading-relaxed">
          {lang === "ru"
            ? "До игры публикуется hash. После — seed. Если SHA-256(seed) совпадает с hash — значение не меняли."
            : "Before the game the hash is published. After — the seed. If SHA-256(seed) matches the hash, the value was not changed."}
        </p>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5 block">
              Hash
            </label>
            <input
              value={hash}
              onChange={(e) => {
                setHash(e.target.value);
                setResult(null);
              }}
              placeholder="sha256…"
              className="w-full h-11 rounded-xl bg-black/30 border border-white/10 px-3 text-[12px] font-mono outline-none focus:border-cyan-500/40"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5 block">
              Seed
            </label>
            <input
              value={seed}
              onChange={(e) => {
                setSeed(e.target.value);
                setResult(null);
              }}
              placeholder="seed…"
              className="w-full h-11 rounded-xl bg-black/30 border border-white/10 px-3 text-[12px] font-mono outline-none focus:border-cyan-500/40"
            />
          </div>
          <button
            type="button"
            disabled={loading || !seed.trim() || !hash.trim()}
            onClick={verify}
            className="w-full h-12 rounded-xl btn-primary text-sm font-medium btn-press disabled:opacity-40"
          >
            {loading
              ? "…"
              : lang === "ru"
                ? "Проверить"
                : "Verify"}
          </button>
        </div>

        {result && (
          <div
            className={`rounded-2xl border px-4 py-3 ${
              result === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-rose-500/30 bg-rose-500/10"
            }`}
          >
            <div
              className={`text-sm font-semibold ${
                result === "ok" ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {result === "ok"
                ? lang === "ru"
                  ? "✓ Честно — hash совпадает"
                  : "✓ Fair — hash matches"
                : lang === "ru"
                  ? "✗ Не совпадает"
                  : "✗ Mismatch"}
            </div>
            {computed && (
              <div className="mt-2 text-[10px] font-mono text-white/35 break-all">
                SHA-256(seed) = {computed}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

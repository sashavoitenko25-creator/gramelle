"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useTelegram } from "@/hooks/useTelegram";

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
  const { setBackButton } = useTelegram();
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

  // Telegram BackButton instead of in-UI back
  useEffect(() => {
    setBackButton(() => {
      onBack();
    });
    return () => setBackButton(null);
  }, [onBack, setBackButton]);

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

  const isRu = lang === "ru";

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-4 pt-3 flex items-center gap-3">
        <div>
          <div className="text-base font-semibold">
            {isRu ? "Проверка честности" : "Fairness check"}
          </div>
          <div className="text-[11px] text-white/35">
            {isRu ? "Проверь любой раунд сам" : "Verify any round yourself"}
          </div>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-2.5">
          <p className="text-[13px] text-white/70 leading-relaxed font-medium">
            {isRu ? "Как это работает — просто:" : "How it works — simply:"}
          </p>
          <ol className="text-[12px] text-white/50 leading-relaxed space-y-2 list-decimal pl-4">
            {isRu ? (
              <>
                <li>
                  До игры показывается <span className="text-white/80">Hash</span> — это «отпечаток» секрета. Сам секрет ещё скрыт.
                </li>
                <li>
                  После игры открывается <span className="text-white/80">Seed</span> (секрет).
                </li>
                <li>
                  Вставь оба значения ниже и нажми «Проверить». Если всё совпало — результат не подкручивали.
                </li>
              </>
            ) : (
              <>
                <li>
                  Before the game you see a <span className="text-white/80">Hash</span> — a fingerprint of a secret. The secret itself stays hidden.
                </li>
                <li>
                  After the game the <span className="text-white/80">Seed</span> (secret) is revealed.
                </li>
                <li>
                  Paste both below and tap Verify. If they match — the result was not changed after the fact.
                </li>
              </>
            )}
          </ol>
          <p className="text-[11px] text-white/35 leading-relaxed pt-1">
            {isRu
              ? "Hash и Seed копируются из завершённой партии (кнопка «Проверить честность»)."
              : "Copy Hash and Seed from a finished game (Verify fairness)."}
          </p>
        </div>

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
            {loading ? "…" : isRu ? "Проверить" : "Verify"}
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
                ? isRu
                  ? "✓ Всё честно — совпадает"
                  : "✓ Fair — matches"
                : isRu
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

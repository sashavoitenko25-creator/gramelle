"use client";

import { useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useI18n } from "@/lib/i18n/context";

interface ModeSoonScreenProps {
  mode: "live" | "solo";
  onBack: () => void;
}

export function ModeSoonScreen({ mode, onBack }: ModeSoonScreenProps) {
  const { lang } = useI18n();
  const { setBackButton } = useTelegram();
  const tr = (en: string, ru: string) => (lang === "ru" ? ru : en);

  useEffect(() => {
    setBackButton(() => onBack());
    return () => setBackButton(null);
  }, [onBack, setBackButton]);

  const isLive = mode === "live";
  const title = isLive ? "LIVE" : "SOLO";
  const emoji = isLive ? "📡" : "🎯";
  const blurb = isLive
    ? tr(
        "Live rooms with shared prize pools and real-time drops. We're polishing the experience.",
        "Лайв-комнаты с общими призовыми и дропами в реальном времени. Сейчас доводим опыт."
      )
    : tr(
        "Solo modes against the house — fair, fast, and on-chain ready. Launching soon.",
        "Соло-режимы против дома — честно, быстро и готово к ончейну. Скоро запуск."
      );
  const gradient = isLive
    ? "from-[#0f766e] via-[#0e7490] to-[#1d4ed8]"
    : "from-[#9d174d] via-[#7c3aed] to-[#312e81]";

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60"
        >
          ‹
        </button>
        <div className="text-[15px] font-semibold">{title}</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
        <div
          className={`relative w-full max-w-[340px] overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br ${gradient} p-8 text-center shadow-[0_25px_60px_rgba(0,0,0,0.45)]`}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-white/15 border border-white/20 flex items-center justify-center text-4xl backdrop-blur-md shadow-lg">
              {emoji}
            </div>
            <div className="mt-5 text-[28px] font-black tracking-tight text-white">
              {title}
            </div>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-100 text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
              {tr("In development", "В разработке")}
            </div>
            <p className="mt-4 text-[14px] text-white/75 leading-relaxed">
              {blurb}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-[10px] text-white/50">
              <div className="rounded-xl bg-black/25 border border-white/10 py-2.5">
                {tr("Fair play", "Честная игра")}
              </div>
              <div className="rounded-xl bg-black/25 border border-white/10 py-2.5">
                TON
              </div>
              <div className="rounded-xl bg-black/25 border border-white/10 py-2.5">
                {tr("Soon", "Скоро")}
              </div>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="mt-7 w-full h-12 rounded-2xl bg-white/15 border border-white/20 text-sm font-semibold text-white btn-press backdrop-blur-sm"
            >
              {tr("Back to Play", "Назад в Play")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

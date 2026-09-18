"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useTelegram } from "@/hooks/useTelegram";

interface LiveHubScreenProps {
  onSelectRoulette: () => void;
  onSelectPvpRoulette?: () => void;
  onBack?: () => void;
  liveOnline?: number;
}

/** Roulette wheel art for the Roulette game card */
function RouletteArt() {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="rhRing" x1="20" y1="20" x2="100" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="0.45" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="rhR" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fb7185" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="rhG" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="rhB" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#94a3b8" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
        <filter id="rhGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="rhCore" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#67e8f9" stopOpacity="0.75" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="78" rx="36" ry="5.5" fill="#34d399" fillOpacity="0.22" />
      <g filter="url(#rhGlow)">
        <circle cx="60" cy="44" r="30" stroke="url(#rhRing)" strokeWidth="3.2" fill="#0a1628" fillOpacity="0.55" />
        <circle cx="60" cy="44" r="24" stroke="#fff" strokeOpacity="0.12" strokeWidth="1" fill="none" />
      </g>
      <g transform="translate(60 44)" filter="url(#rhGlow)">
        <path d="M0 0 L0 -20 A20 20 0 0 1 17.3 -10 Z" fill="url(#rhR)" opacity="0.95" />
        <path d="M0 0 L17.3 -10 A20 20 0 0 1 17.3 10 Z" fill="url(#rhB)" opacity="0.95" />
        <path d="M0 0 L17.3 10 A20 20 0 0 1 0 20 Z" fill="url(#rhR)" opacity="0.9" />
        <path d="M0 0 L0 20 A20 20 0 0 1 -17.3 10 Z" fill="url(#rhB)" opacity="0.9" />
        <path d="M0 0 L-17.3 10 A20 20 0 0 1 -17.3 -10 Z" fill="url(#rhG)" opacity="0.95" />
        <path d="M0 0 L-17.3 -10 A20 20 0 0 1 0 -20 Z" fill="url(#rhB)" opacity="0.9" />
      </g>
      <circle cx="60" cy="44" r="8" fill="url(#rhCore)" filter="url(#rhGlow)" />
      <circle cx="60" cy="44" r="3.2" fill="#fff" />
      {/* pointer ▼ tip down into the wheel */}
      <g filter="url(#rhGlow)">
        <path d="M52 14 L68 14 L60 26 Z" fill="#67e8f9" />
      </g>
    </svg>
  );
}

export function LiveHubScreen({
  onSelectRoulette,
  onSelectPvpRoulette,
  onBack,
  liveOnline = 0,
}: LiveHubScreenProps) {
  const { lang } = useI18n();
  const isRu = lang === "ru";
  const { setBackButton } = useTelegram();
  const tr = (en: string, ru: string) => (isRu ? ru : en);

  useEffect(() => {
    if (!onBack) return;
    setBackButton(() => onBack());
    return () => setBackButton(null);
  }, [onBack, setBackButton]);

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-5 pt-2 pb-6">
        <h1 className="text-center text-[30px] font-bold tracking-tight text-white leading-none">
          LIVE
        </h1>
        <p className="text-center text-[13px] text-white/40 mt-2">
          {tr("Pick a live game", "Выбери live-игру")}
        </p>
      </div>

      <div className="px-4 flex flex-col gap-4">
        <button
          type="button"
          onClick={onSelectRoulette}
          className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#0f766e] to-[#0e7490]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_20%,rgba(52,211,153,0.45),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_0%,rgba(34,211,238,0.35),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_90%,rgba(167,139,250,0.25),transparent_50%)]" />

          <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              {liveOnline > 0 ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/35" />
              )}
            </span>
            <span className="text-[11px] font-semibold text-white/90 tabular-nums">
              {tr("Online", "Онлайн")} : {liveOnline > 99 ? "99+" : liveOnline}
            </span>
          </div>

          <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="opacity-95 group-hover:scale-[1.04] transition-transform duration-300 -ml-1 -mt-1">
                <RouletteArt />
              </div>
            </div>
            <div>
              <div className="text-[22px] font-black tracking-tight text-white">
                {tr("Roulette", "Рулетка")}
              </div>
              <p className="mt-1 text-[13px] text-white/70 leading-snug max-w-[95%]">
                {tr("Red · Black · Green", "Красное · Чёрное · Зелёное")}
              </p>
            </div>
          </div>
        </button>

        {onSelectPvpRoulette && (
          <button
            type="button"
            onClick={onSelectPvpRoulette}
            className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] via-[#4c1d95] to-[#831843]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_20%,rgba(167,139,250,0.45),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_0%,rgba(244,114,182,0.3),transparent_50%)]" />
            <div className="relative p-5 min-h-[148px] flex flex-col justify-end">
              <div className="text-[22px] font-black tracking-tight text-white">
                {tr("PvP Roulette", "PvP Рулетка")}
              </div>
              <p className="mt-1 text-[13px] text-white/70">
                {tr(
                  "Player avatars · winner takes the bank −5%",
                  "Аватарки игроков · победитель забирает банк −5%"
                )}
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useI18n } from "@/lib/i18n/context";

interface PlayHubScreenProps {
  onSelectPvp: () => void;
  onSelectLive?: () => void;
  onSelectSolo?: () => void;
}

function IconPvp() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6" />
      <path d="M16 16l4 4" />
      <path d="M19 21l2-2" />
      <path d="M9.5 6.5L21 18v3h-3L6.5 9.5" />
      <path d="M11 5L5 11" />
      <path d="M8 8L4 4" />
      <path d="M5 3L3 5" />
    </svg>
  );
}

function IconLive() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M16.24 7.76a6 6 0 010 8.49" />
      <path d="M7.76 16.24a6 6 0 010-8.49" />
      <path d="M19.07 4.93a10 10 0 010 14.14" />
      <path d="M4.93 19.07a10 10 0 010-14.14" />
    </svg>
  );
}

function IconSolo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PlayHubScreen({ onSelectPvp }: PlayHubScreenProps) {
  const { lang } = useI18n();
  const tr = (en: string, ru: string) => (lang === "ru" ? ru : en);

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-5 pt-2 pb-6">
        <h1 className="text-center text-[30px] font-bold tracking-tight text-white leading-none">
          {tr("Play", "Играть")}
        </h1>
        <p className="text-center text-[13px] text-white/40 mt-2">
          {tr("Choose a mode", "Выбери режим")}
        </p>
      </div>

      <div className="px-4 flex flex-col gap-4">
        {/* PVP — same card language as GamesScreen */}
        <button
          type="button"
          onClick={onSelectPvp}
          className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#6b21a8] via-[#4f46e5] to-[#0e7490]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_20%,rgba(167,139,250,0.45),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_95%_5%,rgba(34,211,238,0.35),transparent_45%)]" />
          <div className="absolute bottom-[-35%] right-[-10%] w-[60%] h-[70%] rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="relative p-5 min-h-[148px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-[52px] h-[52px] rounded-2xl bg-white/[0.14] border border-white/25 backdrop-blur-md flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.4)] -rotate-6 group-hover:rotate-0 transition-transform duration-300 text-white">
                <IconPvp />
              </div>
            </div>
            <div>
              <div className="text-[22px] font-black tracking-tight text-white">
                PVP
              </div>
              <p className="mt-1 text-[13px] text-white/70 leading-snug max-w-[85%]">
                {tr(
                  "Challenge players · RPS, Dice, XO",
                  "Играй с людьми · КНБ, Кости, XO"
                )}
              </p>
            </div>
          </div>
        </button>

        {/* LIVE — not clickable */}
        <div
          className="relative overflow-hidden rounded-[28px] text-left opacity-90 pointer-events-none select-none"
          aria-disabled="true"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#0e7490]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_20%,rgba(52,211,153,0.35),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_0%,rgba(34,211,238,0.28),transparent_50%)]" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute top-3.5 right-3.5 z-20 px-2.5 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
              {tr("Soon", "Скоро")}
            </span>
          </div>
          <div className="relative p-5 min-h-[132px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-[52px] h-[52px] rounded-2xl bg-white/[0.12] border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.35)] text-white/85">
                <IconLive />
              </div>
            </div>
            <div>
              <div className="text-[22px] font-black tracking-tight text-white/90">
                LIVE
              </div>
            </div>
          </div>
        </div>

        {/* SOLO — not clickable */}
        <div
          className="relative overflow-hidden rounded-[28px] text-left opacity-90 pointer-events-none select-none"
          aria-disabled="true"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#7c2d12] via-[#9d174d] to-[#6b21a8]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_15%,rgba(251,146,60,0.35),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_0%,rgba(244,114,182,0.3),transparent_50%)]" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute top-3.5 right-3.5 z-20 px-2.5 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
              {tr("Soon", "Скоро")}
            </span>
          </div>
          <div className="relative p-5 min-h-[132px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-[52px] h-[52px] rounded-2xl bg-white/[0.12] border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.35)] text-white/85">
                <IconSolo />
              </div>
            </div>
            <div>
              <div className="text-[22px] font-black tracking-tight text-white/90">
                SOLO
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

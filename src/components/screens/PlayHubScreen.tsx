"use client";

import { useI18n } from "@/lib/i18n/context";

interface PlayHubScreenProps {
  onSelectPvp: () => void;
  onSelectLive: () => void;
  onSelectSolo: () => void;
}

export function PlayHubScreen({
  onSelectPvp,
  onSelectLive,
  onSelectSolo,
}: PlayHubScreenProps) {
  const { lang } = useI18n();
  const tr = (en: string, ru: string) => (lang === "ru" ? ru : en);

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-5 pt-3 pb-2">
        <h1 className="text-[22px] font-bold tracking-tight text-white">
          {tr("Play", "Играть")}
        </h1>
        <p className="text-[13px] text-white/40 mt-1">
          {tr("Choose a mode", "Выбери режим")}
        </p>
      </div>

      <div className="px-4 mt-3 space-y-3.5">
        {/* PVP */}
        <button
          type="button"
          onClick={onSelectPvp}
          className="group relative w-full overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.985] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed] via-[#4f46e5] to-[#0ea5e9]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_10%_20%,rgba(255,255,255,0.22),transparent_55%)]" />
          <div className="absolute -right-6 -bottom-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative px-5 py-6 flex items-center gap-4 min-h-[112px]">
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-2xl shadow-lg backdrop-blur-sm">
              ⚔️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[20px] font-black tracking-wide text-white">
                  PVP
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/25 text-emerald-100 border border-emerald-300/30">
                  Live
                </span>
              </div>
              <p className="mt-1 text-[13px] text-white/75 leading-snug">
                {tr(
                  "Challenge players · RPS, Dice, XO",
                  "Играй с людьми · КНБ, Кости, XO"
                )}
              </p>
            </div>
            <div className="text-white/50 text-xl group-hover:text-white/80 transition-colors">
              ›
            </div>
          </div>
        </button>

        {/* LIVE */}
        <button
          type="button"
          onClick={onSelectLive}
          className="group relative w-full overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.985] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f766e] via-[#0e7490] to-[#1d4ed8]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_90%_10%,rgba(34,211,238,0.35),transparent_50%)]" />
          <div className="absolute inset-0 bg-black/25" />
          <div className="relative px-5 py-6 flex items-center gap-4 min-h-[112px]">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-2xl backdrop-blur-sm">
              📡
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[20px] font-black tracking-wide text-white">
                  LIVE
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-100 border border-amber-300/30">
                  {tr("In development", "В разработке")}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-white/65 leading-snug">
                {tr(
                  "Live drops & shared pots — coming soon",
                  "Лайв-дропы и общие банки — скоро"
                )}
              </p>
            </div>
            <div className="text-white/40 text-xl">›</div>
          </div>
        </button>

        {/* SOLO */}
        <button
          type="button"
          onClick={onSelectSolo}
          className="group relative w-full overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.985] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#9d174d] via-[#7c3aed] to-[#312e81]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_15%_90%,rgba(244,114,182,0.3),transparent_55%)]" />
          <div className="absolute inset-0 bg-black/25" />
          <div className="relative px-5 py-6 flex items-center gap-4 min-h-[112px]">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-2xl backdrop-blur-sm">
              🎯
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[20px] font-black tracking-wide text-white">
                  SOLO
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-100 border border-amber-300/30">
                  {tr("In development", "В разработке")}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-white/65 leading-snug">
                {tr(
                  "Play alone against the house — coming soon",
                  "Играй один против дома — скоро"
                )}
              </p>
            </div>
            <div className="text-white/40 text-xl">›</div>
          </div>
        </button>
      </div>
    </div>
  );
}

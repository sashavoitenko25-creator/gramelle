"use client";

import { useI18n } from "@/lib/i18n/context";

interface PlayHubScreenProps {
  onSelectPvp: () => void;
  onSelectLive?: () => void;
  onSelectSolo?: () => void;
  pvpOnline?: number;
  rpsOnline?: number;
  diceOnline?: number;
  xoOnline?: number;
  liveOnline?: number;
}

/** Colorful multiplayer duel illustration — crossed energy blades + dual avatars */
function PvpArt() {
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
        <linearGradient id="pvpBladeA" x1="8" y1="72" x2="56" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id="pvpBladeB" x1="112" y1="72" x2="64" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f472b6" />
          <stop offset="0.5" stopColor="#c084fc" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="pvpCore" x1="48" y1="28" x2="72" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#a5f3fc" />
        </linearGradient>
        <filter id="pvpGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="pvpOrb" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#67e8f9" stopOpacity="0.7" />
          <stop offset="1" stopColor="#818cf8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft ground glow */}
      <ellipse cx="60" cy="78" rx="38" ry="6" fill="#a78bfa" fillOpacity="0.25" />

      {/* left blade */}
      <g filter="url(#pvpGlow)">
        <path
          d="M18 70 L52 22"
          stroke="url(#pvpBladeA)"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path
          d="M18 70 L52 22"
          stroke="#e0f2fe"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* hilt left */}
        <rect x="12" y="66" width="14" height="6" rx="2" fill="#1e1b4b" stroke="#c4b5fd" strokeWidth="1" transform="rotate(-42 19 69)" />
      </g>

      {/* right blade */}
      <g filter="url(#pvpGlow)">
        <path
          d="M102 70 L68 22"
          stroke="url(#pvpBladeB)"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path
          d="M102 70 L68 22"
          stroke="#fce7f3"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.85"
        />
        <rect x="94" y="66" width="14" height="6" rx="2" fill="#1e1b4b" stroke="#f9a8d4" strokeWidth="1" transform="rotate(42 101 69)" />
      </g>

      {/* clash spark at center */}
      <circle cx="60" cy="34" r="10" fill="url(#pvpOrb)" />
      <circle cx="60" cy="34" r="3.2" fill="#fff" />
      <path d="M60 22 L61.2 30.5 L68 28 L62.2 34 L70 38 L61.5 37 L60 46 L58.5 37 L50 38 L57.8 34 L52 28 L58.8 30.5 Z" fill="url(#pvpCore)" opacity="0.95" filter="url(#pvpGlow)" />

      {/* player orbs L / R */}
      <g filter="url(#pvpGlow)">
        <circle cx="28" cy="58" r="11" fill="#312e81" stroke="#67e8f9" strokeWidth="1.8" />
        <circle cx="28" cy="55.5" r="4" fill="#a5f3fc" opacity="0.9" />
        <path d="M20 65.5c2.2-4 13.8-4 16 0" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </g>
      <g filter="url(#pvpGlow)">
        <circle cx="92" cy="58" r="11" fill="#4c1d95" stroke="#f9a8d4" strokeWidth="1.8" />
        <circle cx="92" cy="55.5" r="4" fill="#fbcfe8" opacity="0.9" />
        <path d="M84 65.5c2.2-4 13.8-4 16 0" stroke="#f9a8d4" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

/** LIVE hub art — neon arena / shared screen energy */
function LiveArt() {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_10px_24px_rgba(0,0,0,0.4)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="lvScreen" x1="24" y1="18" x2="96" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#042f2e" />
          <stop offset="0.4" stopColor="#0f766e" />
          <stop offset="1" stopColor="#164e63" />
        </linearGradient>
        <linearGradient id="lvBezel" x1="20" y1="14" x2="100" y2="74" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5eead4" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="lvBar" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <filter id="lvG" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="lvBloom" cx="0.5" cy="0.35" r="0.55">
          <stop stopColor="#5eead4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="60" cy="80" rx="40" ry="5" fill="#2dd4bf" fillOpacity="0.18" />

      {/* screen glow behind */}
      <ellipse cx="60" cy="44" rx="42" ry="28" fill="url(#lvBloom)" />

      {/* device / shared screen */}
      <g filter="url(#lvG)">
        <rect x="22" y="16" width="76" height="52" rx="10" fill="#020617" stroke="url(#lvBezel)" strokeWidth="2.2" />
        <rect x="28" y="22" width="64" height="36" rx="6" fill="url(#lvScreen)" />
        {/* scan lines */}
        <path d="M30 30 H90" stroke="#5eead4" strokeOpacity="0.15" strokeWidth="1" />
        <path d="M30 38 H90" stroke="#67e8f9" strokeOpacity="0.12" strokeWidth="1" />
        <path d="M30 46 H90" stroke="#a78bfa" strokeOpacity="0.12" strokeWidth="1" />
        {/* live bars */}
        <rect x="36" y="40" width="6" height="12" rx="1.5" fill="url(#lvBar)" opacity="0.95" />
        <rect x="46" y="34" width="6" height="18" rx="1.5" fill="#22d3ee" opacity="0.9" />
        <rect x="56" y="28" width="6" height="24" rx="1.5" fill="#a78bfa" opacity="0.95" />
        <rect x="66" y="36" width="6" height="16" rx="1.5" fill="#34d399" opacity="0.9" />
        <rect x="76" y="32" width="6" height="20" rx="1.5" fill="#67e8f9" opacity="0.9" />
        {/* live pill on screen */}
        <rect x="34" y="26" width="22" height="8" rx="4" fill="#064e3b" stroke="#34d399" strokeWidth="1" />
        <circle cx="39" cy="30" r="2" fill="#4ade80" />
        <path d="M44 28.5 H52" stroke="#6ee7b7" strokeWidth="1.2" strokeLinecap="round" />
      </g>

      {/* viewers around screen */}
      <g filter="url(#lvG)">
        <circle cx="18" cy="48" r="8" fill="#134e4a" stroke="#5eead4" strokeWidth="1.5" />
        <circle cx="18" cy="46" r="3" fill="#ccfbf1" />
        <circle cx="102" cy="48" r="8" fill="#1e3a5f" stroke="#67e8f9" strokeWidth="1.5" />
        <circle cx="102" cy="46" r="3" fill="#e0f2fe" />
        <circle cx="32" cy="68" r="7" fill="#4c1d95" stroke="#c4b5fd" strokeWidth="1.4" />
        <circle cx="32" cy="66.2" r="2.6" fill="#ede9fe" />
        <circle cx="88" cy="68" r="7" fill="#9f1239" stroke="#fda4af" strokeWidth="1.4" />
        <circle cx="88" cy="66.2" r="2.6" fill="#ffe4e6" />
      </g>
    </svg>
  );
}

function IconLive() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" opacity="0.5" />
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

export function PlayHubScreen({
  onSelectPvp,
  onSelectLive,
  pvpOnline,
  rpsOnline = 0,
  diceOnline = 0,
  xoOnline = 0,
  liveOnline = 0,
}: PlayHubScreenProps) {
  const { t, lang } = useI18n();
  const tr = (en: string, ru: string) => (lang === "ru" ? ru : en);

  const online =
    pvpOnline != null
      ? pvpOnline
      : Math.max(0, (rpsOnline || 0) + (diceOnline || 0) + (xoOnline || 0));

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
        {/* PVP */}
        <button
          type="button"
          onClick={onSelectPvp}
          className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#6b21a8] via-[#4f46e5] to-[#0e7490]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_20%,rgba(167,139,250,0.45),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_95%_5%,rgba(34,211,238,0.35),transparent_45%)]" />
          <div className="absolute bottom-[-35%] right-[-10%] w-[60%] h-[70%] rounded-full bg-cyan-400/15 blur-3xl" />

          {/* online badge — same language as PVP game cards */}
          <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              {online > 0 ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/35" />
              )}
            </span>
            <span className="text-[11px] font-semibold text-white/90 tabular-nums">
              {t("online").charAt(0).toUpperCase() + t("online").slice(1)}{" "}
              {online > 99 ? "99+" : online}
            </span>
          </div>

          <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2 pr-24">
              <div className="relative -ml-1 -mt-1 scale-[0.92] origin-top-left group-hover:scale-100 transition-transform duration-300">
                <PvpArt />
              </div>
            </div>
            <div>
              <div className="text-[22px] font-black tracking-tight text-white">
                PVP
              </div>
              <p className="mt-1 text-[13px] text-white/70 leading-snug max-w-[90%]">
                {tr(
                  "Play against people · RPS, Dice, XO",
                  "Играй против людей · КНБ, Кости, XO"
                )}
              </p>
            </div>
          </div>
        </button>

        {/* LIVE */}
        <button
          type="button"
          onClick={() => onSelectLive?.()}
          className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#0f766e] to-[#0e7490]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_20%,rgba(52,211,153,0.45),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_0%,rgba(34,211,238,0.35),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_90%,rgba(167,139,250,0.25),transparent_50%)]" />

          <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[11px] font-semibold text-white/90 tabular-nums">
              {tr("Online", "Онлайн")} : {liveOnline > 99 ? "99+" : liveOnline}
            </span>
          </div>

          <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="opacity-95 group-hover:scale-[1.04] transition-transform duration-300 -ml-1 -mt-1">
                <LiveArt />
              </div>
            </div>
            <div>
              <div className="text-[22px] font-black tracking-tight text-white">
                LIVE
              </div>
              <p className="mt-1 text-[13px] text-white/70 leading-snug max-w-[95%]">
                {tr(
                  "Play together in real time",
                  "Играйте вместе в реальном времени"
                )}
              </p>
            </div>
          </div>
        </button>

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

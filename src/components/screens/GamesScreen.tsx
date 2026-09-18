"use client";

import { ChoiceIcon } from "@/components/rps/RpsIcons";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useTelegram } from "@/hooks/useTelegram";

interface GamesScreenProps {
  onSelectRps: () => void;
  onSelectDice: () => void;
  onSelectXo?: () => void;
  onSelectPvpRoulette?: () => void;
  onBack?: () => void;
  rpsOnline?: number;
  diceOnline?: number;
  xoOnline?: number;
  pvpRouletteOnline?: number;
}


/** Premium glass reel art — PvP Roulette card */
function PvpRouletteCardArt() {
  return (
    <svg
      width="148"
      height="88"
      viewBox="0 0 148 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_16px_32px_rgba(0,0,0,0.4)] group-hover:scale-[1.03] transition-transform duration-500 ease-out"
      aria-hidden
    >
      <defs>
        <linearGradient id="prGlass" x1="12" y1="20" x2="136" y2="72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="prEdge" x1="16" y1="28" x2="132" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e9d5ff" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="0.7" stopColor="#67e8f9" stopOpacity="0.9" />
          <stop offset="1" stopColor="#c4b5fd" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="prInner" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#1a1030" stopOpacity="0.92" />
          <stop offset="1" stopColor="#0c0818" stopOpacity="0.98" />
        </linearGradient>
        <linearGradient id="prV" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ddd6fe" />
          <stop offset="0.45" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
        <linearGradient id="prP" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fbcfe8" />
          <stop offset="0.45" stopColor="#ec4899" />
          <stop offset="1" stopColor="#9d174d" />
        </linearGradient>
        <linearGradient id="prG" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fef3c7" />
          <stop offset="0.4" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="prC" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#cffafe" />
          <stop offset="0.45" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#0e7490" />
        </linearGradient>
        <linearGradient id="prE" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d1fae5" />
          <stop offset="0.45" stopColor="#34d399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <radialGradient id="prSpot" cx="0.35" cy="0.25" r="0.7">
          <stop stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="prGoldHalo" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#fbbf24" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <filter id="prD" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="prSoftBlur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <clipPath id="prClip">
          <rect x="22" y="30" width="104" height="36" rx="18" />
        </clipPath>
      </defs>

      {/* ambient */}
      <ellipse cx="74" cy="78" rx="48" ry="7" fill="#8b5cf6" fillOpacity="0.2" />
      <ellipse cx="74" cy="48" rx="56" ry="28" fill="#fbbf24" fillOpacity="0.06" filter="url(#prSoftBlur)" />

      {/* glass capsule shell */}
      <rect
        x="18"
        y="26"
        width="112"
        height="44"
        rx="22"
        fill="url(#prInner)"
        stroke="url(#prEdge)"
        strokeWidth="1.5"
        filter="url(#prD)"
      />
      {/* inner glass sheen */}
      <rect
        x="22"
        y="30"
        width="104"
        height="36"
        rx="18"
        fill="url(#prGlass)"
      />

      {/* avatars clipped in reel */}
      <g clipPath="url(#prClip)" filter="url(#prD)">
        {/* side fade avatars slightly smaller / dimmer */}
        <g opacity="0.55" transform="translate(0 2)">
          <circle cx="28" cy="46" r="11" fill="url(#prV)" />
          <circle cx="120" cy="46" r="11" fill="url(#prE)" />
        </g>
        <circle cx="48" cy="48" r="13" fill="url(#prP)" />
        {/* winner — larger + halo */}
        <circle cx="74" cy="48" r="18" fill="url(#prGoldHalo)" />
        <circle cx="74" cy="48" r="14.5" fill="url(#prG)" />
        <circle cx="100" cy="48" r="13" fill="url(#prC)" />

        {/* specular on orbs */}
        <ellipse cx="43" cy="43" rx="5" ry="3.2" fill="url(#prSpot)" />
        <ellipse cx="69" cy="42" rx="6" ry="3.8" fill="url(#prSpot)" />
        <ellipse cx="95" cy="43" rx="5" ry="3.2" fill="url(#prSpot)" />
      </g>

      {/* winner ring */}
      <circle
        cx="74"
        cy="48"
        r="15.5"
        stroke="#fde68a"
        strokeOpacity="0.95"
        strokeWidth="1.8"
        fill="none"
        filter="url(#prD)"
      />
      <circle
        cx="74"
        cy="48"
        r="17.2"
        stroke="#fbbf24"
        strokeOpacity="0.25"
        strokeWidth="3"
        fill="none"
      />

      {/* top pointer — gold chevron seated on glass */}
      <g filter="url(#prD)">
        <path
          d="M66 18 L82 18 L74 30 Z"
          fill="#fbbf24"
        />
        <path
          d="M68.5 18.5 L79.5 18.5 L74 27 Z"
          fill="#fef3c7"
          opacity="0.55"
        />
      </g>

      {/* bottom pointer */}
      <g filter="url(#prD)">
        <path
          d="M66 78 L82 78 L74 66 Z"
          fill="#67e8f9"
          opacity="0.9"
        />
      </g>

      {/* thin center line */}
      <line
        x1="74"
        y1="30"
        x2="74"
        y2="66"
        stroke="#ffffff"
        strokeOpacity="0.12"
        strokeWidth="1"
      />

      {/* micro sparkles */}
      <circle cx="30" cy="20" r="1.2" fill="#fff" fillOpacity="0.55" />
      <circle cx="124" cy="24" r="1" fill="#fde68a" fillOpacity="0.7" />
      <circle cx="14" cy="48" r="0.9" fill="#c4b5fd" fillOpacity="0.5" />
    </svg>
  );
}

export function GamesScreen({
  onSelectRps,
  onSelectDice,
  onSelectXo,
  onSelectPvpRoulette,
  onBack,
  rpsOnline = 0,
  diceOnline = 0,
  xoOnline = 0,
  pvpRouletteOnline = 0,
}: GamesScreenProps) {
  const { t, lang } = useI18n();
  const isRu = lang === "ru";
  const { setBackButton } = useTelegram();

  useEffect(() => {
    if (!onBack) return;
    setBackButton(() => onBack());
    return () => setBackButton(null);
  }, [onBack, setBackButton]);

  const OnlineBadge = ({ count }: { count: number }) => (
    <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md">
      <span className="relative flex h-1.5 w-1.5">
        {count > 0 ? (
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
        {count > 99 ? "99+" : count}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-5 pt-2 pb-6">
        <h1 className="text-center text-[30px] font-bold tracking-tight text-white leading-none">
          {t("pvpGame")}
        </h1>
        <p className="text-center text-[13px] text-white/40 mt-2">
          {isRu ? "Выбери игру и бросай вызов" : "Pick a game and challenge"}
        </p>
      </div>

      <div className="px-4 flex flex-col gap-4">

        {/* PvP Roulette — first */}
        <button
            type="button"
            onClick={() => onSelectPvpRoulette?.()}
            className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] via-[#5b21b6] to-[#9d174d]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_20%,rgba(167,139,250,0.5),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_100%_10%,rgba(251,191,36,0.22),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_70%_90%,rgba(34,211,238,0.18),transparent_50%)]" />
            <OnlineBadge count={pvpRouletteOnline} />
            <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
              <div className="opacity-100 -ml-1 -mt-1">
                <PvpRouletteCardArt />
              </div>
              <div className="mt-6">
                <div className="text-[22px] font-bold text-white tracking-tight leading-none">
                  {isRu ? "PvP Рулетка" : "PvP Roulette"}
                </div>
                <div className="text-[13px] text-white/55 mt-1.5 leading-snug">
                  {isRu
                    ? "Один против всех · победитель забирает банк"
                    : "One vs all · winner takes the bank"}
                </div>
              </div>
            </div>
          </button>

        {/* RPS */}
        <button
          type="button"
          onClick={onSelectRps}
          className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#6b21a8] via-[#86198f] to-[#be185d]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_20%,rgba(244,114,182,0.45),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_95%_5%,rgba(167,139,250,0.4),transparent_45%)]" />
          <div className="absolute bottom-[-35%] right-[-10%] w-[60%] h-[70%] rounded-full bg-fuchsia-400/15 blur-3xl" />
          <OnlineBadge count={rpsOnline} />
          <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-[52px] h-[52px] rounded-2xl bg-white/[0.14] border border-white/25 backdrop-blur-md flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.4)] -rotate-6 group-hover:rotate-0 transition-transform duration-300 text-white">
                <ChoiceIcon choice="rock" className="w-7 h-7" />
              </div>
              <div className="relative w-[52px] h-[52px] rounded-2xl bg-white/[0.14] border border-white/25 backdrop-blur-md flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.4)] rotate-3 group-hover:rotate-0 transition-transform duration-300 -ml-1 text-white">
                <ChoiceIcon choice="paper" className="w-7 h-7" />
              </div>
              <div className="relative w-[52px] h-[52px] rounded-2xl bg-white/[0.14] border border-white/25 backdrop-blur-md flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.4)] rotate-6 group-hover:rotate-0 transition-transform duration-300 -ml-1 text-white">
                <ChoiceIcon choice="scissors" className="w-7 h-7" />
              </div>
            </div>
            <div className="mt-6">
              <div className="text-[22px] font-bold text-white tracking-tight leading-none">
                {t("rps")}
              </div>
              <div className="text-[13px] text-white/55 mt-1.5 leading-snug">
                {t("rpsDesc")}
              </div>
            </div>
          </div>
        </button>

        {/* Dice — premium card */}
        <button
          type="button"
          onClick={onSelectDice}
          className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#0e7490]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_20%,rgba(52,211,153,0.4),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_0%,rgba(34,211,238,0.3),transparent_50%)]" />
          <div className="absolute bottom-[-40%] left-[-10%] w-[55%] h-[70%] rounded-full bg-teal-400/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.5) 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5">
            <div className="relative flex items-center px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-400 border border-white/35 shadow-[0_0_16px_rgba(251,191,36,0.55),0_2px_8px_rgba(0,0,0,0.25)]">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/85 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]">
                NEW
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                {diceOnline > 0 ? (
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
                {diceOnline > 99 ? "99+" : diceOnline}
              </span>
            </div>
          </div>
          <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <svg
                width="52"
                height="52"
                viewBox="0 0 52 52"
                className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)] -rotate-6 group-hover:rotate-0 transition-transform duration-300"
              >
                <defs>
                  <linearGradient id="dieG1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="55%" stopColor="#f4f4f5" />
                    <stop offset="100%" stopColor="#d4d4d8" />
                  </linearGradient>
                </defs>
                <rect
                  x="1"
                  y="1"
                  width="50"
                  height="50"
                  rx="12"
                  fill="url(#dieG1)"
                  stroke="rgba(255,255,255,0.55)"
                />
                <circle cx="14" cy="14" r="4" fill="#12121a" />
                <circle cx="38" cy="14" r="4" fill="#12121a" />
                <circle cx="26" cy="26" r="4" fill="#12121a" />
                <circle cx="14" cy="38" r="4" fill="#12121a" />
                <circle cx="38" cy="38" r="4" fill="#12121a" />
              </svg>
              <svg
                width="52"
                height="52"
                viewBox="0 0 52 52"
                className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)] rotate-6 group-hover:rotate-0 transition-transform duration-300"
              >
                <defs>
                  <linearGradient id="dieG2" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="55%" stopColor="#f4f4f5" />
                    <stop offset="100%" stopColor="#d4d4d8" />
                  </linearGradient>
                </defs>
                <rect
                  x="1"
                  y="1"
                  width="50"
                  height="50"
                  rx="12"
                  fill="url(#dieG2)"
                  stroke="rgba(255,255,255,0.55)"
                />
                <circle cx="14" cy="13" r="3.6" fill="#12121a" />
                <circle cx="38" cy="13" r="3.6" fill="#12121a" />
                <circle cx="14" cy="26" r="3.6" fill="#12121a" />
                <circle cx="38" cy="26" r="3.6" fill="#12121a" />
                <circle cx="14" cy="39" r="3.6" fill="#12121a" />
                <circle cx="38" cy="39" r="3.6" fill="#12121a" />
              </svg>
            </div>
            <div className="mt-5">
              <div className="text-[22px] font-bold text-white tracking-tight leading-none">
                {t("dice")}
              </div>
              <div className="text-[13px] text-white/55 mt-1.5 leading-snug max-w-[92%]">
                {isRu
                  ? "Стол 2–6 игроков · две кости · большая сумма забирает банк"
                  : "Table 2–6 · two dice · highest sum takes the pot"}
              </div>
            </div>
          </div>
        </button>

        {/* XO — Tic-Tac-Toe */}
        <button
          type="button"
          onClick={() => onSelectXo?.()}
          className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#9f1239] via-[#be185d] to-[#0e7490]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_20%,rgba(251,113,133,0.4),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_0%,rgba(34,211,238,0.28),transparent_50%)]" />
          <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5">
            <div className="relative flex items-center px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-400 border border-white/35 shadow-[0_0_16px_rgba(251,191,36,0.55),0_2px_8px_rgba(0,0,0,0.25)]">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/85">
                NEW
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                {xoOnline > 0 ? (
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
                {xoOnline > 99 ? "99+" : xoOnline}
              </span>
            </div>
          </div>
          <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-[56px] h-[56px] rounded-2xl bg-white/[0.14] border border-white/25 backdrop-blur-md flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.4)] -rotate-6 group-hover:rotate-0 transition-transform duration-300">
                <svg width="28" height="28" viewBox="0 0 24 24" className="drop-shadow-[0_4px_12px_rgba(251,113,133,0.45)]">
                  <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" stroke="#fda4af" strokeWidth="2.8" strokeLinecap="round" />
                </svg>
              </div>
              <div className="relative w-[56px] h-[56px] rounded-2xl bg-white/[0.14] border border-white/25 backdrop-blur-md flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.4)] rotate-6 group-hover:rotate-0 transition-transform duration-300 -ml-2">
                <svg width="28" height="28" viewBox="0 0 24 24" className="drop-shadow-[0_4px_12px_rgba(34,211,238,0.45)]">
                  <circle cx="12" cy="12" r="7.2" fill="none" stroke="#67e8f9" strokeWidth="2.8" />
                </svg>
              </div>
            </div>
            <div className="mt-6">
              <div className="text-[22px] font-bold text-white tracking-tight leading-none">
                {t("xo")}
              </div>
              <div className="text-[13px] text-white/55 mt-1.5 leading-snug">
                {t("xoDesc")}
              </div>
            </div>
          </div>
        </button>



      </div>
    </div>
  );
}

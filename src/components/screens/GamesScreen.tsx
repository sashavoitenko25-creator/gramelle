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


/** Premium avatar-strip art for PvP Roulette card */
function PvpRouletteCardArt() {
  return (
    <svg
      width="132"
      height="92"
      viewBox="0 0 132 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)] group-hover:scale-[1.04] transition-transform duration-300"
      aria-hidden
    >
      <defs>
        <linearGradient id="prTrack" x1="8" y1="40" x2="124" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#fbbf24" stopOpacity="0.95" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="prA1" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="prA2" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fcd34d" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="prA3" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="prA4" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f9a8d4" />
          <stop offset="1" stopColor="#db2777" />
        </linearGradient>
        <linearGradient id="prA5" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#86efac" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <radialGradient id="prGlow" cx="0.5" cy="0.45" r="0.55">
          <stop stopColor="#fbbf24" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <filter id="prSoft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="prBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      {/* soft ground glow */}
      <ellipse cx="66" cy="82" rx="42" ry="6" fill="#a78bfa" fillOpacity="0.28" />

      {/* motion trails behind strip */}
      <g opacity="0.35" filter="url(#prBlur)">
        <circle cx="22" cy="50" r="11" fill="#7c3aed" />
        <circle cx="110" cy="50" r="11" fill="#0891b2" />
      </g>

      {/* track frame */}
      <rect
        x="10"
        y="34"
        width="112"
        height="36"
        rx="18"
        fill="#0a0a14"
        fillOpacity="0.65"
        stroke="url(#prTrack)"
        strokeWidth="1.8"
        filter="url(#prSoft)"
      />
      <rect
        x="14"
        y="38"
        width="104"
        height="28"
        rx="14"
        fill="#12101f"
        fillOpacity="0.5"
      />

      {/* gold pointer top */}
      <g filter="url(#prSoft)">
        <path d="M58 22 L74 22 L66 34 Z" fill="#fbbf24" />
        <path d="M60 22 L72 22 L66 31 Z" fill="#fef3c7" opacity="0.55" />
      </g>
      {/* cyan pointer bottom */}
      <g filter="url(#prSoft)">
        <path d="M58 82 L74 82 L66 70 Z" fill="#22d3ee" />
      </g>

      {/* center selection glow */}
      <ellipse cx="66" cy="52" rx="16" ry="16" fill="url(#prGlow)" />

      {/* avatars on strip */}
      <g filter="url(#prSoft)">
        <circle cx="30" cy="52" r="12" fill="url(#prA1)" />
        <circle cx="48" cy="52" r="12" fill="url(#prA4)" />
        <circle cx="66" cy="52" r="13.5" fill="url(#prA2)" />
        <circle cx="84" cy="52" r="12" fill="url(#prA3)" />
        <circle cx="102" cy="52" r="12" fill="url(#prA5)" />
      </g>

      {/* rings */}
      <circle cx="30" cy="52" r="12" stroke="#fff" strokeOpacity="0.22" strokeWidth="1" fill="none" />
      <circle cx="48" cy="52" r="12" stroke="#fff" strokeOpacity="0.22" strokeWidth="1" fill="none" />
      <circle cx="66" cy="52" r="13.5" stroke="#fbbf24" strokeOpacity="0.95" strokeWidth="2" fill="none" />
      <circle cx="84" cy="52" r="12" stroke="#fff" strokeOpacity="0.22" strokeWidth="1" fill="none" />
      <circle cx="102" cy="52" r="12" stroke="#fff" strokeOpacity="0.2" strokeWidth="1" fill="none" />

      {/* face hints */}
      <g opacity="0.9">
        <circle cx="26.5" cy="49" r="1.3" fill="#fff" fillOpacity="0.85" />
        <circle cx="33.5" cy="49" r="1.3" fill="#fff" fillOpacity="0.85" />
        <path d="M27 55 Q30 57.5 33 55" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.1" strokeLinecap="round" fill="none" />

        <circle cx="44.5" cy="49" r="1.3" fill="#fff" fillOpacity="0.85" />
        <circle cx="51.5" cy="49" r="1.3" fill="#fff" fillOpacity="0.85" />
        <path d="M45 55 Q48 57.5 51 55" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.1" strokeLinecap="round" fill="none" />

        <circle cx="62" cy="48.5" r="1.5" fill="#1c1917" fillOpacity="0.55" />
        <circle cx="70" cy="48.5" r="1.5" fill="#1c1917" fillOpacity="0.55" />
        <path d="M62 56 Q66 59 70 56" stroke="#1c1917" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" fill="none" />

        <circle cx="80.5" cy="49" r="1.3" fill="#fff" fillOpacity="0.9" />
        <circle cx="87.5" cy="49" r="1.3" fill="#fff" fillOpacity="0.9" />
        <path d="M81 55 Q84 57.5 87 55" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.1" strokeLinecap="round" fill="none" />

        <circle cx="98.5" cy="49" r="1.3" fill="#fff" fillOpacity="0.85" />
        <circle cx="105.5" cy="49" r="1.3" fill="#fff" fillOpacity="0.85" />
        <path d="M99 55 Q102 57.5 105 55" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </g>

      {/* sparkles */}
      <circle cx="20" cy="28" r="1.4" fill="#fff" fillOpacity="0.7" />
      <circle cx="112" cy="30" r="1.2" fill="#fde68a" fillOpacity="0.8" />
      <circle cx="118" cy="48" r="1" fill="#67e8f9" fillOpacity="0.7" />
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

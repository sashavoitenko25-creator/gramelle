"use client";

import { ChoiceIcon } from "@/components/rps/RpsIcons";
import { useI18n } from "@/lib/i18n/context";

interface GamesScreenProps {
  onSelectRps: () => void;
  onSelectDice: () => void;
  onlineCount?: number;
}

export function GamesScreen({
  onSelectRps,
  onSelectDice,
  onlineCount = 0,
}: GamesScreenProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-5 pt-2 pb-6">
        <h1 className="text-center text-[30px] font-bold tracking-tight text-white leading-none">
          {t("pvpGame")}
        </h1>
        <p className="text-center text-[13px] text-white/40 mt-2">
          {t("chooseMode")}
        </p>
      </div>

      <div className="px-4 flex flex-col gap-4">
        <button
          type="button"
          onClick={onSelectRps}
          className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#6b21a8] via-[#86198f] to-[#be185d]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_20%,rgba(244,114,182,0.45),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_95%_5%,rgba(167,139,250,0.4),transparent_45%)]" />
          <div className="absolute bottom-[-35%] right-[-10%] w-[60%] h-[70%] rounded-full bg-fuchsia-400/15 blur-3xl" />
          <div className="absolute top-[-20%] left-[-15%] w-[45%] h-[50%] rounded-full bg-violet-400/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          {/* Online badge — top right on RPS card (always show, including 0) */}
          <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              {onlineCount > 0 ? (
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
              {onlineCount > 99 ? "99+" : onlineCount}
            </span>
          </div>

          <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
            <div className="flex items-center -space-x-2.5">
              <div className="w-11 h-11 rounded-full bg-white/[0.14] border-2 border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.3)] z-30 text-white">
                <ChoiceIcon choice="rock" className="w-6 h-6" />
              </div>
              <div className="w-11 h-11 rounded-full bg-white/[0.14] border-2 border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.3)] z-20 text-white">
                <ChoiceIcon choice="paper" className="w-6 h-6" />
              </div>
              <div className="w-11 h-11 rounded-full bg-white/[0.14] border-2 border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.3)] z-10 text-white">
                <ChoiceIcon choice="scissors" className="w-6 h-6" />
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

        <button
          type="button"
          onClick={onSelectDice}
          className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#065f46] via-[#047857] to-[#0e7490]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_20%,rgba(52,211,153,0.35),transparent_55%)]" />
          <div className="relative p-5 min-h-[140px] flex flex-col justify-between">
            <div className="flex gap-2">
              <span className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-xl font-bold text-white">5</span>
              <span className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-xl font-bold text-white">6</span>
            </div>
            <div className="mt-5">
              <div className="text-[22px] font-bold text-white tracking-tight leading-none">Dice</div>
              <p className="text-[12px] text-white/55 mt-1.5 leading-snug">PvP · 2–6 · стол · очередь · переброс</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

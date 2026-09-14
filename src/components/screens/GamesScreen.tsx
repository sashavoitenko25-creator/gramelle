"use client";

import { useEffect, useState } from "react";
import { ChoiceIcon } from "@/components/rps/RpsIcons";
import { useI18n } from "@/lib/i18n/context";
import { diceList } from "@/lib/diceApi";

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
  const { t, lang } = useI18n();
  const isRu = lang === "ru";
  const [diceOnline, setDiceOnline] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await diceList();
        const ids = new Set<number>();
        for (const r of data.rooms || []) {
          if (r.status === "open" || r.status === "playing") {
            for (const p of r.players) ids.add(p.telegramId);
          }
        }
        if (alive) setDiceOnline(ids.size);
      } catch {
        /* */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

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
          {t("chooseMode")}
        </p>
      </div>

      <div className="px-4 flex flex-col gap-4">
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
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <OnlineBadge count={onlineCount} />
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
          <OnlineBadge count={diceOnline} />
          <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
            <div className="flex items-center gap-2.5">
              {[5, 6].map((n) => (
                <div
                  key={n}
                  className="w-11 h-11 rounded-2xl bg-gradient-to-br from-white via-white to-white/80 text-[#064e3b] border border-white/30 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex items-center justify-center text-[18px] font-bold tabular-nums"
                >
                  {n}
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="text-[22px] font-bold text-white tracking-tight leading-none">
                Dice
              </div>
              <div className="text-[13px] text-white/55 mt-1.5 leading-snug">
                {isRu
                  ? "Стол 2–6 · кости · переброс ничьих"
                  : "Table 2–6 · dice · tie re-rolls"}
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

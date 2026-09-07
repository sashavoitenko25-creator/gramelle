"use client";

import { ChoiceIcon } from "@/components/rps/RpsIcons";
import { useI18n } from "@/lib/i18n/context";
import { SpinIcon } from "@/components/ui/SpinIcon";
import { useEffect, useState } from "react";
import { rpsList } from "@/lib/rpsApi";
import { fetchRoundState } from "@/lib/api";

interface GamesScreenProps {
  onSelectSpin: () => void;
  onSelectRps: () => void;
  /** Optional overrides from parent */
  onlineSpin?: number;
  onlineRps?: number;
}

function OnlineBadge({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 border border-white/[0.12] backdrop-blur-md">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
      </span>
      <span className="text-[11px] font-medium text-white/90 tabular-nums">
        {count} {label}
      </span>
    </div>
  );
}

export function GamesScreen({
  onSelectSpin,
  onSelectRps,
  onlineSpin: spinProp,
  onlineRps: rpsProp,
}: GamesScreenProps) {
  const { t } = useI18n();
  const [spinOnline, setSpinOnline] = useState(spinProp ?? 0);
  const [rpsOnline, setRpsOnline] = useState(rpsProp ?? 0);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const [rps, classic, high] = await Promise.all([
          rpsList().catch(() => null),
          fetchRoundState("classic").catch(() => null),
          fetchRoundState("high").catch(() => null),
        ]);

        if (!alive) return;

        // RPS: players in open rooms (1 each) + anyone in a playing duel (2)
        if (rps) {
          const open = (rps.rooms || []).length;
          // open rooms: 1 creator each; playing duel: 2 players
          setRpsOnline(Math.max(0, open + (rps.mine?.status === "playing" ? 2 : 0)));
        }

        // SPIN: unique players currently in classic + high banks
        const ids = new Set<number>();
        for (const st of [classic, high]) {
          if (!st?.bets) continue;
          for (const b of st.bets) {
            if (b.telegramId) ids.add(b.telegramId);
          }
        }
        setSpinOnline(ids.size);
      } catch {
        /* keep last */
      }
    };

    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Prefer live state; props only as initial if provided continuously
  const spin = spinProp != null && spinProp > 0 ? spinProp : spinOnline;
  const rps = rpsProp != null && rpsProp > 0 ? rpsProp : rpsOnline;
  const total = spin + rps;

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-5 pt-5 pb-6">
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/40 mb-2.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="tabular-nums">{total} {t("online")}</span>
        </div>
        <h1 className="text-center text-[30px] font-bold tracking-tight text-white leading-none">
          PvP Game
        </h1>
        <p className="text-center text-[13px] text-white/40 mt-2">
          {t("chooseMode")}
        </p>
      </div>

      <div className="px-4 flex flex-col gap-4">
        {/* SPIN */}
        <button
          type="button"
          onClick={onSelectSpin}
          className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#3b1d8f] via-[#4c1d95] to-[#0e7490]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_15%_10%,rgba(167,139,250,0.55),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_90%_90%,rgba(34,211,238,0.35),transparent_50%)]" />
          <div className="absolute top-[-40%] right-[-15%] w-[70%] h-[90%] rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-10%] w-[50%] h-[60%] rounded-full bg-violet-500/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="relative w-14 h-14 rounded-2xl bg-white/[0.12] border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-violet-500/20" />
                <SpinIcon
                  size={30}
                  className="relative text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                />
              </div>
              <OnlineBadge count={spin} label={t("online")} />
            </div>
            <div className="mt-6">
              <div className="text-[24px] font-bold text-white tracking-tight leading-none">
                {t("spin")}
              </div>
              <div className="text-[13px] text-white/55 mt-1.5 leading-snug">
                {t("spinDesc")}
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
          <div className="absolute top-[-20%] left-[-15%] w-[45%] h-[50%] rounded-full bg-violet-400/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          <div className="relative p-5 min-h-[168px] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center -space-x-2.5">
                <div className="w-11 h-11 rounded-full bg-white/[0.14] border-2 border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.3)] z-30 text-white">
                  <ChoiceIcon choice="rock" className="w-5 h-5" />
                </div>
                <div className="w-11 h-11 rounded-full bg-white/[0.14] border-2 border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.3)] z-20 text-white">
                  <ChoiceIcon choice="paper" className="w-5 h-5" />
                </div>
                <div className="w-11 h-11 rounded-full bg-white/[0.14] border-2 border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.3)] z-10 text-white">
                  <ChoiceIcon choice="scissors" className="w-5 h-5" />
                </div>
              </div>
              <OnlineBadge count={rps} label={t("online")} />
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
      </div>
    </div>
  );
}

"use client";

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

function OnlineBadge({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 border border-white/[0.12] backdrop-blur-md">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
      </span>
      <span className="text-[11px] font-medium text-white/90 tabular-nums">
        {count} online
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
          // mine open counts as 1; if mine is playing, 2 people in duel
          let extra = 0;
          if (rps.mine?.status === "playing") extra = 2;
          else if (rps.mine?.status === "open") extra = 0; // already in open list if listed
          // open rooms each have 1 creator waiting
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
          <span className="tabular-nums">{total} online</span>
        </div>
        <h1 className="text-center text-[30px] font-bold tracking-tight text-white leading-none">
          PvP Game
        </h1>
        <p className="text-center text-[13px] text-white/40 mt-2">
          Choose a mode and challenge others
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
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-2xl bg-white/[0.12] border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.35)] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-violet-500/20" />
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="relative text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3.5"
                      fill="currentColor"
                      opacity="0.35"
                    />
                    <path
                      d="M12 3v18M3 12h18"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      opacity="0.55"
                    />
                    <path
                      d="M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      opacity="0.3"
                    />
                  </svg>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/40 to-fuchsia-500/30 border border-white/15 flex items-center justify-center">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="text-violet-200"
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
              </div>
              <OnlineBadge count={spin} />
            </div>
            <div className="mt-6">
              <div className="text-[24px] font-bold text-white tracking-tight leading-none">
                SPIN
              </div>
              <div className="text-[13px] text-white/55 mt-1.5 leading-snug">
                Classic PvP roulette · winner takes the bank
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
                <div className="w-11 h-11 rounded-full bg-white/[0.14] border-2 border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.3)] z-30">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/90">
                    <path
                      d="M8 10.5c0-1.5 1-2.5 2.5-2.5h1c.8 0 1.5.4 2 1 .4-.6 1.1-1 2-1h1c1.5 0 2.5 1 2.5 2.5V15c0 2.2-1.8 4-4 4h-3c-2.2 0-4-1.8-4-4v-4.5z"
                      fill="currentColor"
                      opacity="0.9"
                    />
                  </svg>
                </div>
                <div className="w-11 h-11 rounded-full bg-white/[0.14] border-2 border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.3)] z-20">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white/90">
                    <rect x="6" y="3" width="12" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
                  </svg>
                </div>
                <div className="w-11 h-11 rounded-full bg-white/[0.14] border-2 border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.3)] z-10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white/90">
                    <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8.5 7.5L20 18M8.5 16.5L20 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <OnlineBadge count={rps} />
            </div>
            <div className="mt-6">
              <div className="text-[22px] font-bold text-white tracking-tight leading-none">
                Rock · Paper · Scissors
              </div>
              <div className="text-[13px] text-white/55 mt-1.5 leading-snug">
                1v1 duel · create or join a room
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

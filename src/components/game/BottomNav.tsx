"use client";

import type { Screen } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  screen: Screen;
  onChange: (s: Screen) => void;
}

export function BottomNav({ screen, onChange }: BottomNavProps) {
  const isGame = screen === "pvp" || screen === "history";
  const isProfile = screen === "profile" || screen === "referrals";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0f]/95 backdrop-blur border-t border-white/5 safe-bottom">
      <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
        <button
          onClick={() => onChange("pvp")}
          className={cn(
            "flex flex-col items-center gap-0.5 px-6 py-1 transition",
            isGame ? "text-cyan-400" : "text-white/40"
          )}
        >
          <span className="text-xl">🎰</span>
          <span className="text-[10px] font-medium">PvP</span>
        </button>
        <button
          onClick={() => onChange("profile")}
          className={cn(
            "flex flex-col items-center gap-0.5 px-6 py-1 transition",
            isProfile ? "text-cyan-400" : "text-white/40"
          )}
        >
          <span className="text-xl">👤</span>
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </nav>
  );
}

"use client";

import type { Screen } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  screen: Screen;
  onChange: (s: Screen) => void;
}

const items: { id: Screen; label: string; icon: React.ReactNode }[] = [
  {
    id: "pvp",
    label: "Play",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18" opacity="0.4" />
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" opacity="0.3" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export function BottomNav({ screen, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom pointer-events-none">
      <div className="mx-auto max-w-lg px-4 pb-1 pointer-events-auto">
        <div className="glass-strong rounded-2xl flex items-center justify-around py-1.5 px-1 shadow-[0_-8px_40px_rgba(0,0,0,0.45)] border border-white/[0.08]">
          {items.map((item) => {
            const active =
              screen === item.id || (item.id === "profile" && screen === "referrals");
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 px-6 rounded-xl transition-all duration-200 btn-press min-w-[72px]",
                  active ? "text-cyan-300" : "text-white/35 hover:text-white/55"
                )}
              >
                <span
                  className={cn(
                    active && "drop-shadow-[0_0_10px_rgba(34,211,238,0.55)]"
                  )}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-medium tracking-wide">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

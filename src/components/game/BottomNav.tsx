"use client";

import type { Screen } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

interface BottomNavProps {
  screen: Screen;
  onChange: (s: Screen) => void;
}

type NavItem =
  | {
      id: Screen;
      labelKey: string;
      disabled?: false;
      icon: React.ReactNode;
    }
  | {
      id: "shop";
      labelKey: string;
      disabled: true;
      icon: React.ReactNode;
    };

const items: NavItem[] = [
  {
    id: "games",
    labelKey: "play",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "tasks",
    labelKey: "tasks",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    id: "shop",
    labelKey: "shop",
    disabled: true,
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    id: "profile",
    labelKey: "profile",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export function BottomNav({ screen, onChange }: BottomNavProps) {
  const { t, lang } = useI18n();
  const soonLabel = lang === "ru" ? "скоро" : "soon";
  const labels: Record<string, string> = {
    games: t("play"),
    tasks: t("tasks"),
    shop: t("shop"),
    profile: t("profile"),
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom pointer-events-none">
      <div className="mx-auto max-w-lg px-4 pb-1 pointer-events-auto">
        <div className="glass-strong rounded-2xl flex items-center justify-around py-1.5 px-1 shadow-[0_-8px_40px_rgba(0,0,0,0.45)] border border-white/[0.08]">
          {items.map((item) => {
            if (item.disabled) {
              return (
                <div
                  key={item.id}
                  className="relative flex flex-col items-center gap-0.5 py-2.5 px-4 rounded-xl min-w-[64px] text-white/22 select-none cursor-not-allowed"
                  aria-disabled="true"
                  title={soonLabel}
                >
                  <span className="relative opacity-70">
                    {item.icon}
                    <span className="absolute -top-1.5 -right-3 px-1 py-[1px] rounded-md bg-gradient-to-r from-violet-500/90 to-fuchsia-500/90 text-[8px] font-bold uppercase tracking-wide text-white leading-none shadow-[0_0_10px_rgba(168,85,247,0.45)] border border-white/20">
                      {soonLabel}
                    </span>
                  </span>
                  <span className="text-[10px] font-medium tracking-wide">
                    {labels.shop}
                  </span>
                </div>
              );
            }

            const active =
              screen === item.id ||
              (item.id === "games" &&
                (screen === "rps" || screen === "dice" || screen === "xo" || screen === "pvp_roulette")) ||
              (item.id === "profile" &&
                (screen === "referrals" ||
                  screen === "transactions" ||
                  screen === "fairness"));

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2.5 px-4 rounded-xl transition-all duration-200 btn-press min-w-[64px]",
                  active
                    ? "text-cyan-300"
                    : "text-white/35 hover:text-white/55"
                )}
              >
                <span
                  className={cn(
                    "relative",
                    active && "drop-shadow-[0_0_10px_rgba(34,211,238,0.55)]"
                  )}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-medium tracking-wide">
                  {labels[item.id] || item.labelKey}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

"use client";

import { cn } from "@/lib/utils";
import type { RpsChoice } from "@/lib/rpsApi";
import { useI18n } from "@/lib/i18n/context";

/** Clear, filled icons — readable at small size */
export function RockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <ellipse cx="24" cy="28" rx="14" ry="12" fill="currentColor" opacity="0.95" />
      <path
        d="M14 26c1-8 5-14 10-14s9 6 10 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M18 24h12M20 29h8"
        stroke="#000"
        strokeOpacity="0.2"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PaperIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        d="M14 8h14l8 8v24a2 2 0 01-2 2H14a2 2 0 01-2-2V10a2 2 0 012-2z"
        fill="currentColor"
        opacity="0.95"
      />
      <path d="M28 8v8h8" fill="#000" fillOpacity="0.15" />
      <path
        d="M18 22h12M18 28h12M18 34h8"
        stroke="#000"
        strokeOpacity="0.25"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="14" cy="14" r="6" fill="currentColor" opacity="0.95" />
      <circle cx="14" cy="34" r="6" fill="currentColor" opacity="0.95" />
      <circle cx="14" cy="14" r="2.5" fill="#0a0a12" opacity="0.5" />
      <circle cx="14" cy="34" r="2.5" fill="#0a0a12" opacity="0.5" />
      <path
        d="M19 17L40 36M19 31L40 12"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.95"
      />
    </svg>
  );
}

export function ChoiceIcon({
  choice,
  className,
}: {
  choice: RpsChoice;
  className?: string;
}) {
  if (choice === "rock") return <RockIcon className={className} />;
  if (choice === "paper") return <PaperIcon className={className} />;
  return <ScissorsIcon className={className} />;
}

export const CHOICE_LABEL: Record<RpsChoice, string> = {
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors",
};

export const CHOICE_EMOJI: Record<RpsChoice, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

export function ChoiceButton({
  choice,
  selected,
  onClick,
  disabled,
  size = "md",
}: {
  choice: RpsChoice;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const { t } = useI18n();
  const labels = { rock: t("rock"), paper: t("paper"), scissors: t("scissors") };
  const dim =
    size === "lg"
      ? "w-[92px] h-[92px]"
      : size === "sm"
        ? "w-12 h-12"
        : "w-[76px] h-[76px]";
  const icon =
    size === "lg" ? "w-11 h-11" : size === "sm" ? "w-6 h-6" : "w-9 h-9";

  const accent =
    choice === "rock"
      ? "from-slate-400/25 to-slate-600/20"
      : choice === "paper"
        ? "from-sky-400/25 to-blue-600/20"
        : "from-rose-400/25 to-orange-500/20";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border flex flex-col items-center justify-center gap-1 transition btn-press",
        dim,
        selected
          ? "border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-80 pointer-events-none",
          accent
        )}
      />
      <ChoiceIcon
        choice={choice}
        className={cn(icon, "relative text-white drop-shadow-sm")}
      />
      {size !== "sm" && (
        <span className="relative text-[10px] font-medium text-white/55 tracking-wide">
          {labels[choice]}
        </span>
      )}
    </button>
  );
}

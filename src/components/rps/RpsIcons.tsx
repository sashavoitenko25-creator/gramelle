"use client";

import { cn } from "@/lib/utils";
import type { RpsChoice } from "@/lib/rpsApi";

export function RockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M8 10.5c0-1.5 1-2.5 2.5-2.5h1c.8 0 1.5.4 2 1 .4-.6 1.1-1 2-1h1c1.5 0 2.5 1 2.5 2.5V15c0 2.2-1.8 4-4 4h-3c-2.2 0-4-1.8-4-4v-4.5z"
        fill="currentColor"
        opacity="0.92"
      />
      <path
        d="M10 8V6.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}

export function PaperIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="6"
        y="3"
        width="12"
        height="18"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 8h6M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

export function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8.5 7.5L20 18M8.5 16.5L20 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
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
  const dim =
    size === "lg"
      ? "w-[88px] h-[88px]"
      : size === "sm"
        ? "w-12 h-12"
        : "w-[72px] h-[72px]";
  const icon =
    size === "lg" ? "w-10 h-10" : size === "sm" ? "w-5 h-5" : "w-8 h-8";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all btn-press",
        dim,
        selected
          ? "bg-fuchsia-500/20 border-fuchsia-400/45 text-fuchsia-100 shadow-[0_0_28px_rgba(232,121,249,0.25)]"
          : "bg-white/[0.04] border-white/[0.1] text-white/70 hover:border-white/20 hover:text-white/90",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      <ChoiceIcon choice={choice} className={icon} />
      {size !== "sm" && (
        <span className="text-[10px] font-medium tracking-wide opacity-80">
          {CHOICE_LABEL[choice]}
        </span>
      )}
    </button>
  );
}

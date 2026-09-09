"use client";

import { cn } from "@/lib/utils";
import type { RpsChoice } from "@/lib/rpsApi";
import { useI18n } from "@/lib/i18n/context";

/**
 * Hand-gesture icons for Rock / Paper / Scissors.
 * Filled, readable at small sizes, use currentColor.
 */

/** Fist — rock */
export function RockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      {/* wrist */}
      <path
        d="M22 48c0 4 3.5 8 10 8s10-4 10-8v-6H22v6z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* palm / fist body */}
      <path
        d="M18 28c-2 0-4 2-4 5v9c0 3 2 5 5 5h26c3 0 5-2 5-5v-9c0-3-2-5-4-5h-2.5c0-3.5-2.5-6-5.5-6h-1c-.3-3-2.5-5-5.5-5s-5.2 2-5.5 5h-1c-3 0-5.5 2.5-5.5 6H18z"
        fill="currentColor"
      />
      {/* knuckle highlights */}
      <circle cx="24" cy="30" r="3.2" fill="currentColor" opacity="0.35" />
      <circle cx="32" cy="28.5" r="3.2" fill="currentColor" opacity="0.35" />
      <circle cx="40" cy="30" r="3.2" fill="currentColor" opacity="0.35" />
      {/* thumb */}
      <path
        d="M16 34c-3 0-5 2.2-5 5s2 5 5 5h6v-6c0-2.2-1.5-4-3.5-4H16z"
        fill="currentColor"
      />
      <path
        d="M20 26c1.5-4 5-7 10-7 3 0 5.5 1.2 7 3"
        stroke="#000"
        strokeOpacity="0.12"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Open hand — paper */
export function PaperIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      {/* wrist */}
      <path
        d="M24 50c0 3.5 3 6.5 8 6.5s8-3 8-6.5V44H24v6z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* palm */}
      <path
        d="M22 42c-3 0-5-2.2-5-5V28c0-2.5 2-4.5 4.5-4.5h1V16.5c0-2.2 1.6-4 3.8-4s3.8 1.8 3.8 4V22h1.2V13.5c0-2.3 1.7-4.2 4-4.2s4 1.9 4 4.2V22h1.2V15c0-2.2 1.6-4 3.8-4s3.8 1.8 3.8 4v8.5h1c2.6 0 4.7 2.1 4.7 4.7V37c0 2.8-2.2 5-5 5H22z"
        fill="currentColor"
      />
      {/* finger gaps */}
      <path
        d="M27.5 18v16M34 15v19M40.5 17v17"
        stroke="#000"
        strokeOpacity="0.15"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* thumb */}
      <path
        d="M17 32c-3.2 0-5.5 2.3-5.5 5.2S13.8 42 17 42h7v-5.5c0-2.5-2-4.5-4.5-4.5H17z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Victory hand — scissors */
export function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      {/* wrist */}
      <path
        d="M24 52c0 3 3 5.5 8 5.5s8-2.5 8-5.5v-6H24v6z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* palm / folded fingers base */}
      <path
        d="M20 44c-2.5 0-4.5-2-4.5-4.5V34c0-2.5 2-4.5 4.5-4.5h3.5l2-6.5c.5-1.5 2-2.5 3.6-2.5h2.2c1.5 0 2.8.9 3.3 2.3L36 29.5H42c2.5 0 4.5 2 4.5 4.5v5c0 2.5-2 4.5-4.5 4.5H20z"
        fill="currentColor"
      />
      {/* index finger up */}
      <path
        d="M26 30V14.5c0-2.4 1.7-4.3 4-4.3s4 1.9 4 4.3V30"
        fill="currentColor"
      />
      <path
        d="M28.2 14.5c0-1.2.9-2.1 2-2.1s2 .9 2 2.1"
        stroke="#000"
        strokeOpacity="0.12"
        strokeWidth="1.2"
      />
      {/* middle finger up */}
      <path
        d="M35 30V12.5c0-2.5 1.8-4.5 4.2-4.5 2.3 0 4.2 2 4.2 4.5V30"
        fill="currentColor"
      />
      <path
        d="M37.3 12.5c0-1.3 1-2.3 2.1-2.3s2.1 1 2.1 2.3"
        stroke="#000"
        strokeOpacity="0.12"
        strokeWidth="1.2"
      />
      {/* V gap shadow */}
      <path
        d="M34 18v10"
        stroke="#000"
        strokeOpacity="0.12"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* thumb */}
      <path
        d="M16 35c-2.8 0-5 2.1-5 4.8S13.2 44 16 44h7v-5c0-2.2-1.8-4-4-4h-3z"
        fill="currentColor"
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

export function useChoiceLabel(): Record<RpsChoice, string> {
  const { t } = useI18n();
  return {
    rock: t("rock"),
    paper: t("paper"),
    scissors: t("scissors"),
  };
}

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
  const labels = useChoiceLabel();
  const dim =
    size === "lg"
      ? "w-20 h-20"
      : size === "sm"
        ? "w-12 h-12"
        : "w-16 h-16";
  const icon =
    size === "lg" ? "w-11 h-11" : size === "sm" ? "w-7 h-7" : "w-9 h-9";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-2xl border transition btn-press",
        dim,
        selected
          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
          : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      <ChoiceIcon choice={choice} className={icon} />
      <span className="text-[10px] font-medium leading-none">{labels[choice]}</span>
    </button>
  );
}

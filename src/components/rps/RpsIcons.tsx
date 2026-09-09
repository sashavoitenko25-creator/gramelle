"use client";

import { cn } from "@/lib/utils";
import type { RpsChoice } from "@/lib/rpsApi";
import { useI18n } from "@/lib/i18n/context";

/**
 * Clear hand-gesture icons (emoji-style silhouettes).
 * Rock = fist, Paper = open palm, Scissors = V-sign.
 */

export function RockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      {/* raised fist */}
      <path
        fill="currentColor"
        d="M32 8c-2.2 0-4 1.6-4.2 3.7-.8-.5-1.8-.8-2.8-.8-2.8 0-5 2.2-5 5v1.1c-.7-.4-1.5-.6-2.4-.6-2.6 0-4.7 2-4.7 4.6V34c0 8.3 6.7 15 15 15h4c8.3 0 15-6.7 15-15V21.5c0-2.5-2-4.5-4.5-4.5-.7 0-1.4.2-2 .5V16c0-2.8-2.2-5-5-5-.9 0-1.8.3-2.5.7C33.9 9.5 33 8 32 8z"
      />
      {/* knuckle lines */}
      <path
        stroke="#000"
        strokeOpacity="0.18"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M22 24h6M29 22h6M36 24h5"
      />
      {/* wrist */}
      <path
        fill="currentColor"
        d="M25 47h14c2 0 3.5 1.6 3.5 3.5S41 54 39 54H25c-2 0-3.5-1.6-3.5-3.5S23 47 25 47z"
        opacity="0.92"
      />
    </svg>
  );
}

export function PaperIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      {/* open hand facing viewer */}
      <path
        fill="currentColor"
        d="M20 28V16.5c0-2.2 1.7-4 3.9-4 2.1 0 3.9 1.8 3.9 4V26h1.2V13.2c0-2.3 1.8-4.2 4.1-4.2 2.2 0 4 1.9 4 4.2V26h1.2V14.5c0-2.2 1.7-4 3.9-4s3.9 1.8 3.9 4V26h1V17.8c0-2.1 1.6-3.8 3.7-3.8 2 0 3.7 1.7 3.7 3.8V34c0 9.4-7.6 17-17 17h-2C23.6 51 17 44.4 17 36.2V32c0-2.2 1.8-4 4-4h1.5V28z"
      />
      {/* finger separators */}
      <path
        stroke="#000"
        strokeOpacity="0.16"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M27.8 16v18M35.2 14v20M42.5 16v18"
      />
      {/* thumb */}
      <path
        fill="currentColor"
        d="M14 33.5c0-2.5 2-4.5 4.5-4.5H21v9h-2.5C16 38 14 36 14 33.5z"
      />
      {/* wrist */}
      <path
        fill="currentColor"
        opacity="0.92"
        d="M26 49h14c2 0 3.5 1.5 3.5 3.4S42 56 40 56H26c-2 0-3.5-1.6-3.5-3.6S24 49 26 49z"
      />
    </svg>
  );
}

export function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      {/* palm + folded ring/pinky */}
      <path
        fill="currentColor"
        d="M18 36.5c0-2.5 2-4.5 4.5-4.5H28l1.5-5.2c.4-1.4 1.7-2.3 3.1-2.3h3.2c1.3 0 2.5.8 3 2l1.4 3.5h6.3c2.5 0 4.5 2 4.5 4.5V41c0 2.5-2 4.5-4.5 4.5H22.5C20 45.5 18 43.5 18 41v-4.5z"
      />
      {/* index finger */}
      <path
        fill="currentColor"
        d="M27.5 30V13.5c0-2.5 1.9-4.5 4.3-4.5 2.3 0 4.2 2 4.2 4.5V30"
      />
      {/* middle finger */}
      <path
        fill="currentColor"
        d="M36.5 30V11.5c0-2.6 2-4.7 4.5-4.7s4.5 2.1 4.5 4.7V30"
      />
      {/* V gap */}
      <path
        stroke="#000"
        strokeOpacity="0.14"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M35.8 16v12"
      />
      {/* thumb */}
      <path
        fill="currentColor"
        d="M13 37c0-2.4 1.9-4.4 4.3-4.4H21v8h-3.7C15 40.6 13 38.6 13 37z"
      />
      {/* wrist */}
      <path
        fill="currentColor"
        opacity="0.92"
        d="M25 44h15c2 0 3.5 1.5 3.5 3.4S42 51 40 51H25c-2 0-3.5-1.5-3.5-3.6S23 44 25 44z"
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
    size === "lg" ? "w-20 h-20" : size === "sm" ? "w-12 h-12" : "w-16 h-16";
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
          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
          : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.07]",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      <ChoiceIcon choice={choice} className={icon} />
      <span className="text-[10px] font-medium leading-none">{labels[choice]}</span>
    </button>
  );
}

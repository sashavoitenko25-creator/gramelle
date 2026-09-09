"use client";

import { cn } from "@/lib/utils";
import type { RpsChoice } from "@/lib/rpsApi";
import { useI18n } from "@/lib/i18n/context";

/**
 * Flat isometric-style hands (white fill, bold dark outline) — like classic RPS illustrations.
 */

const STROKE = "#1a1a1a";
const FILL = "#FFFFFF";
const SHADOW = "rgba(0,0,0,0.12)";

/** Rock — fist */
export function RockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden>
      {/* shadow */}
      <ellipse cx="40" cy="70" rx="18" ry="4" fill={SHADOW} />
      {/* wrist */}
      <path
        d="M28 48h22l4 14H26l2-14z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* fist body */}
      <path
        d="M22 28c-2 0-4 2-4 5v12c0 4 3 7 7 7h28c4 0 7-3 7-7V32c0-3-2-5-5-5h-3c0-4-3-7-7-7h-2c-1-3-4-5-7-5s-6 2-7 5h-2c-3 0-5 2-5 5h-2z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* thumb */}
      <path
        d="M16 34c-3 0-5 2.5-5 5.5S13 45 16 45h8v-8c0-2-1.5-3-3.5-3H16z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* knuckle lines */}
      <path
        d="M26 32h8M36 30h8M46 32h6"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* finger creases */}
      <path
        d="M28 40h20M30 46h16"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

/** Scissors — two fingers */
export function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden>
      <ellipse cx="42" cy="70" rx="18" ry="4" fill={SHADOW} />
      {/* wrist */}
      <path
        d="M32 50h20l3 12H30l2-12z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* palm */}
      <path
        d="M24 36c-2.5 0-4.5 2-4.5 4.5V48c0 3 2.5 5.5 5.5 5.5h26c3 0 5.5-2.5 5.5-5.5v-7c0-2.5-2-4.5-4.5-4.5H50l-2-5c-.8-1.5-2-2.5-3.5-2.5h-4c-1.4 0-2.6.8-3.2 2l-1.5 3.5H24z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* index finger */}
      <path
        d="M30 36V14c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5v22"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* middle finger */}
      <path
        d="M42 36V12c0-3.2 2.4-5.8 5.5-5.8S53 8.8 53 12v24"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* finger joints */}
      <path
        d="M32 20h6M44 18h7"
        stroke={STROKE}
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* thumb */}
      <path
        d="M18 40c-2.8 0-5 2.2-5 5s2.2 5 5 5h8v-6c0-2.2-1.8-4-4-4h-4z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Paper — open hand */
export function PaperIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden>
      <ellipse cx="40" cy="70" rx="20" ry="4" fill={SHADOW} />
      {/* wrist */}
      <path
        d="M30 52h20l3 11H28l2-11z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* palm + four fingers */}
      <path
        d="M22 34V18c0-2.8 2-5 4.6-5s4.6 2.2 4.6 5v14h1.5V14c0-3 2.2-5.4 5-5.4s5 2.4 5 5.4v16h1.5V16c0-2.8 2-5 4.6-5s4.6 2.2 4.6 5v16h1.3V20c0-2.6 1.9-4.7 4.4-4.7 2.4 0 4.3 2.1 4.3 4.7V40c0 8.5-6.5 15.5-15 15.5h-4C26.5 55.5 20 49 20 41v-3c0-2.2 1.8-4 4-4h1.5V34z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* finger lines */}
      <path
        d="M31.5 16v22M41 13v25M50.5 16v22"
        stroke={STROKE}
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* thumb */}
      <path
        d="M15 36c-3 0-5.5 2.4-5.5 5.4S12 47 15 47h9v-7c0-2.4-2-4.4-4.5-4.4H15z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.6"
        strokeLinejoin="round"
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
    size === "lg" ? "w-[5.5rem] h-[5.5rem]" : size === "sm" ? "w-12 h-12" : "w-[4.25rem] h-[4.25rem]";
  const icon =
    size === "lg" ? "w-12 h-12" : size === "sm" ? "w-7 h-7" : "w-9 h-9";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-2xl border transition btn-press",
        dim,
        selected
          ? "border-amber-300/50 bg-amber-400/15 shadow-[0_0_24px_rgba(251,191,36,0.2)]"
          : "border-white/12 bg-white/[0.06] hover:bg-white/[0.1]",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      <ChoiceIcon choice={choice} className={icon} />
      <span className="text-[10px] font-semibold tracking-wide text-white/85 leading-none">
        {labels[choice]}
      </span>
    </button>
  );
}

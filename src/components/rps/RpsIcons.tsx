"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import type { RpsChoice } from "@/lib/rpsApi";
import { useI18n } from "@/lib/i18n/context";

/**
 * Premium hand-gesture icons for RPS.
 * Soft gradients + clear silhouettes (fist / open palm / victory).
 */

function SkinGrad({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-skin`} x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFE0B8" />
        <stop offset="0.45" stopColor="#F5C18A" />
        <stop offset="1" stopColor="#E0A06E" />
      </linearGradient>
      <linearGradient id={`${id}-skinDeep`} x1="20" y1="20" x2="44" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F0B87A" />
        <stop offset="1" stopColor="#C98A55" />
      </linearGradient>
      <linearGradient id={`${id}-shine`} x1="24" y1="10" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

/** ✊ Fist */
export function RockIcon({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <SkinGrad id={uid} />
      {/* soft glow */}
      <ellipse cx="32" cy="36" rx="22" ry="20" fill={`url(#${uid}-skin)`} opacity="0.15" />
      {/* wrist */}
      <path
        d="M22 46h20c3.2 0 5.5 2.2 5.5 5.2 0 2.4-1.8 4.3-4.2 4.3H20.7c-2.4 0-4.2-1.9-4.2-4.3 0-3 2.3-5.2 5.5-5.2z"
        fill={`url(#${uid}-skinDeep)`}
      />
      {/* fist body */}
      <path
        d="M17.5 30.5c-2.8 0-5 2.3-5 5.2v6.8c0 4.6 3.6 8.3 8.1 8.3h23.8c4.5 0 8.1-3.7 8.1-8.3v-6.5c0-2.9-2.3-5.2-5.1-5.2h-1.2c.1-.6.2-1.2.2-1.8 0-3.8-3-6.8-6.7-6.8h-.8c-.4-3.2-3.1-5.7-6.4-5.7-2.2 0-4.1 1.1-5.3 2.7-.9-1.9-2.9-3.2-5.2-3.2-3.2 0-5.8 2.5-5.8 5.6 0 .5 0 1 .1 1.4h-.8c-1.9 0-3.5 1-4.5 2.5-.6-.3-1.3-.5-2-.5z"
        fill={`url(#${uid}-skin)`}
      />
      {/* thumb */}
      <path
        d="M12.8 33.2c-3.4 0-6.1 2.7-6.1 6.1 0 3.3 2.6 6 5.9 6.1h7.2v-7.4c0-2.6-2.1-4.8-4.7-4.8h-2.3z"
        fill={`url(#${uid}-skin)`}
      />
      {/* knuckles */}
      <circle cx="23.5" cy="29.5" r="3.6" fill={`url(#${uid}-shine)`} />
      <circle cx="32" cy="27.8" r="3.8" fill={`url(#${uid}-shine)`} />
      <circle cx="40.5" cy="29.5" r="3.6" fill={`url(#${uid}-shine)`} />
      {/* knuckle outline */}
      <path
        d="M20 30.2c1.2-2.2 3.3-3.6 5.7-3.6 1.4 0 2.7.4 3.8 1.2 1.2-1.6 3.1-2.6 5.3-2.6 2.4 0 4.5 1.3 5.6 3.2"
        stroke="#B87A4A"
        strokeOpacity="0.35"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** ✋ Open palm */
export function PaperIcon({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <SkinGrad id={uid} />
      <ellipse cx="32" cy="36" rx="22" ry="22" fill={`url(#${uid}-skin)`} opacity="0.12" />
      {/* wrist */}
      <path
        d="M23.5 48h17c3 0 5.2 2 5.2 4.8 0 2.2-1.7 4-4 4H22.3c-2.3 0-4-1.8-4-4 0-2.8 2.2-4.8 5.2-4.8z"
        fill={`url(#${uid}-skinDeep)`}
      />
      {/* palm + fingers (one solid readable shape) */}
      <path
        d="M19.5 30.5V17.2c0-2.6 2-4.7 4.5-4.7s4.5 2.1 4.5 4.7V28.5h1.4V13.5c0-2.8 2.1-5 4.8-5 2.6 0 4.7 2.2 4.7 5V28.5h1.4V15.2c0-2.6 2-4.7 4.5-4.7s4.5 2.1 4.5 4.7V28.5h1.2V18.8c0-2.4 1.8-4.3 4.2-4.3 2.3 0 4.1 1.9 4.1 4.3V36c0 9.9-7.6 18-17.5 18h-3.2C22.3 54 15 46.7 15 37.8v-3.5c0-2.1 1.7-3.8 3.8-3.8h.7z"
        fill={`url(#${uid}-skin)`}
      />
      {/* thumb */}
      <path
        d="M12.2 32.5c0-2.9 2.3-5.2 5.2-5.2H21v10.5h-3.6c-2.9 0-5.2-2.3-5.2-5.3z"
        fill={`url(#${uid}-skin)`}
      />
      {/* finger gaps */}
      <path
        d="M28.4 15.5v20M36.1 12.5v23M43.6 16v20"
        stroke="#B87A4A"
        strokeOpacity="0.28"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* highlight */}
      <path
        d="M26 18c2-4 7-7 13-6"
        stroke={`url(#${uid}-shine)`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** ✌️ Victory / scissors */
export function ScissorsIcon({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <SkinGrad id={uid} />
      <ellipse cx="32" cy="38" rx="20" ry="18" fill={`url(#${uid}-skin)`} opacity="0.12" />
      {/* wrist */}
      <path
        d="M23 47h18c2.8 0 4.8 1.9 4.8 4.5S43.8 56 41 56H23c-2.8 0-4.8-1.9-4.8-4.5S20.2 47 23 47z"
        fill={`url(#${uid}-skinDeep)`}
      />
      {/* palm + tucked fingers */}
      <path
        d="M17.5 35.5c0-2.9 2.3-5.2 5.2-5.2h6.2l1.8-6.2c.5-1.7 2-2.9 3.8-2.9h3.6c1.6 0 3.1 1 3.7 2.5l1.6 4.1h7.1c2.9 0 5.2 2.3 5.2 5.2v5.8c0 2.9-2.3 5.2-5.2 5.2H22.7c-2.9 0-5.2-2.3-5.2-5.2v-3.5z"
        fill={`url(#${uid}-skin)`}
      />
      {/* index */}
      <path
        d="M27.2 28.5V12.2c0-3 2.3-5.4 5.2-5.4 2.8 0 5.1 2.4 5.1 5.4v16.3"
        fill={`url(#${uid}-skin)`}
      />
      {/* middle */}
      <path
        d="M37.2 28.5V10.5c0-3.1 2.4-5.6 5.4-5.6 2.9 0 5.3 2.5 5.3 5.6v18"
        fill={`url(#${uid}-skin)`}
      />
      {/* fingertip shine */}
      <circle cx="32.5" cy="11" r="2.2" fill={`url(#${uid}-shine)`} />
      <circle cx="42.6" cy="9.5" r="2.2" fill={`url(#${uid}-shine)`} />
      {/* V gap */}
      <path
        d="M36.8 15v11"
        stroke="#B87A4A"
        strokeOpacity="0.3"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* thumb */}
      <path
        d="M11.8 36.2c0-2.8 2.2-5 5-5H20v9.2h-3.2c-2.8 0-5-2.2-5-5z"
        fill={`url(#${uid}-skin)`}
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
    size === "lg" ? "w-[5.25rem] h-[5.25rem]" : size === "sm" ? "w-12 h-12" : "w-16 h-16";
  const icon =
    size === "lg" ? "w-12 h-12" : size === "sm" ? "w-7 h-7" : "w-9 h-9";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-2xl border transition btn-press",
        dim,
        selected
          ? "border-cyan-400/55 bg-gradient-to-b from-cyan-400/20 to-cyan-500/5 text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.2)]"
          : "border-white/12 bg-gradient-to-b from-white/[0.08] to-white/[0.02] text-white hover:from-white/[0.12]",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      <ChoiceIcon choice={choice} className={icon} />
      <span className="text-[10px] font-semibold tracking-wide leading-none opacity-90">
        {labels[choice]}
      </span>
    </button>
  );
}

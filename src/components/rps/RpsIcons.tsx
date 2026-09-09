"use client";

import { cn } from "@/lib/utils";
import type { RpsChoice } from "@/lib/rpsApi";
import { useI18n } from "@/lib/i18n/context";

/** 1:1 icons from reference illustration */

export function RockIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/rps/rock.png" alt="" className={className} draggable={false} aria-hidden />
  );
}

export function ScissorsIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/rps/scissors.png" alt="" className={className} draggable={false} aria-hidden />
  );
}

export function PaperIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/rps/paper.png" alt="" className={className} draggable={false} aria-hidden />
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
      <ChoiceIcon choice={choice} className={cn(icon, "object-contain")} />
      <span className="text-[10px] font-semibold tracking-wide text-white/85 leading-none">
        {labels[choice]}
      </span>
    </button>
  );
}

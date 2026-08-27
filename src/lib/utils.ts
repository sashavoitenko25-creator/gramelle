import { COLORS } from "./constants";

export function formatGram(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return Number(n).toFixed(2);
}

export function randomColor(used: string[] = []): string {
  const available = COLORS.filter((c) => !used.includes(c));
  const pool = available.length ? available : COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatTime(date: Date): string {
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

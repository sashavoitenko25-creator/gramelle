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

export function formatTime(date: Date, lang: "ru" | "en" = "ru"): string {
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (lang === "ru") {
    if (diff < 60) return "только что";
    if (diff < 3600) return Math.floor(diff / 60) + " мин назад";
    if (diff < 86400) return Math.floor(diff / 3600) + " ч назад";
    return date.toLocaleDateString("ru-RU", { month: "short", day: "numeric" });
  }
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Accept "1,2" / "1.2" / " 1,20 " → number. Empty → NaN. */
export function parseAmountInput(raw: string): number {
  const s = String(raw ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Keep only valid decimal typing chars (digits, one dot or comma). */
export function sanitizeAmountInput(raw: string): string {
  let s = String(raw ?? "").replace(/[^0-9.,]/g, "");
  // unify: allow one separator
  const comma = s.indexOf(",");
  const dot = s.indexOf(".");
  if (comma >= 0 && dot >= 0) {
    // keep first separator, drop the other type
    if (comma < dot) s = s.replace(/\./g, "");
    else s = s.replace(/,/g, "");
  }
  const sep = s.includes(",") ? "," : s.includes(".") ? "." : null;
  if (sep) {
    const i = s.indexOf(sep);
    s = s.slice(0, i + 1) + s.slice(i + 1).replace(/[.,]/g, "");
  }
  return s;
}

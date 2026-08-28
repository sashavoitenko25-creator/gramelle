import { getBotToken } from "./telegram";

/**
 * Send a Telegram message to a user (best-effort, never throws).
 */
export async function notifyUser(
  telegramId: number | string,
  text: string,
  extra?: { parseMode?: "HTML" | "Markdown" }
): Promise<boolean> {
  try {
    const token = getBotToken();
    if (!token || !telegramId) return false;
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramId,
          text,
          parse_mode: extra?.parseMode || "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function fmtAmount(n: number, unit: string) {
  return `${Number(n).toFixed(2)} ${unit}`;
}

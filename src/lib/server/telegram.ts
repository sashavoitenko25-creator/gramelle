import crypto from "crypto";

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface ValidatedInitData {
  user: TelegramWebAppUser;
  authDate: number;
  startParam?: string;
  queryId?: string;
  raw: Record<string, string>;
}

/**
 * Validates Telegram Mini App initData (HMAC-SHA256).
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86400
): ValidatedInitData {
  if (!initData || !botToken) {
    throw new Error("Missing initData or bot token");
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("No hash in initData");

  params.delete("hash");

  const entries: string[] = [];
  params.forEach((value, key) => {
    entries.push(`${key}=${value}`);
  });
  entries.sort();
  const dataCheckString = entries.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculated = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const hashBuf = Buffer.from(hash, "hex");
  const calcBuf = Buffer.from(calculated, "hex");
  if (
    hashBuf.length !== calcBuf.length ||
    !crypto.timingSafeEqual(hashBuf, calcBuf)
  ) {
    throw new Error("Invalid initData signature");
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate) throw new Error("Missing auth_date");
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age > maxAgeSec) throw new Error("initData expired");

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("No user in initData");

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    throw new Error("Invalid user JSON");
  }
  if (!user?.id) throw new Error("Invalid user id");

  const raw: Record<string, string> = {};
  params.forEach((v, k) => {
    raw[k] = v;
  });

  return {
    user,
    authDate,
    startParam: params.get("start_param") || undefined,
    queryId: params.get("query_id") || undefined,
    raw,
  };
}

export function getBotToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return t;
}

/** Extract initData from Authorization: tma <initData> or x-telegram-init-data */
export function extractInitData(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("tma ")) return auth.slice(4).trim();
  return req.headers.get("x-telegram-init-data");
}

export async function requireTelegramUser(req: Request): Promise<ValidatedInitData> {
  const initData = extractInitData(req);
  if (!initData) throw new AuthError("Missing Telegram auth");
  try {
    return validateInitData(initData, getBotToken());
  } catch (e) {
    throw new AuthError(e instanceof Error ? e.message : "Auth failed");
  }
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

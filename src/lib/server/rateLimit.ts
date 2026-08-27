/**
 * Simple in-memory rate limiter (per serverless instance).
 * Good enough for Hobby; for multi-instance use Upstash later.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  let e = buckets.get(key);
  if (!e || e.resetAt <= now) {
    e = { count: 0, resetAt: now + windowMs };
    buckets.set(key, e);
  }
  e.count += 1;
  const remaining = Math.max(0, limit - e.count);
  if (e.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((e.resetAt - now) / 1000),
    };
  }
  return { ok: true, remaining, retryAfterSec: 0 };
}

/** Cleanup old keys occasionally */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }, 60_000).unref?.();
}

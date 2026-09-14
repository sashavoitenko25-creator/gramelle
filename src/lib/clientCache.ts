/** Short-lived in-memory cache for list endpoints (tab switches feel instant). */

type Entry = { exp: number; data: unknown };

const store = new Map<string, Entry>();

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) {
    store.delete(key);
    return null;
  }
  return e.data as T;
}

export function cacheSet(key: string, data: unknown, ttlMs = 4000) {
  store.set(key, { exp: Date.now() + ttlMs, data });
}

export function cacheInvalidate(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

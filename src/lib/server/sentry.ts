/**
 * Optional Sentry capture via envelope HTTP API (no heavy SDK required).
 * Set SENTRY_DSN=https://<key>@oXXXX.ingest.sentry.io/YYYY
 */

export async function captureException(
  err: unknown,
  context: Record<string, unknown> = {}
): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const u = new URL(dsn);
    // dsn: https://PUBLIC_KEY@HOST/PROJECT_ID
    const publicKey = u.username;
    const projectId = u.pathname.replace(/^\//, "");
    const host = u.host;
    const error = err instanceof Error ? err : new Error(String(err));
    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: Date.now() / 1000,
      platform: "node",
      level: "error",
      server_name: process.env.VERCEL_URL || "gramelle",
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "production",
      exception: {
        values: [
          {
            type: error.name,
            value: error.message,
            stacktrace: error.stack
              ? {
                  frames: error.stack
                    .split("\n")
                    .slice(1, 12)
                    .map((line) => ({ filename: line.trim() })),
                }
              : undefined,
          },
        ],
      },
      tags: context,
      extra: context,
    };
    const url = `https://${host}/api/${projectId}/store/?sentry_version=7&sentry_key=${publicKey}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {});
  } catch {
    // never throw from logger
  }
}

export async function trackEvent(
  name: string,
  props: Record<string, unknown> = {}
): Promise<void> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const { getAdminClient, isSupabaseConfigured } = await import("./supabase");
    if (!isSupabaseConfigured()) return;
    const db = getAdminClient();
    await db.from("analytics_events").insert({
      name,
      props,
    });
  } catch {
    // ignore
  }
}

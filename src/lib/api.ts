function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData || "";
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const initData = getInitData();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (initData) {
    headers.set("Authorization", `tma ${initData}`);
    headers.set("x-telegram-init-data", initData);
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `HTTP ${res.status}`
    );
  }
  return data as T;
}

export async function fetchSession() {
  return apiFetch<{
    ok: boolean;
    demo?: boolean;
    profile?: {
      id: string;
      username: string;
      balance: number;
      referral_code: string;
      ref_earned: number;
      ref_count: number;
      photo_url?: string | null;
      biggest_win?: number;
      wins?: number;
      games?: number;
      ref_active?: number;
      wager_remaining?: number;
      ref_turnover?: number;
    };
    user?: { telegramId: number; username: string };
  }>("/api/auth/session", { method: "POST", body: "{}" });
}

export async function createTonPending(ton: number) {
  return apiFetch<{
    ok: boolean;
    memo: string;
    gram: number;
    expiresAt?: string;
    deposit?: { id: string; expires_at?: string };
  }>("/api/ton/pending", {
    method: "POST",
    body: JSON.stringify({ ton }),
  });
}

export async function checkTonDeposits() {
  return apiFetch<{
    ok: boolean;
    credited: Array<{ memo: string; gram: number }>;
    message?: string;
    error?: string;
  }>("/api/ton/check", { method: "POST", body: "{}" });
}

export async function requestWithdraw(amountTon: number, wallet: string) {
  return apiFetch<{
    ok: boolean;
    balance: number;
    withdrawal: { id: string; amount_ton: number; status: string };
  }>("/api/withdraw", {
    method: "POST",
    body: JSON.stringify({ amountTon, wallet }),
  });
}

export async function fetchLedger(limit = 50) {
  return apiFetch<{
    items: Array<{
      id: string;
      amount: number;
      balance_after: number;
      reason: string;
      meta: Record<string, unknown>;
      created_at: string;
    }>;
    demo?: boolean;
  }>(`/api/ledger?limit=${limit}`);
}

export async function fetchWithdrawals() {
  return apiFetch<{
    items: Array<{
      id: string;
      amount_ton: number;
      amount_gram: number;
      wallet_address: string;
      status: string;
      created_at: string;
      tx_hash?: string;
    }>;
  }>("/api/withdraw");
}

export async function withdrawReferralSavings(amount?: number) {
  return apiFetch<{
    ok: boolean;
    balance: number;
    refEarned: number;
    withdrawn: number;
    minWithdraw: number;
  }>("/api/referral/withdraw", {
    method: "POST",
    body: JSON.stringify(amount != null ? { amount } : {}),
  });
}

export async function fetchTasks() {
  return apiFetch<{
    ok: boolean;
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      channel: string;
      channelLink: string;
      rewardGram: number;
      completed: boolean;
    }>;
  }>("/api/tasks");
}

export async function claimTask(taskId: string) {
  return apiFetch<{
    ok: boolean;
    completed: boolean;
    rewardGram: number;
    balance: number;
    taskId: string;
  }>("/api/tasks/claim", {
    method: "POST",
    body: JSON.stringify({ taskId }),
  });
}

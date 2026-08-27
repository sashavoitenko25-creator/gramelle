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
    };
    user?: { telegramId: number; username: string };
  }>("/api/auth/session", { method: "POST", body: "{}" });
}

export async function placeBetApi(
  amount: number,
  color?: string,
  mode?: string
) {
  return apiFetch<{
    ok: boolean;
    balance: number;
    round: {
      id: string;
      rollId: number;
      mode: string;
      status: string;
      totalBank: number;
      countdownEndsAt?: string;
      serverSeedHash: string;
    };
    bets: Array<{
      telegramId: number;
      username: string;
      amount: number;
      color: string;
      isMe: boolean;
    }>;
  }>("/api/bet", {
    method: "POST",
    body: JSON.stringify({ amount, color, mode }),
  });
}

export async function fetchRoundState(mode: string = "classic") {
  return apiFetch<{
    round: {
      id: string;
      rollId: number;
      mode: string;
      status: string;
      totalBank: number;
      countdownEndsAt?: string;
      serverSeedHash?: string;
      spinDegrees?: number;
      winnerTelegramId?: number;
      houseFee?: number;
      potAfterFee?: number;
    } | null;
    bets: Array<{
      telegramId: number;
      username: string;
      amount: number;
      color: string;
    }>;
    spinResult?: {
      rollId: number;
      spinDegrees: number;
      winnerTelegramId: number;
      winnerUsername: string;
      mult: number;
      total: number;
      potAfterFee: number;
      houseFee: number;
      serverSeed: string;
      serverSeedHash: string;
    };
    demo?: boolean;
  }>(`/api/round/state?mode=${encodeURIComponent(mode)}`);
}

export async function requestSpin(mode: string = "classic") {
  return apiFetch<{
    ok: boolean;
    spinDegrees: number;
    mult: number;
    houseFee: number;
    potAfterFee: number;
    winner: { telegramId: number; username: string; amount: number };
    total: number;
    rollId: number;
    serverSeed?: string;
    serverSeedHash?: string;
    bets?: Array<{
      telegramId: number;
      username: string;
      amount: number;
      color: string;
    }>;
  }>("/api/round/spin", {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export async function fetchRooms() {
  return apiFetch<{
    rooms: Array<{
      id: string;
      name: string;
      description: string;
      minBet: number;
      maxBet: number;
      houseEdge: number;
      maxPlayers: number;
      countdownSec: number;
      players: number;
      bank: number;
      status: string;
      rollId: number | null;
    }>;
  }>("/api/rooms");
}

export async function createTonPending(ton: number) {
  return apiFetch<{
    ok: boolean;
    memo: string;
    gram: number;
    deposit: { id: string };
  }>("/api/ton/pending", {
    method: "POST",
    body: JSON.stringify({ ton }),
  });
}

export async function checkTonDeposits() {
  return apiFetch<{
    ok: boolean;
    credited: Array<{ memo: string; gram: number }>;
    error?: string;
  }>("/api/ton/check", { method: "POST", body: "{}" });
}

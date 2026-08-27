# Gramelle — Premium PvP Roulette

Telegram Mini App with **server-authoritative** balance, bets, and spin.

## Phase 1 security model

| Layer | How |
|-------|-----|
| Auth | `initData` HMAC verified on every API call |
| Balance | Only via `ledger` + service role (never from client) |
| Stars | Bot webhook `successful_payment` → credit |
| TON | Memo intent + TonAPI match → credit |
| Spin | Server seed + HMAC RNG, result returned to clients |

## Setup

```bash
npm install
cp .env.example .env.local
# fill keys
```

Run SQL in Supabase: `supabase/schema.sql`

```bash
npm run dev
```

### Env

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | DB |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | public read |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server writes |
| `TELEGRAM_BOT_TOKEN` | yes | initData + Stars invoices |
| `TELEGRAM_WEBHOOK_SECRET` | recommended | webhook auth |
| `NEXT_PUBLIC_TON_WALLET` | for TON | deposit address |
| `TONAPI_KEY` | recommended | on-chain verify |

### Webhook (Stars)

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR_DOMAIN/api/webhooks/telegram&secret_token=YOUR_SECRET
```

## API

| Route | Auth | Role |
|-------|------|------|
| `POST /api/auth/session` | initData | upsert profile, return balance |
| `POST /api/bet` | initData | debit + join round |
| `GET /api/round/state` | — | current round + auto-spin if due |
| `POST /api/round/spin` | initData | force spin after countdown |
| `POST /api/stars-invoice` | initData | create XTR invoice |
| `POST /api/webhooks/telegram` | secret | Stars credit |
| `POST /api/ton/pending` | initData | register memo |
| `POST /api/ton/check` | initData | match chain + credit |

## Demo mode

Without Supabase / bot token / outside Telegram, the app falls back to localStorage (client-only). Production requires full env + opening inside Telegram.

## Deploy

Vercel + set env + run schema.sql + setWebhook.

## Phase 2 — Multiplayer rooms

- Rooms: **Classic** (0.1+) and **High** (10+)
- Server authority spin (optimistic lock via `status` + `version`)
- Same `spinDegrees` for all clients (seed-derived)
- House edge 2% from bank before payout
- Betting closed in last 1s of countdown
- Cron tick: `/api/round/tick` every minute (`vercel.json`)

Run migration: `supabase/phase2.sql`

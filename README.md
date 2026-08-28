# Gramelle — Premium PvP Roulette

Telegram Mini App with **server-authoritative** balance, bets, and spin.

## Rules (canonical)

| Setting | Value |
|---------|-------|
| Min bet (Classic) | **0.25 GRAM** |
| Min bet (High) | **10 GRAM** |
| House edge | **5%** of bank (winner receives 95%) |
| Max players | Classic 10 / High 8 |
| Countdown | 8s / 10s after 2+ players |

## Security model

| Layer | How |
|-------|-----|
| Auth | `initData` HMAC verified on every mutating API call |
| Balance | Ledger + optimistic lock (`balance_version`) — never from client |
| Stars | Bot webhook `successful_payment` → credit |
| TON deposit | Memo intent + TonAPI match → credit |
| TON withdraw | Debit + queue; admin completes on-chain |
| Spin | Server seed (hash committed) + HMAC RNG; same `spinDegrees` for all |
| Provably Fair | `GET /api/verify?rollId=` recomputes winner from published seed |

## Setup

```bash
npm install
cp .env.example .env.local   # if present — fill keys
```

Run SQL in Supabase (in order):

1. `supabase/schema.sql`
2. `supabase/phase2.sql`
3. `supabase/phase3.sql`
4. `supabase/phase5.sql`
5. `supabase/phase6_economy.sql`
6. `supabase/phase7_fair_atomic.sql`  ← balance_version + verify index

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
| `CRON_SECRET` | recommended | protect `/api/round/tick` |
| `CRON_STRICT` | optional | `1` = only cron may tick |

### Webhook (Stars)

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR_DOMAIN/api/webhooks/telegram&secret_token=YOUR_SECRET
```

### Vercel Cron

`vercel.json` schedules `/api/round/tick` every minute so rounds spin even if all clients leave.

## API (main)

| Route | Auth | Role |
|-------|------|------|
| `POST /api/auth/session` | initData | upsert profile, return balance |
| `POST /api/bet` | initData | debit + join round |
| `GET /api/round/state` | — | current round + auto-spin if due |
| `POST /api/round/spin` | initData | force spin after countdown |
| `GET /api/round/tick` | optional cron | authority tick all rooms |
| `GET /api/verify?rollId=` | — | **public** provably-fair check |
| `POST /api/stars-invoice` | initData | create XTR invoice |
| `POST /api/webhooks/telegram` | secret | Stars credit |
| `POST /api/ton/pending` | initData | register memo |
| `POST /api/ton/check` | initData | match chain + credit |
| `POST /api/withdraw` | initData | queue TON withdrawal |

## Demo mode

Without Telegram `initData` / Supabase, the app falls back to localStorage (client-only).  
**Production** requires full env + opening inside Telegram. Demo must not be treated as real money.

## Deploy

1. Vercel + set all env vars  
2. Run all SQL migrations  
3. Set Telegram webhook  
4. Confirm Vercel Cron is enabled (Pro plan for `* * * * *` on some tiers; otherwise use external cron hitting `/api/round/tick` with `CRON_SECRET`)

## Fairness (how to verify a round)

1. Before spin, UI shows `hash` = SHA256(server_seed).  
2. After spin, seed is revealed.  
3. Open **Verify** (tap the hash) or call `GET /api/verify?rollId=N`.  
4. Check: `SHA256(serverSeed) === serverSeedHash` and recomputed winner matches claimed winner.

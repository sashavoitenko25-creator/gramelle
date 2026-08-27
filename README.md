# Gramelle — Premium PvP Roulette

Telegram Mini App with **server-authoritative** balance, bets, and spin.

## Phase 1–2 (done)

- initData HMAC on every API call
- Ledger + service role only balance writes
- Stars webhook + TON memo/TonAPI
- Server seed RNG, rooms Classic / High, house edge 2%
- Client-driven tick (Hobby-safe: **no minute cron**)

## Phase 3 — Economy

| Feature | Implementation |
|---------|----------------|
| Rates | `GRAM_PER_TON = 1` (1:1), Stars via env |
| House edge | 2% in room config |
| Withdraw | `POST /api/withdraw` → pending row + debit ledger |
| Min/max | deposits packages + withdraw 1–200 TON |
| Ledger API | `GET /api/ledger` |
| Referral | join bonus + **5% of deposits** |

Run SQL: `supabase/schema.sql` → `phase2.sql` → **`phase3.sql`**

## Phase 4 — UX

- Spin / win / lose sounds (WebAudio)
- Confetti on win
- TON icon on balance (not $)
- Onboarding sheet
- Skeleton loading
- Profile winrate / biggest win
- Telegram light/dark class hook
- Wheel colors **frozen** during spin (no flash)

## Setup

```bash
npm install
cp .env.example .env.local   # or fill env in Vercel
# run all SQL in Supabase
npm run dev
```

### Env

| Variable | Required |
|----------|----------|
| NEXT_PUBLIC_SUPABASE_URL | yes |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | yes |
| SUPABASE_SERVICE_ROLE_KEY | yes |
| TELEGRAM_BOT_TOKEN | yes |
| TELEGRAM_WEBHOOK_SECRET | recommended |
| NEXT_PUBLIC_TON_WALLET | TON deposits |
| TONAPI_KEY | recommended |
| NEXT_PUBLIC_GRAM_PER_STAR | optional (default 1) |
| NEXT_PUBLIC_GRAM_PER_TON | optional (default 1) |

### Webhook

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR_DOMAIN/api/webhooks/telegram&secret_token=YOUR_SECRET
```

### Vercel Hobby

Keep `vercel.json` as `{}`. Minute crons are rejected on Hobby.  
Spin authority is driven by clients via `/api/round/state` + `/api/round/spin`.

### Withdrawals

Users request TON withdraw → status `pending`.  
Process in Supabase: set `status=completed`, fill `tx_hash` after you send TON from your hot wallet.

## Deploy

Vercel + env + SQL migrations + setWebhook.

## Phase 5 — Infra

| Feature | How |
|---------|-----|
| Rate limit | In-memory on bet / withdraw / stars / ton (per telegram id) |
| Admin panel | `/admin` + header `x-admin-secret: ADMIN_SECRET` |
| Bans | `profiles.banned` checked on bet/withdraw/ton |
| Sentry | Optional `SENTRY_DSN` — errors posted to Sentry store API |
| Analytics | `analytics_events` table (deposits/withdraws tracked from admin) |
| CI | `.github/workflows/ci.yml` — lint + build on push |

### Admin

1. Set `ADMIN_SECRET` in Vercel env (long random string)
2. Open `https://YOUR_DOMAIN/admin`
3. Paste secret → manage withdrawals (Complete / Reject+refund), bans, stats

### Staging

Create a second Vercel project pointing to the same repo with different env:
- different `TELEGRAM_BOT_TOKEN` (staging bot)
- different Supabase project (or schema)
- different `ADMIN_SECRET`

### SQL

Run `supabase/phase5.sql` after phase3.

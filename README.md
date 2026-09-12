# Gramelle — PvP Rock-Paper-Scissors on TON

Telegram Mini App. Server-authoritative balances. Game: **RPS only**.

## Stack
- Next.js App Router + React 19 + TypeScript
- Supabase (service role on server)
- Telegram Mini App (initData auth)
- TON Connect deposits + manual withdrawals
- Deploy: Vercel

## Security
| Layer | How |
|-------|-----|
| Auth | Telegram initData HMAC on every mutating route |
| Balance | Ledger + `balance_version` optimistic lock |
| Ban | `assertNotBanned` on RPS, withdraw, TON pending |
| TON in | Memo intent + TonAPI match (`/api/ton/process` cron) |
| TON out | Debit + queue; admin completes on-chain |
| RPS fair | Commit-reveal: choice hash + server seed/hash |
| Rate limits | Per-user on create / join / withdraw |

## SQL (Supabase, in order)
1. `supabase/schema.sql` (base profiles/ledger/withdrawals if empty)
2. `supabase/rps.sql`
3. `supabase/tasks.sql` / `wager.sql` if needed
4. `supabase/cleanup_spin.sql` — drop Spin tables
5. `supabase/production_hardening.sql` — indexes + ban columns

## Env (Vercel)
**Required:** `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_TON_WALLET`, `TONAPI_KEY`

**Recommended:** `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_ID`, `ADMIN_SECRET`, task channel vars

## Cron
- Vercel: `vercel.json` → `/api/ton/process` every minute
- Or cron-job.org with header `Authorization: Bearer $CRON_SECRET`

## Health
`GET /api/health`

## Local
```bash
npm install
npm run build
npm run dev
```

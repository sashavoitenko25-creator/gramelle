# Gramelle production hardening

## Included app replacements

Replace these files from the archive:

- `src/lib/server/round.ts`
- `src/hooks/useRound.ts`
- `src/app/api/round/state/route.ts`

The Spin changes keep the wheel/result/history flow intact while fixing the stale-lobby path, making same-user concurrent bet updates compare-and-set based, eagerly creating the next OPEN room, and marking round state responses as `no-store`.

## Supabase action required

Run `supabase/production_hardening.sql` in the Supabase SQL editor after checking current data. Do not blindly force the partial unique active-round index until duplicate active rounds have been checked.

The migration changes only the default for NEW profiles to balance 0; existing balances are untouched.

## Vercel / recovery action required

Current `vercel.json` is intentionally left alone because Vercel Hobby can reject a once-per-minute cron. The server tick endpoint already supports both Classic and High when called without `mode`.

For real automatic recovery, configure an external cron service (for example cron-job.org) to call:

`https://gramelle-gamma.vercel.app/api/round/tick`

once per minute.

Recommended production setup:
- set `CRON_SECRET` in Vercel;
- set `CRON_STRICT=1` if only the external scheduler should call tick;
- send `Authorization: Bearer <CRON_SECRET>` from the scheduler.

## Environment / infrastructure checks

Verify in Vercel that all production environment variables are present, especially Supabase server credentials, Telegram auth settings, TON settings, Stars settings, wallet/withdraw settings and (when using external cron) `CRON_SECRET`.

Do not paste secrets into chat.

## Validation after deploy

Run locally:

`npm ci`
`npm run lint`
`npm run build`

Then test at least:
- 1 player waiting
- 2 players -> exactly 20s countdown
- 5 and 25 players
- two rapid clicks from the same player
- two different players betting simultaneously
- bet immediately after a finished spin
- refresh during spin
- switch Classic <-> High during spin
- RPS create/join/play/recovery
- TON deposit, Stars payment, withdrawal
- referral and tasks
- admin actions

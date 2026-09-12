# Что сделать тебе (код уже подготовлен)

Без этих шагов «100%» невозможно — это доступы, которые есть только у тебя.

## 1. GitHub (10 мин)
```bat
cd C:\Users\PROCAD\gramelle
git add -A
git status
git commit -m "prod: RPS-only, hardening, cron, health"
git push origin main
```
Убедись, что на GitHub **нет** папок `api/round`, `api/bet`, `stars-invoice`.

## 2. Vercel (10 мин)
- Deploy с `main`
- Environment Variables (Production):
  - TELEGRAM_BOT_TOKEN
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - NEXT_PUBLIC_TON_WALLET = твой реальный кошелёк
  - TONAPI_KEY
  - CRON_SECRET = длинная случайная строка
  - TELEGRAM_WEBHOOK_SECRET = случайная строка
  - ADMIN_TELEGRAM_ID = твой telegram id
  - ADMIN_SECRET (для /admin)
- Redeploy после сохранения env

## 3. Supabase SQL (5 мин)
В SQL Editor по порядку:
1. `supabase/cleanup_spin.sql` (если ещё не)
2. `supabase/production_hardening.sql`

Проверка:
```sql
select table_name from information_schema.tables
where table_schema='public' order by 1;
```
Должны быть: profiles, ledger, withdrawals, ton_deposits, rps_rooms, rps_history, task_completions  
Не должно быть: rounds, round_bets, game_history

## 4. Telegram Bot (10 мин)
Webhook:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://gramelle-gamma.vercel.app/api/webhooks/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```
Mini App URL в BotFather = `https://gramelle-gamma.vercel.app`

## 5. Cron
- Vercel Cron из vercel.json **или**
- cron-job.org: URL `/api/ton/process`, каждую 1 мин, Header `Authorization: Bearer CRON_SECRET`

## 6. Живой прогон (30 мин) — обязательно
1. Два аккаунта Telegram
2. Депозит мелкий TON → memo → ждать cron → баланс+
3. RPS: win / lose / draw → баланс сам
4. Заявка на вывод → админ approve
5. Рефералка, tasks
6. Ban тестового юзера → не может играть

## 7. Юридика / продукт (ты)
- Текст 18+ / правила в канале
- Время выводов (например «до 24ч»)
- Канал поддержки
- Не обещать «гарантированный доход»

## Готово, когда
- [ ] Push + зелёный Vercel deploy
- [ ] SQL hardening выполнен
- [ ] Webhook set
- [ ] Cron 200 OK с Bearer
- [ ] Депозит и вывод прошли на реальных TON
- [ ] 2 игрока сыграли RPS без багов

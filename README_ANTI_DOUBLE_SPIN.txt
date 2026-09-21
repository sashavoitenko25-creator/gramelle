ANTI DOUBLE-SPIN FIX (LIVE Roulette + Paravoz)
==============================================

Что было:
- При гонках (много клиентов + cron) могли появиться 2 live-раунда
  (betting/spinning). Клиент анимировал два спина подряд → стрик
  «паравоза» мог сбрасываться / выглядеть сломанным.
- Выплаты: settle уже был атомарным, но при двух раундах paravoz
  мог отработать на «лишнем» id.

Что сделано (раз и навсегда):

1) SQL (ОБЯЗАТЕЛЬНО выполнить в Supabase):
   sql/roulette_anti_double_spin.sql
   - UNIQUE INDEX: в таблице максимум 1 строка со status betting|spinning
   - last_round_id для paravoz
   - чистка уже существующих orphan-раундов

2) Server (src/lib/server/roulette.ts):
   - createBettingRound не создаёт второй live-раунд
   - advanceRoulette: claim betting→spinning и spinning→settled
   - новый betting только после result_ends_at и если live нет
   - orphan-раунды принудительно settled

3) Client (RouletteScreen.tsx):
   - один spin на round.id навсегда (spunHistory + spinLock)
   - очередь только на ДРУГОЙ round id
   - пауза 120ms между chained spins (не выглядит как double)

4) ROULETTE_RESULT_MS = 8500 (чуть длиннее показ результата)

Установка:
1. Supabase → SQL Editor → выполнить sql/roulette_anti_double_spin.sql
2. Распаковать zip поверх корня проекта (заменить файлы)
3. Deploy (Vercel) / npm run build

Проверка:
- Открыть LIVE двумя аккаунтами, 20+ раундов подряд
- Рулетка крутится ровно один раз за раунд
- Паравоз +1 только при угадывании, сброс только при промахе/пропуске
- Выплаты red/black x2, green x14 — без двойного credit

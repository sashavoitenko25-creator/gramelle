# Live PvP Roulette (аватарки) — установка

Новая игра **рядом** с цветовой LIVE Roulette. Существующий код RPS / Dice / color Roulette **не ломается**.

## Шаги

1. **Распакуй zip поверх корня проекта** (merge folders).

2. **Supabase → SQL Editor** → выполни файл:
   ```
   supabase/pvp_roulette.sql
   ```

3. **Патч page.tsx** (из корня проекта):
   ```bash
   node apply_page_patch.js
   ```
   Если скрипт не сработал — правь вручную по `PATCHES.md`.

4. Файлы `src/lib/types.ts` и `src/components/screens/LiveHubScreen.tsx`
   уже в zip в пропатченном виде — просто перезапишут ваши (изменения только
   `pvp_roulette` screen + карточка в Live hub).

5. **Деплой** (Vercel) + при желании cron каждые 5–10 сек:
   ```
   GET /api/pvp-roulette/process
   Authorization: Bearer $CRON_SECRET
   ```
   Без cron игра тоже идёт: клиенты дёргают `/api/pvp-roulette/state`.

6. В приложении: **Играть → LIVE → PvP Рулетка**.

## Что внутри

| Путь | Назначение |
|------|------------|
| `supabase/pvp_roulette.sql` | Таблицы rounds + bets |
| `src/lib/pvpRouletteConstants.ts` | Лимиты, таймеры, 5% fee |
| `src/lib/server/pvpRoulette.ts` | Server-authoritative логика + commit-reveal |
| `src/lib/pvpRouletteApi.ts` | Клиентский API |
| `src/app/api/pvp-roulette/*` | bet / state / process / history |
| `src/components/screens/PvpRouletteScreen.tsx` | UI + анимация ленты аватарок |

## Правила (кратко)

- Мин. 2 игрока, макс. 16  
- Одна ставка на игрока (можно увеличить до закрытия таймера)  
- После 2-го игрока — 18 сек таймер  
- Победитель = пропорционально ставкам (HMAC-SHA256 seed)  
- Выплата: bank × 0.95, 5% → house_fee + referral  
- Если к концу таймера < 2 игроков — отмена + refund  

## Честность

До закрытия ставок виден `server_seed_hash`.  
После finish раскрывается `server_seed`.  
Клиент может пересчитать `pickWinnerIndex` (логика в `src/lib/server/pvpRoulette.ts`).

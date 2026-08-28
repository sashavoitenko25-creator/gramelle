# Gramelle — Rock Paper Scissors (full)

## 1. SQL (обязательно)

В Supabase SQL Editor выполни:

```
supabase/rps.sql
```

Создаст таблицы `rps_rooms` и `rps_history`.

## 2. Распакуй ZIP поверх корня проекта

Файлы:

```
src/app/page.tsx
src/app/api/rps/list/route.ts
src/app/api/rps/create/route.ts
src/app/api/rps/cancel/route.ts
src/app/api/rps/join/route.ts
src/app/api/rps/state/route.ts
src/app/api/rps/history/route.ts
src/lib/server/rps.ts
src/lib/rpsApi.ts
src/lib/rpsConstants.ts
src/components/screens/RpsScreen.tsx
src/components/rps/RpsIcons.tsx
```

(Меню игр / BottomNav / types из прошлого патча уже должны быть.)

## 3. Как работает

**Создать комнату**
- Выбираешь Rock / Paper / Scissors
- Вводишь ставку
- Создаётся комната, ставка списывается
- Выбор **захеширован** (`sha256(choice:nonce)`) — публичный commit
- Можно отменить → полный refund

**Присоединиться**
- Видишь список open rooms + hash создателя
- Выбираешь свой ход
- Ставка списывается
- Сразу статус `playing`, анимация ~11 сек
- После `reveal_at` сервер финализирует: win / draw, ledger, history

**Честность**
- `creator_choice_hash` виден до join
- После игры: `choice`, `nonce`, `server_seed` — можно проверить hash
- House edge 5% с банка (2×ставка); при ничьей — полный возврат обеим

**API**
| Route | Method |
|-------|--------|
| `/api/rps/list` | GET |
| `/api/rps/create` | POST `{ choice, amount }` |
| `/api/rps/cancel` | POST `{ roomId }` |
| `/api/rps/join` | POST `{ roomId, choice }` |
| `/api/rps/state?id=` | GET |
| `/api/rps/history` | GET |

## 4. Deploy

После SQL + файлов — задеплой на Vercel. RPS работает только в server mode (внутри Telegram с Supabase).

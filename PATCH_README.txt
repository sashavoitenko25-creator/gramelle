# Gramelle patch — Dice history + permanent # + UI

1. Распакуй ZIP поверх корня проекта (рядом с package.json).
2. В Supabase SQL Editor выполни ОДИН раз:
   supabase/game_history_numbers.sql
   (если ещё не выполнял — даёт постоянные game_no для RPS и Dice).
3. npm run build / git push / Vercel deploy.

Что сделано:
- Dice история: вкладки Все / Мои игры как в RPS
- В Моих играх номер # = глобальный game_no (DICE#5, DICE#16), не 1,2
- То же для RPS (используется game_no из БД, fallback если колонки нет)
- Кнопка + депозита в Dice как в RPS (градиент + иконка)
- Счётчики онлайна: опрос каждые 2с вместо 5с
- На карточке Dice во вкладке Play бейдж New

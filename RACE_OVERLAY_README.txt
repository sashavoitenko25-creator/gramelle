Gramelle Race — overlay (только игра Race)
==========================================

Старт: шарики внутри ФИЗИЧЕСКОГО КРУГА (кольцо).
После таймера снизу открывается дырка → шарики выпадают на трассу.

Трасса в стиле @myballs:
- платформы
- синие кресты (X)
- сетка точек
- большие дуги
- бомбы 💣
- anti-gravity зона
- воронка + клетчатый FINISH

Как применить:
1. Распакуй этот zip ПОВЕРХ корня своего проекта gramelle
   (файлы лягут в src/components/screens/RaceScreen.tsx и src/lib/raceConstants.ts)
2. git add / commit / push  или  redeploy на Vercel
3. Если таблицы Race ещё не созданы — в Supabase SQL Editor выполни sql/race_tables.sql

Не трогает RPS, Dice, XO и остальное.

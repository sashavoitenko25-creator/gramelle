# Gramelle — Games Menu Overlay

Распакуй этот архив **поверх** корня проекта (рядом с `src/`, `package.json` и т.д.).

Файлы перезапишут / добавят:

```
src/lib/types.ts
src/components/screens/GamesScreen.tsx   ← новый
src/components/screens/RpsScreen.tsx     ← новый
src/components/game/BottomNav.tsx
```

---

## Что нужно руками в `src/app/page.tsx`

### 1. Импорты (добавь рядом с остальными screens)

```tsx
import { GamesScreen } from "@/components/screens/GamesScreen";
import { RpsScreen } from "@/components/screens/RpsScreen";
```

### 2. Начальный экран

Найди:

```tsx
const [screen, setScreen] = useState<Screen>("pvp");
```

Замени на:

```tsx
const [screen, setScreen] = useState<Screen>("games");
```

### 3. Рендер экранов

Найди блок вида:

```tsx
{screen === "pvp" && (
  <PvpScreen ... />
)}
```

Замени / дополни на:

```tsx
{screen === "games" && (
  <GamesScreen
    onSelectSpin={() => {
      haptic("light");
      setScreen("pvp");
    }}
    onSelectRps={() => {
      haptic("light");
      setScreen("rps");
    }}
  />
)}

{screen === "pvp" && (
  <PvpScreen
    // все твои текущие props остаются как были
    ...
  />
)}

{screen === "rps" && (
  <RpsScreen onBack={() => setScreen("games")} />
)}
```

### 4. BottomNav уже обновлён

При клике на Play теперь открывается меню игр. Пока ты внутри SPIN или RPS — вкладка Play остаётся активной.

---

Готово. После распаковки + 4 правки в `page.tsx` — запускай.

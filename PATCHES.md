# PvP Live Roulette — integration patches

After unpacking this zip over your project, apply these **minimal** edits
to existing files (new game only — color roulette untouched).

---

## 1. `src/lib/types.ts`

Add `"pvp_roulette"` to the `Screen` union:

```ts
export type Screen =
  | "games"
  | "pvp"
  | "live"
  | "solo"
  | "roulette"
  | "pvp_roulette"   // ← add
  | "rps"
  ...
```

---

## 2. `src/components/screens/LiveHubScreen.tsx`

Add prop + card for the new game.

```ts
interface LiveHubScreenProps {
  onSelectRoulette: () => void;
  onSelectPvpRoulette?: () => void;  // ← add
  onBack?: () => void;
  liveOnline?: number;
}
```

In the component destructuring, add `onSelectPvpRoulette`.

After the existing Roulette button, add a second card (copy style, change title):

```tsx
{onSelectPvpRoulette && (
  <button
    type="button"
    onClick={onSelectPvpRoulette}
    className="group relative overflow-hidden rounded-[28px] text-left btn-press active:scale-[0.98] transition-all duration-200"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] via-[#4c1d95] to-[#831843]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_20%,rgba(167,139,250,0.4),transparent_55%)]" />
    <div className="relative p-5 min-h-[140px] flex flex-col justify-end">
      <div className="text-[22px] font-black tracking-tight text-white">
        {tr("PvP Roulette", "PvP Рулетка")}
      </div>
      <p className="mt-1 text-[13px] text-white/70">
        {tr("Player avatars · winner takes the bank", "Аватарки игроков · победитель забирает банк")}
      </p>
    </div>
  </button>
)}
```

---

## 3. `src/app/page.tsx`

**Import:**

```ts
import { PvpRouletteScreen } from "@/components/screens/PvpRouletteScreen";
```

**Live hub:**

```tsx
{screen === "live" && (
  <LiveHubScreen
    liveOnline={liveOnline}
    onBack={() => setScreen("games")}
    onSelectRoulette={() => {
      haptic("light");
      setScreen("roulette");
    }}
    onSelectPvpRoulette={() => {
      haptic("light");
      setScreen("pvp_roulette");
    }}
  />
)}
```

**Screen block** (after roulette block):

```tsx
{screen === "pvp_roulette" && telegramId != null && (
  <PvpRouletteScreen
    balance={balance}
    telegramId={telegramId}
    username={username}
    photoUrl={profile?.photo_url}
    onBack={() => setScreen("live")}
    onBalanceUpdate={(b) => setBalanceFromServer(b)}
    onReloadBalance={() => reloadProfile()}
    onDeposit={() => {
      haptic("light");
      /* open your deposit modal the same way as RouletteScreen */
    }}
    haptic={haptic}
    hapticSuccess={hapticSuccess}
    hapticError={hapticError}
    showToast={(msg) => { /* same toast helper as other screens */ }}
  />
)}
```

Match the exact `onDeposit` / `showToast` pattern from your `RouletteScreen` block.

---

## 4. Supabase

SQL Editor → run `supabase/pvp_roulette.sql`.

---

## 5. Cron (optional)

Poll `/api/pvp-roulette/process` every 5–10s (same secret as other crons).
Clients also advance state on GET `/api/pvp-roulette/state`.

---

Done. Color roulette, RPS, Dice, Race stay unchanged.

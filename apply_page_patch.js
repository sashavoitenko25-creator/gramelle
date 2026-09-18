/**
 * One-shot patcher for src/app/page.tsx — run from project root:
 *   node apply_page_patch.js
 * Safe: only adds PvP roulette wiring; does not remove anything.
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "src/app/page.tsx");
if (!fs.existsSync(file)) {
  console.error("src/app/page.tsx not found — run from project root after unpack");
  process.exit(1);
}
let t = fs.readFileSync(file, "utf8");
if (t.includes("PvpRouletteScreen")) {
  console.log("Already patched");
  process.exit(0);
}

if (!t.includes('from "@/components/screens/RouletteScreen"')) {
  console.error("Could not find RouletteScreen import");
  process.exit(1);
}

t = t.replace(
  'import { RouletteScreen } from "@/components/screens/RouletteScreen";',
  'import { RouletteScreen } from "@/components/screens/RouletteScreen";\nimport { PvpRouletteScreen } from "@/components/screens/PvpRouletteScreen";'
);

// Live hub props
const liveOld = `onSelectRoulette={() => {
            haptic("light");
            setScreen("roulette");
          }}
        />`;
const liveNew = `onSelectRoulette={() => {
            haptic("light");
            setScreen("roulette");
          }}
          onSelectPvpRoulette={() => {
            haptic("light");
            setScreen("pvp_roulette");
          }}
        />`;
if (!t.includes(liveOld)) {
  console.error("LiveHub block pattern not found — apply PATCHES.md manually");
  process.exit(1);
}
t = t.replace(liveOld, liveNew);

// Screen block after roulette
const rouletteEnd = `showToast={showToast}
        />
      )}

      {screen === "rps" && (`;
const insert = `showToast={showToast}
        />
      )}

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
            setDepositOpen(true);
          }}
          haptic={haptic}
          hapticSuccess={hapticSuccess}
          hapticError={hapticError}
          showToast={showToast}
        />
      )}

      {screen === "rps" && (`;
if (!t.includes(rouletteEnd)) {
  console.error("Roulette→RPS block not found — apply PATCHES.md manually");
  process.exit(1);
}
t = t.replace(rouletteEnd, insert);

fs.writeFileSync(file, t);
console.log("page.tsx patched OK");

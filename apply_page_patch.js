/**
 * Patch src/app/page.tsx for PvP Roulette in PVP hub (GamesScreen).
 * Run from project root: node apply_page_patch.js
 */
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "src/app/page.tsx");
if (!fs.existsSync(file)) {
  console.error("src/app/page.tsx not found");
  process.exit(1);
}
let t = fs.readFileSync(file, "utf8");

if (!t.includes("PvpRouletteScreen")) {
  t = t.replace(
    'import { RouletteScreen } from "@/components/screens/RouletteScreen";',
    'import { RouletteScreen } from "@/components/screens/RouletteScreen";\nimport { PvpRouletteScreen } from "@/components/screens/PvpRouletteScreen";'
  );
}

if (!t.includes("fetchPvpRouletteState")) {
  t = t.replace(
    'import { fetchRouletteState } from "@/lib/rouletteApi";',
    'import { fetchRouletteState } from "@/lib/rouletteApi";\nimport { fetchPvpRouletteState } from "@/lib/pvpRouletteApi";'
  );
}

if (!t.includes("pvpRouletteOnline")) {
  t = t.replace(
    "const [liveOnline, setLiveOnline] = useState(0);",
    "const [liveOnline, setLiveOnline] = useState(0);\n  const [pvpRouletteOnline, setPvpRouletteOnline] = useState(0);"
  );
}

if (!t.includes("setPvpRouletteOnline")) {
  const liveBlock = `        let liveN = 0;
        try {
          const live = await fetchRouletteState();
          liveN = Number(live?.online) || 0;
          setLiveOnline(liveN);
        } catch {
          /* keep */
        }

        setOnlineCount(rpsN + diceN + xoN + liveN);`;
  const liveNew = `        let liveN = 0;
        try {
          const live = await fetchRouletteState();
          liveN = Number(live?.online) || 0;
          setLiveOnline(liveN);
        } catch {
          /* keep */
        }

        let pvpN = 0;
        try {
          const pvp = await fetchPvpRouletteState({ presence: false });
          pvpN = Number(pvp?.online) || 0;
          setPvpRouletteOnline(pvpN);
        } catch {
          /* keep */
        }

        setOnlineCount(rpsN + diceN + xoN + liveN + pvpN);`;
  if (t.includes(liveBlock)) t = t.replace(liveBlock, liveNew);
  else console.warn("online block: apply pvp online manually");
}

// GamesScreen — add onSelectPvpRoulette + online
if (!t.includes("onSelectPvpRoulette")) {
  // try inject into GamesScreen block
  const gOld = `onSelectRps={() => {
            haptic("light");
            setScreen("rps");
          }}`;
  const gNew = `onSelectPvpRoulette={() => {
            haptic("light");
            setScreen("pvp_roulette");
          }}
          pvpRouletteOnline={pvpRouletteOnline}
          onSelectRps={() => {
            haptic("light");
            setScreen("rps");
          }}`;
  if (t.includes(gOld)) t = t.replace(gOld, gNew);
  else console.warn("GamesScreen onSelectRps not found");
} else if (!t.includes("pvpRouletteOnline={pvpRouletteOnline}")) {
  // already has select but maybe missing online on GamesScreen
  if (t.includes("onSelectPvpRoulette={() => {") && !t.includes("pvpRouletteOnline={pvpRouletteOnline}")) {
    t = t.replace(
      "onSelectPvpRoulette={() => {",
      "pvpRouletteOnline={pvpRouletteOnline}\n          onSelectPvpRoulette={() => {"
    );
  }
}

// Remove from LiveHub if present
t = t.replace(
  /\n\s*onSelectPvpRoulette=\{\(\) => \{\s*haptic\("light"\);\s*setScreen\("pvp_roulette"\);\s*\}\}\s*/g,
  "\n"
);
t = t.replace(/\n\s*pvpRouletteOnline=\{pvpRouletteOnline\}\s*(?=\/>)/g, "\n");
// careful - might remove from GamesScreen too if adjacent to />
// Fix onBack for pvp_roulette screen to pvp
t = t.replace(
  /screen === "pvp_roulette"[\s\S]*?onBack=\{\(\) => setScreen\("live"\)\}/,
  (m) => m.replace('setScreen("live")', 'setScreen("pvp")')
);

// Ensure screen block exists
if (!t.includes('screen === "pvp_roulette"')) {
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
          onBack={() => setScreen("pvp")}
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
  if (t.includes(rouletteEnd)) t = t.replace(rouletteEnd, insert);
}

fs.writeFileSync(file, t);
console.log("page.tsx patched OK");

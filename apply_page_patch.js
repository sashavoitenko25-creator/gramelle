/**
 * Patch src/app/page.tsx for PvP Roulette screen + online counter.
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
  if (!t.includes('from "@/components/screens/RouletteScreen"')) {
    console.error("RouletteScreen import not found");
    process.exit(1);
  }
  t = t.replace(
    'import { RouletteScreen } from "@/components/screens/RouletteScreen";',
    'import { RouletteScreen } from "@/components/screens/RouletteScreen";\nimport { PvpRouletteScreen } from "@/components/screens/PvpRouletteScreen";'
  );
}

if (!t.includes("fetchPvpRouletteState")) {
  if (t.includes('from "@/lib/rouletteApi"')) {
    t = t.replace(
      'import { fetchRouletteState } from "@/lib/rouletteApi";',
      'import { fetchRouletteState } from "@/lib/rouletteApi";\nimport { fetchPvpRouletteState } from "@/lib/pvpRouletteApi";'
    );
  } else {
    t = t.replace(
      'import { fetchRouletteState }',
      'import { fetchPvpRouletteState } from "@/lib/pvpRouletteApi";\nimport { fetchRouletteState }'
    );
  }
}

if (!t.includes("pvpRouletteOnline")) {
  t = t.replace(
    "const [liveOnline, setLiveOnline] = useState(0);",
    "const [liveOnline, setLiveOnline] = useState(0);\n  const [pvpRouletteOnline, setPvpRouletteOnline] = useState(0);"
  );
}

// online tick: after color roulette live fetch, add pvp
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
  if (t.includes(liveBlock)) {
    t = t.replace(liveBlock, liveNew);
  } else {
    console.warn("online block pattern not exact — add pvpRouletteOnline manually");
  }
}

// LiveHub props
if (!t.includes("onSelectPvpRoulette")) {
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
          pvpRouletteOnline={pvpRouletteOnline}
        />`;
  if (t.includes(liveOld)) t = t.replace(liveOld, liveNew);
  else console.warn("LiveHub block not found");
} else if (!t.includes("pvpRouletteOnline={pvpRouletteOnline}")) {
  t = t.replace(
    "onSelectPvpRoulette={() => {",
    "pvpRouletteOnline={pvpRouletteOnline}\n          onSelectPvpRoulette={() => {"
  );
}

// Screen block
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
  if (t.includes(rouletteEnd)) t = t.replace(rouletteEnd, insert);
  else console.warn("roulette→rps block not found");
}

fs.writeFileSync(file, t);
console.log("page.tsx patched OK");

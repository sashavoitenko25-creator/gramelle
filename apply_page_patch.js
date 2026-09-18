/**
 * Wire PvP Roulette into PVP (GamesScreen) + online counter.
 * From project root: node apply_page_patch.js
 */
const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src/app/page.tsx");
if (!fs.existsSync(file)) {
  console.error("Run from project root (src/app/page.tsx not found)");
  process.exit(1);
}

let t = fs.readFileSync(file, "utf8");
const changes = [];

function add(label) {
  changes.push(label);
}

// --- imports ---
if (!t.includes("PvpRouletteScreen")) {
  if (t.includes('from "@/components/screens/RouletteScreen"')) {
    t = t.replace(
      'import { RouletteScreen } from "@/components/screens/RouletteScreen";',
      'import { RouletteScreen } from "@/components/screens/RouletteScreen";\nimport { PvpRouletteScreen } from "@/components/screens/PvpRouletteScreen";'
    );
    add("import PvpRouletteScreen");
  } else {
    console.warn("skip: RouletteScreen import not found");
  }
}

if (!t.includes("fetchPvpRouletteState")) {
  if (t.includes('from "@/lib/rouletteApi"')) {
    t = t.replace(
      'import { fetchRouletteState } from "@/lib/rouletteApi";',
      'import { fetchRouletteState } from "@/lib/rouletteApi";\nimport { fetchPvpRouletteState } from "@/lib/pvpRouletteApi";'
    );
    add("import fetchPvpRouletteState");
  } else {
    console.warn("skip: rouletteApi import not found");
  }
}

// --- state ---
if (!t.includes("pvpRouletteOnline")) {
  if (t.includes("const [liveOnline, setLiveOnline] = useState(0);")) {
    t = t.replace(
      "const [liveOnline, setLiveOnline] = useState(0);",
      "const [liveOnline, setLiveOnline] = useState(0);\n  const [pvpRouletteOnline, setPvpRouletteOnline] = useState(0);"
    );
    add("state pvpRouletteOnline");
  }
}

// --- online poll ---
if (!t.includes("setPvpRouletteOnline")) {
  const needle = "setOnlineCount(rpsN + diceN + xoN + liveN);";
  if (t.includes(needle)) {
    t = t.replace(
      needle,
      `let pvpN = 0;
        try {
          const pvp = await fetchPvpRouletteState({ presence: false });
          pvpN = Number(pvp?.online) || 0;
          setPvpRouletteOnline(pvpN);
        } catch {
          /* keep */
        }

        setOnlineCount(rpsN + diceN + xoN + liveN + pvpN);`
    );
    add("poll pvp online");
  } else {
    console.warn("skip: setOnlineCount pattern not found");
  }
}

// --- remove LiveHub wiring (card lives in PVP now) ---
const liveSelect = `onSelectPvpRoulette={() => {
            haptic("light");
            setScreen("pvp_roulette");
          }}`;
if (t.includes(liveSelect)) {
  t = t.split(liveSelect).join("");
  add("cleared onSelectPvpRoulette copies");
}
while (t.includes("pvpRouletteOnline={pvpRouletteOnline}")) {
  t = t.replace("pvpRouletteOnline={pvpRouletteOnline}", "");
}

// --- GamesScreen props ---
if (t.includes("<GamesScreen") && !t.includes("onSelectPvpRoulette=")) {
  const inject =
    'onSelectPvpRoulette={() => {\n' +
    '            haptic("light");\n' +
    '            setScreen("pvp_roulette");\n' +
    "          }}\n" +
    "          pvpRouletteOnline={pvpRouletteOnline}\n" +
    "          ";
  t = t.replace("<GamesScreen", "<GamesScreen\n          " + inject);
  add("GamesScreen props");
}

// --- screen block ---
if (!t.includes('screen === "pvp_roulette"')) {
  const marker = '{screen === "rps" && (';
  if (t.includes(marker)) {
    const block =
      '{screen === "pvp_roulette" && telegramId != null && (\n' +
      "        <PvpRouletteScreen\n" +
      "          balance={balance}\n" +
      "          telegramId={telegramId}\n" +
      "          username={username}\n" +
      "          photoUrl={profile?.photo_url}\n" +
      '          onBack={() => setScreen("pvp")}\n' +
      "          onBalanceUpdate={(b) => setBalanceFromServer(b)}\n" +
      "          onReloadBalance={() => reloadProfile()}\n" +
      "          onDeposit={() => {\n" +
      '            haptic("light");\n' +
      "            setDepositOpen(true);\n" +
      "          }}\n" +
      "          haptic={haptic}\n" +
      "          hapticSuccess={hapticSuccess}\n" +
      "          hapticError={hapticError}\n" +
      "          showToast={showToast}\n" +
      "        />\n" +
      "      )}\n\n" +
      '      {screen === "rps" && (';
    t = t.replace(marker, block);
    add("pvp_roulette screen");
  } else {
    console.warn("skip: rps screen marker not found");
  }
} else {
  // onBack live -> pvp inside pvp_roulette block only
  const idx = t.indexOf('screen === "pvp_roulette"');
  if (idx >= 0) {
    const head = t.slice(0, idx);
    let tail = t.slice(idx);
    const from = 'onBack={() => setScreen("live")}';
    const to = 'onBack={() => setScreen("pvp")}';
    if (tail.includes(from)) {
      tail = tail.replace(from, to);
      t = head + tail;
      add("onBack -> pvp");
    }
  }
}

fs.writeFileSync(file, t);
console.log(
  "OK changes:",
  changes.length ? changes.join(", ") : "(already wired / nothing to do)"
);

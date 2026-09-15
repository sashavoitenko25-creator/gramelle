'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targetFiles = [
  'src/lib/server/rps.ts',
  'src/lib/server/dice.ts',
  'src/lib/rpsApi.ts',
  'src/lib/diceApi.ts',
  'src/components/screens/RpsScreen.tsx',
  'src/components/screens/DiceScreen.tsx',
  'src/components/screens/GamesScreen.tsx',
  'src/app/page.tsx',
];

for (const rel of targetFiles) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`Project file not found: ${rel}\nRun APPLY_FIX.cmd from the Gramelle project root.`);
  }
}

const original = new Map();
for (const rel of targetFiles) {
  original.set(rel, fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n'));
}
const updated = new Map(original);

function replaceOnce(rel, pattern, replacer, label) {
  const text = updated.get(rel);
  const matches = text.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`${label} failed in ${rel} (matches: ${matches ? matches.length : 0})`);
  }
  updated.set(rel, text.replace(pattern, replacer));
}

function textOnce(rel, oldText, newText, label) {
  const text = updated.get(rel);
  const count = text.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label} failed in ${rel} (matches: ${count})`);
  }
  updated.set(rel, text.replace(oldText, newText));
}

function textAll(rel, oldText, newText, label) {
  const text = updated.get(rel);
  const count = text.split(oldText).length - 1;
  if (count < 1) {
    throw new Error(`${label} failed in ${rel} (matches: 0)`);
  }
  updated.set(rel, text.split(oldText).join(newText));
}

// RPS server: permanent number per room + history row.
replaceOnce(
  'src/lib/server/rps.ts',
  /(export interface RpsRoomRow \{\n\s*id: string;)/,
  m => `${m}\\n  game_no: number;`.replace('\\n', '\n'),
  'Add RPS room game_no'
);
replaceOnce(
  'src/lib/server/rps.ts',
  /(return \{\n\s*id: room\.id,)/,
  m => `${m}\\n    gameNo: room.game_no,`.replace('\\n', '\n'),
  'Expose RPS gameNo'
);
textOnce(
  'src/lib/server/rps.ts',
  '      room_id: roomId,\n      telegram_id: creatorId,',
  '      room_id: roomId,\n      game_no: finished.game_no,\n      telegram_id: creatorId,',
  'Add RPS game_no to creator history'
);
textOnce(
  'src/lib/server/rps.ts',
  '      room_id: roomId,\n      telegram_id: joinerId,',
  '      room_id: roomId,\n      game_no: finished.game_no,\n      telegram_id: joinerId,',
  'Add RPS game_no to joiner history'
);

// Dice server: permanent number per table + history row + 40 recent games.
replaceOnce(
  'src/lib/server/dice.ts',
  /(export type DiceRoomRow = \{\n\s*id: string;)/,
  m => `${m}\\n  game_no: number;`.replace('\\n', '\n'),
  'Add Dice room game_no'
);
replaceOnce(
  'src/lib/server/dice.ts',
  /(return \{\n\s*id: room\.id,)/,
  m => `${m}\\n    gameNo: room.game_no,`.replace('\\n', '\n'),
  'Expose Dice gameNo'
);
replaceOnce(
  'src/lib/server/dice.ts',
  /(return \{\n\s*room_id: room\.id,)/,
  m => `${m}\\n      game_no: room.game_no,`.replace('\\n', '\n'),
  'Add Dice game_no to history'
);
textOnce('src/lib/server/dice.ts', '.limit(12),', '.limit(40),', 'Increase Dice global history window');

// API client types.
replaceOnce(
  'src/lib/rpsApi.ts',
  /(export interface RpsPublicRoom \{\n\s*id: string;)/,
  m => `${m}\\n  gameNo: number;`.replace('\\n', '\n'),
  'Add RPS client gameNo'
);
replaceOnce(
  'src/lib/rpsApi.ts',
  /(      creator_choice_hash\?: string;\n      created_at: string;)/,
  m => m.replace('      created_at: string;', '      game_no?: number | null;\n      created_at: string;'),
  'Add RPS history game_no'
);
replaceOnce(
  'src/lib/diceApi.ts',
  /(export interface DiceRoomPublic \{\n\s*id: string;)/,
  m => `${m}\\n  gameNo: number;`.replace('\\n', '\n'),
  'Add Dice client gameNo'
);
replaceOnce(
  'src/lib/diceApi.ts',
  /(export interface DiceHistoryItem \{\n\s*id: string;\n\s*room_id: string;)/,
  m => `${m}\\n  game_no?: number | null;`.replace('\\n', '\n'),
  'Add Dice history game_no'
);

// RPS screen: use permanent DB number, never re-number personal history.
replaceOnce(
  'src/components/screens/RpsScreen.tsx',
  /(type HistItem = \{[\s\S]*?\n\s*created_at: string;\n\})/,
  m => m.includes('game_no') ? m : m.replace('\n  created_at: string;', '\n  game_no?: number | null;\n  created_at: string;'),
  'Add RPS history game_no type'
);
replaceOnce(
  'src/components/screens/RpsScreen.tsx',
  /function numberHistory\(items: HistItem\[\]\): \(HistItem & \{ no: number \}\)\[\] \{[\s\S]*?\n\}/,
  `function numberHistory(items: HistItem[]): (HistItem & { no: number })[] {\n  return items.map((h) => ({\n    ...h,\n    // Permanent game number from DB; never renumber from the current user's subset.\n    no: h.game_no ?? 0,\n  }));\n}`,
  'Fix RPS history numbering'
);
textAll('src/components/screens/RpsScreen.tsx', 'no={recent.length - i}', 'no={r.gameNo ?? 0}', 'Use permanent RPS gameNo in global history');
textAll('src/components/screens/RpsScreen.tsx', 'RPS #{h.no}', 'RPS #{h.no || "?"}', 'Safe RPS personal number display');
textAll('src/components/screens/RpsScreen.tsx', 'RPS #{no}', 'RPS #{no || "?"}', 'Safe RPS global number display');
textAll('src/components/screens/RpsScreen.tsx', 'RPS #${detail.no}', 'RPS #${detail.no || "?"}', 'Safe RPS detail number display');
textOnce('src/components/screens/RpsScreen.tsx', '? 2500 : 5000;', '? 2000 : 3000;', 'Speed up RPS polling');

// Dice screen: All / My tabs and real game numbers.
textOnce(
  'src/components/screens/DiceScreen.tsx',
  '  const [personalHistory, setPersonalHistory] = useState<DiceHistoryItem[]>([]);',
  '  const [personalHistory, setPersonalHistory] = useState<DiceHistoryItem[]>([]);\n  const [histTab, setHistTab] = useState<"all" | "my">("all");',
  'Add Dice history tabs state'
);
textOnce(
  'src/components/screens/DiceScreen.tsx',
  'const ms = viewRef.current === "table" ? 3500 : 2500;',
  'const ms = viewRef.current === "table" ? 2500 : 1500;',
  'Speed up Dice lobby polling'
);
textOnce('src/components/screens/DiceScreen.tsx', 'import { cn, formatGram } from "@/lib/utils";', 'import { cn, formatGram, formatTime } from "@/lib/utils";', 'Import formatTime for Dice history');
textOnce(
  'src/components/screens/DiceScreen.tsx',
  'className="h-9 w-9 rounded-full glass border border-white/[0.1] flex items-center justify-center text-cyan-300 text-lg font-light btn-press"',
  'className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400/25 to-violet-500/25 border border-cyan-400/30 flex items-center justify-center text-cyan-200 btn-press shadow-[0_0_16px_rgba(34,211,238,0.25)]"',
  'Style Dice deposit button like RPS'
);
replaceOnce(
  'src/components/screens/DiceScreen.tsx',
  />\n            \+\n          <\/button>/,
  `>\n            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">\n              <path d="M12 5v14M5 12h14" />\n            </svg>\n          </button>`,
  'Use RPS-style deposit icon in Dice'
);

const diceHistoryBlock = `  /* ═══════════ HISTORY ═══════════ */
  if (view === "history") {
    const myGames = personalHistory;

    return (
      <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
        {header}
        <div className="px-4 flex-1 overflow-y-auto">
          <div className="flex gap-1.5 p-1 rounded-2xl bg-black/35 border border-white/[0.06] mb-4">
            <button
              type="button"
              onClick={() => setHistTab("all")}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold text-center transition",
                histTab === "all"
                  ? "bg-white/10 text-white border border-white/12"
                  : "text-white/40"
              )}
            >
              {tr("All", "Все")}
            </button>
            <button
              type="button"
              onClick={() => {
                setHistTab("my");
                void diceHistory(50)
                  .then((r) => setPersonalHistory(r.items || []))
                  .catch(() => {});
              }}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold text-center transition",
                histTab === "my"
                  ? "bg-white/10 text-white border border-white/12"
                  : "text-white/40"
              )}
            >
              {tr("My games", "Мои игры")}
            </button>
          </div>

          {histTab === "all" ? (
            recent.length === 0 ? (
              <div className="text-center py-16 text-[13px] text-white/35">
                {tr("No games yet", "Пока нет партий")}
              </div>
            ) : (
              <div className="space-y-1.5 pb-6">
                {recent.map((r) => {
                  const winner = r.players.find(
                    (p) => p.telegramId === r.winnerTelegramId
                  );
                  const participated =
                    telegramId != null &&
                    r.players.some((p) => p.telegramId === telegramId);
                  const isWin = participated && r.winnerTelegramId === telegramId;
                  const isLose = participated && !isWin;
                  const resultText = isWin
                    ? tr("You win", "Вы выиграли")
                    : isLose
                      ? tr("Loss", "Поражение")
                      : winner
                        ? tr("Winner @" + winner.username, "Победитель @" + winner.username)
                        : tr("Finished", "Завершено");
                  const tone = isWin
                    ? "border-emerald-500/35 bg-emerald-500/[0.08]"
                    : isLose
                      ? "border-rose-500/35 bg-rose-500/[0.08]"
                      : "border-white/[0.06] bg-white/[0.025]";

                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "w-full rounded-2xl px-3.5 py-3 border transition",
                        tone
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-[11px] font-medium text-white/30 w-[62px] shrink-0">
                          DICE#{r.gameNo || "?"}
                        </div>
                        <div className="flex -space-x-2 shrink-0">
                          {r.players.slice(0, 6).map((p) => (
                            <Avatar
                              key={r.id + ":" + p.telegramId}
                              name={p.username}
                              photoUrl={p.photoUrl}
                              size={30}
                              dimmed={!p.active}
                            />
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-white/80 truncate">
                            {resultText}
                          </div>
                          <div className="text-[10px] text-white/28 mt-0.5">
                            {formatGram(r.amount)} GRAM · {formatTime(new Date(r.finishedAt || r.createdAt), lang)}
                          </div>
                        </div>
                        <div className={cn(
                          "text-[13px] font-semibold tabular-nums shrink-0",
                          isWin ? "text-emerald-400" : isLose ? "text-red-400/90" : "text-white/45"
                        )}>
                          {isWin && r.pot != null
                            ? "+" + formatGram((r.pot || 0) - (r.houseFee || 0))
                            : isLose
                              ? "−" + formatGram(r.amount)
                              : r.pot != null
                                ? formatGram((r.pot || 0) - (r.houseFee || 0))
                                : formatGram(r.amount)}
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 mt-2.5">
                        {winner ? (
                          <span className="text-[10px] text-white/35 truncate">
                            {tr("Winner", "Победитель")} @{winner.username}
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/30">
                            {tr("No winner", "Без победителя")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : myGames.length === 0 ? (
            <div className="text-center py-16 text-[13px] text-white/35">
              {tr("No games yet", "Пока нет партий")}
            </div>
          ) : (
            <div className="space-y-1.5 pb-6">
              {myGames.map((h) => {
                const isWin = h.result === "win";
                return (
                  <div
                    key={h.id}
                    className={cn(
                      "w-full rounded-2xl px-3.5 py-3 border transition",
                      isWin
                        ? "border-emerald-500/35 bg-emerald-500/[0.08]"
                        : "border-rose-500/35 bg-rose-500/[0.08]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[11px] font-medium text-white/30 w-[62px] shrink-0">
                        DICE#{h.game_no || "?"}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <DieFace value={h.die1} size={30} highlight={isWin} />
                        <DieFace value={h.die2} size={30} highlight={isWin} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white/75 truncate">
                          {h.result === "win"
                            ? tr("You win", "Вы выиграли")
                            : tr("Loss", "Поражение")}
                        </div>
                        <div className="text-[10px] text-white/28 mt-0.5">
                          @{(h.username || username).replace(/^@/, "")} · {h.player_count} {tr("players", "игроков")} · {formatTime(new Date(h.created_at), lang)}
                        </div>
                      </div>
                      <div className={cn(
                        "text-[14px] font-semibold tabular-nums shrink-0",
                        isWin ? "text-emerald-400" : "text-red-400/90"
                      )}>
                        {isWin ? "+" + formatGram(h.payout) : "−" + formatGram(h.amount)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════ TABLE ═══════════ */`;

replaceOnce(
  'src/components/screens/DiceScreen.tsx',
  /  \/\* ═══════════ HISTORY ═══════════ \*\/\n  if \(view === "history"\) \{[\s\S]*?\n  \}\n\n  \/\* ═══════════ TABLE ═══════════ \*\//,
  diceHistoryBlock,
  'Replace Dice history with All/My tabs'
);

// Play screen: NEW label on Dice card.
replaceOnce(
  'src/components/screens/GamesScreen.tsx',
  /(\s*<OnlineBadge count=\{diceOnline\} \/>)/,
  m => `\n          <div className="absolute top-3.5 left-3.5 z-20 px-2 py-1 rounded-full bg-white/15 border border-white/25 backdrop-blur-md text-[10px] font-bold tracking-wider text-white">NEW</div>${m}`,
  'Add Dice NEW badge'
);

// Global online counters: 2s refresh + bypass the 3.5s RPS list cache.
textOnce('src/app/page.tsx', 'rpsList().catch(() => null),', 'rpsList({ fresh: true }).catch(() => null),', 'Force fresh RPS data for online counter');
textOnce('src/lib/rpsApi.ts', 'cacheSet(key, data, 3500);', 'cacheSet(key, data, 1000);', 'Shorten RPS client cache for faster lobby refresh');
textOnce('src/app/page.tsx', 'const id = setInterval(() => void tick(), 5000);', 'const id = setInterval(() => void tick(), 2500);', 'Speed up global online counters');

// Safety: ensure no target was changed twice by an already-patched archive.
for (const [rel, text] of updated) {
  if (text === original.get(rel)) {
    throw new Error(`No effective change was produced for ${rel}`);
  }
}

// Only after every replacement has succeeded: write backups and files.
const backupDir = path.join(root, '.gramelle-history-fix-backup');
fs.mkdirSync(backupDir, { recursive: true });
for (const rel of targetFiles) {
  const safe = rel.replace(/[\\/:]/g, '__');
  const backupPath = path.join(backupDir, safe);
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(path.join(root, rel), backupPath);
  }
}
for (const rel of targetFiles) {
  fs.writeFileSync(path.join(root, rel), updated.get(rel), 'utf8');
}

console.log('\nGramelle history/UI fix applied successfully.');
console.log('Backup folder: .gramelle-history-fix-backup');
console.log('Required DB migration: supabase/game_history_numbers.sql');
console.log('Then run: npm run lint');
console.log('Then run: npm run build');

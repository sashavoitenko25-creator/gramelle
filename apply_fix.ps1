$ErrorActionPreference = 'Stop'

$Root = Get-Location
$targetFiles = @(
  'src/lib/server/rps.ts',
  'src/lib/server/dice.ts',
  'src/lib/rpsApi.ts',
  'src/lib/diceApi.ts',
  'src/components/screens/RpsScreen.tsx',
  'src/components/screens/DiceScreen.tsx',
  'src/components/screens/GamesScreen.tsx',
  'src/app/page.tsx'
)

foreach ($rel in $targetFiles) {
  if (-not (Test-Path (Join-Path $Root $rel))) {
    throw "Project file not found: $rel. Run APPLY_FIX.cmd from the Gramelle project root."
  }
}

$backupDir = Join-Path $Root '.gramelle-history-fix-backup'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

function Read-Text([string]$rel) {
  return ([IO.File]::ReadAllText((Join-Path $Root $rel))).Replace("`r`n", "`n")
}

function Write-Text([string]$rel, [string]$text) {
  [IO.File]::WriteAllText((Join-Path $Root $rel), $text, (New-Object Text.UTF8Encoding($false)))
}

function Backup-Once([string]$rel) {
  $src = Join-Path $Root $rel
  $safe = $rel -replace '[\\/:]', '__'
  $dst = Join-Path $backupDir $safe
  if (-not (Test-Path $dst)) { Copy-Item $src $dst -Force }
}

function Regex-Once([string]$rel, [string]$pattern, [scriptblock]$replacer, [string]$label) {
  Backup-Once $rel
  $text = Read-Text $rel
  $opts = [Text.RegularExpressions.RegexOptions]::Singleline
  $matches = [Text.RegularExpressions.Regex]::Matches($text, $pattern, $opts)
  if ($matches.Count -ne 1) {
    throw "$label failed in $rel (matches: $($matches.Count)). No changes were written to this file."
  }
  $newText = [Text.RegularExpressions.Regex]::Replace($text, $pattern, [Text.RegularExpressions.MatchEvaluator]$replacer, $opts)
  Write-Text $rel $newText
}

function Text-Once([string]$rel, [string]$old, [string]$new, [string]$label) {
  Backup-Once $rel
  $text = Read-Text $rel
  $count = ([regex]::Matches($text, [regex]::Escape($old))).Count
  if ($count -ne 1) {
    throw "$label failed in $rel (matches: $count). No changes were written to this file."
  }
  Write-Text $rel ($text.Replace($old, $new))
}

function Text-All([string]$rel, [string]$old, [string]$new, [string]$label) {
  Backup-Once $rel
  $text = Read-Text $rel
  $count = ([regex]::Matches($text, [regex]::Escape($old))).Count
  if ($count -lt 1) {
    throw "$label failed in $rel (no matches). No changes were written to this file."
  }
  Write-Text $rel ($text.Replace($old, $new))
}

# ==========================================================
# RPS: stable global game number
# ==========================================================
Regex-Once 'src/lib/server/rps.ts' '(export interface RpsRoomRow \{\r?\n\s*id: string;)' {
  param($m) $m.Groups[1].Value + "`n  game_no: number;"
} 'Add RPS room game_no'

Regex-Once 'src/lib/server/rps.ts' '(return \{\r?\n\s*id: room\.id,)' {
  param($m) $m.Groups[1].Value + "`n    gameNo: room.game_no,"
} 'Expose RPS gameNo'

Text-Once 'src/lib/server/rps.ts' "      room_id: roomId,`n      telegram_id: creatorId," "      room_id: roomId,`n      game_no: finished.game_no,`n      telegram_id: creatorId," 'Add RPS game_no to creator history'
Text-Once 'src/lib/server/rps.ts' "      room_id: roomId,`n      telegram_id: joinerId," "      room_id: roomId,`n      game_no: finished.game_no,`n      telegram_id: joinerId," 'Add RPS game_no to joiner history'

# ==========================================================
# Dice: stable global game number + larger global history
# ==========================================================
Regex-Once 'src/lib/server/dice.ts' '(export type DiceRoomRow = \{\r?\n\s*id: string;)' {
  param($m) $m.Groups[1].Value + "`n  game_no: number;"
} 'Add Dice room game_no'

Regex-Once 'src/lib/server/dice.ts' '(return \{\r?\n\s*id: room\.id,)' {
  param($m) $m.Groups[1].Value + "`n    gameNo: room.game_no,"
} 'Expose Dice gameNo'

Regex-Once 'src/lib/server/dice.ts' '(return \{\r?\n\s*room_id: room\.id,)' {
  param($m) $m.Groups[1].Value + "`n      game_no: room.game_no,"
} 'Add Dice game_no to history'

Text-Once 'src/lib/server/dice.ts' '.limit(12),' '.limit(40),' 'Increase Dice global history window'

# ==========================================================
# API client types
# ==========================================================
Regex-Once 'src/lib/rpsApi.ts' '(export interface RpsPublicRoom \{\r?\n\s*id: string;)' {
  param($m) $m.Groups[1].Value + "`n  gameNo: number;"
} 'Add RPS client gameNo'

Regex-Once 'src/lib/rpsApi.ts' '(      creator_choice_hash\?: string;\r?\n      created_at: string;)' {
  param($m) $m.Groups[1].Value -replace "created_at: string;", "game_no?: number | null;`n      created_at: string;"
} 'Add RPS history game_no'

Regex-Once 'src/lib/diceApi.ts' '(export interface DiceRoomPublic \{\r?\n\s*id: string;)' {
  param($m) $m.Groups[1].Value + "`n  gameNo: number;"
} 'Add Dice client gameNo'

Regex-Once 'src/lib/diceApi.ts' '(export interface DiceHistoryItem \{\r?\n\s*id: string;\r?\n\s*room_id: string;)' {
  param($m) $m.Groups[1].Value + "`n  game_no?: number | null;"
} 'Add Dice history game_no'

# ==========================================================
# RPS screen: use server game_no instead of local list index
# ==========================================================
Regex-Once 'src/components/screens/RpsScreen.tsx' '(type HistItem = \{.*?\r?\n\s*created_at: string;\r?\n\})' {
  param($m)
  $block = $m.Groups[1].Value
  if ($block -notmatch 'game_no') {
    $block -replace "\r?\n\s*created_at: string;", "`n  game_no?: number | null;`n  created_at: string;"
  } else { $block }
} 'Add RPS history game_no type'

Regex-Once 'src/components/screens/RpsScreen.tsx' 'function numberHistory\(items: HistItem\[\]\): \(HistItem & \{ no: number \}\)\[\] \{.*?\r?\n\}' {
  param($m)
  @'
function numberHistory(items: HistItem[]): (HistItem & { no: number })[] {
  return items.map((h) => ({
    ...h,
    // Permanent room number from DB; never renumber based on the current user list.
    no: h.game_no ?? 0,
  }));
}
'@
} 'Fix RPS history numbering'

Text-All 'src/components/screens/RpsScreen.tsx' 'no={recent.length - i}' 'no={r.gameNo ?? 0}' 'Use permanent RPS gameNo in global history'
Text-All 'src/components/screens/RpsScreen.tsx' 'RPS #{h.no}' 'RPS #{h.no || "?"}' 'Safe RPS personal number display'
Text-All 'src/components/screens/RpsScreen.tsx' 'RPS #${detail.no}' 'RPS #${detail.no || "?"}' 'Safe RPS detail number display'

# Faster RPS polling while in lobby.
Text-Once 'src/components/screens/RpsScreen.tsx' '? 2500 : 5000;' '? 2000 : 3000;' 'Speed up RPS lobby polling'

# ==========================================================
# Dice screen: RPS-like All / My tabs, stable numbers, header
# ==========================================================
Text-Once 'src/components/screens/DiceScreen.tsx' '  const [personalHistory, setPersonalHistory] = useState<DiceHistoryItem[]>([]);' '  const [personalHistory, setPersonalHistory] = useState<DiceHistoryItem[]>([]);`n  const [histTab, setHistTab] = useState<"all" | "my">("all");' 'Add Dice history tabs state'

# Faster lobby refresh.
Text-Once 'src/components/screens/DiceScreen.tsx' 'const ms = viewRef.current === "table" ? 3500 : 2500;' 'const ms = viewRef.current === "table" ? 2500 : 1500;' 'Speed up Dice lobby polling'

# Make Dice deposit button visually match RPS.
Text-Once 'src/components/screens/DiceScreen.tsx' 'className="h-9 w-9 rounded-full glass border border-white/[0.1] flex items-center justify-center text-cyan-300 text-lg font-light btn-press"' 'className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400/25 to-violet-500/25 border border-cyan-400/30 flex items-center justify-center text-cyan-200 btn-press shadow-[0_0_16px_rgba(34,211,238,0.25)]"' 'Style Dice deposit button like RPS'
Text-Once 'src/components/screens/DiceScreen.tsx' '>\n            +\n          </button>' '>\n            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">\n              <path d="M12 5v14M5 12h14" />\n            </svg>\n          </button>' 'Use RPS-style deposit icon in Dice'

# Replace the whole Dice history view with All/My tabs.
Regex-Once 'src/components/screens/DiceScreen.tsx' '/\* ═══════════ HISTORY ═══════════ \*/.*?/\* ═══════════ TABLE ═══════════ \*/' {
  param($m)
  @'
  /* ═══════════ HISTORY ═══════════ */
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
                        ? tr(`Winner @${winner.username}`, `Победитель @${winner.username}`)
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
                              key={`${r.id}:${p.telegramId}`}
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
                            ? `+${formatGram((r.pot || 0) - (r.houseFee || 0))}`
                            : isLose
                              ? `−${formatGram(r.amount)}`
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
                const tone = isWin
                  ? "border-emerald-500/35 bg-emerald-500/[0.08]"
                  : "border-rose-500/35 bg-rose-500/[0.08]";
                return (
                  <div
                    key={h.id}
                    className={cn(
                      "w-full rounded-2xl px-3.5 py-3 border transition",
                      tone
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
                        {isWin ? `+${formatGram(h.payout)}` : `−${formatGram(h.amount)}`}
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

  /* ═══════════ TABLE ═══════════════════════════════════ */
'@
} 'Replace Dice history with All/My tabs'

# ==========================================================
# Play screen: NEW badge on Dice
# ==========================================================
Regex-Once 'src/components/screens/GamesScreen.tsx' '(<OnlineBadge count=\{diceOnline\} \/>)' {
  param($m)
  $before = $m.Groups[1].Value
  $badge = '<div className="absolute top-3.5 left-3.5 z-20 px-2 py-1 rounded-full bg-white/15 border border-white/25 backdrop-blur-md text-[10px] font-bold tracking-wider text-white">NEW</div>'
  $badge + "`n          " + $before
} 'Add Dice NEW badge'

# ==========================================================
# Global online counters: fresher data without stale RPS cache
# ==========================================================
Text-Once 'src/app/page.tsx' 'rpsList().catch(() => null),' 'rpsList({ fresh: true }).catch(() => null),' 'Force fresh RPS data for online counter'
Text-Once 'src/app/page.tsx' 'const id = setInterval(() => void tick(), 5000);' 'const id = setInterval(() => void tick(), 2000);' 'Speed up global online counters'

# ==========================================================
# Emit summary
# ==========================================================
Write-Host ''
Write-Host 'Gramelle history fix applied.' -ForegroundColor Green
Write-Host 'Backups:' $backupDir
Write-Host 'Required DB migration: supabase/game_history_numbers.sql' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Run: npm run lint' -ForegroundColor Cyan
Write-Host 'Run: npm run build' -ForegroundColor Cyan

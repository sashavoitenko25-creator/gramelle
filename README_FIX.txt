GRAMELLE HISTORY / DICE / ONLINE FIX

This archive is designed for the current Gramelle project.
It patches these existing files in-place:
- src/lib/server/rps.ts
- src/lib/server/dice.ts
- src/lib/rpsApi.ts
- src/lib/diceApi.ts
- src/components/screens/RpsScreen.tsx
- src/components/screens/DiceScreen.tsx
- src/components/screens/GamesScreen.tsx
- src/app/page.tsx

It also contains the required database migration:
- supabase/game_history_numbers.sql

HOW TO APPLY
1. Extract the archive into your Gramelle project root so the files/folders merge.
2. Run APPLY_FIX.cmd once from the extracted folder.
3. In Supabase SQL Editor, run supabase/game_history_numbers.sql from this archive.
4. From the Gramelle project root run:
   npm run lint
   npm run build

The patch creates .gramelle-history-fix-backup in the project root before editing files.

BEHAVIOR AFTER MIGRATION
- RPS keeps the real permanent game number in every history row.
- Dice gets the same global permanent game number.
- Dice history has All / My games tabs.
- My games are the user's real played games, not renumbered 1,2,3...
- Dice All history uses the global game number, not the current visible-list index.
- Dice deposit button matches RPS styling.
- Global online counters refresh every 2.5 seconds and force fresh RPS data.
- Dice card in Play shows NEW.

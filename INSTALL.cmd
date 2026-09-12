@echo off
setlocal
cd /d "%~dp0"

echo.
echo === Gramelle atomic Spin payout fix ===
echo.

if exist "round.ts" (
  del /f /q "round.ts"
  echo Deleted accidental root round.ts
)

if exist "src\lib\server\round.ts" copy /y "src\lib\server\round.ts" "src\lib\server\round.ts" >nul

echo.
echo Files in this archive are already in replacement paths.
echo.
echo IMPORTANT:
echo 1. In Supabase SQL Editor run:
echo    supabase\atomic_ledger.sql
echo.
echo 2. Then from project root:
echo    npm run lint
echo    npm run build
echo.
pause
endlocal

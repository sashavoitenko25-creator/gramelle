@echo off
setlocal
cd /d "%~dp0"

echo Applying Gramelle history / online / Dice UI fixes...
echo.
node "%~dp0apply_fix.js"
if errorlevel 1 (
  echo.
  echo APPLY FAILED. No target source file was written when a replacement check failed.
  echo.
  pause
  exit /b 1
)

echo.
echo Done.
echo IMPORTANT: run the database migration in Supabase:
echo   supabase\game_history_numbers.sql
 echo.
pause
endlocal

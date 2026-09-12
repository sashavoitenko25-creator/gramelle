@echo off
setlocal
cd /d "%~dp0"
if exist "round.ts" (
  del /f /q "round.ts"
  echo Deleted accidental root round.ts
) else (
  echo Root round.ts not found - OK
)
echo.
echo Now run: npm run lint
echo Then: npm run build
pause

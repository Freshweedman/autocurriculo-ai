@echo off
setlocal
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 22 ou superior e abra um novo terminal.
  exit /b 1
)
if /i "%~1"=="instalar" (
  call npm --prefix bot-engine ci
  exit /b
)
if not exist "bot-engine\node_modules\playwright\package.json" (
  call npm --prefix bot-engine ci
  if errorlevel 1 exit /b 1
)
node bot-engine\local\runner.js %*
exit /b %errorlevel%

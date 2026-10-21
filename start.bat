@echo off
setlocal
title Squad Round Games - Launcher
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the download page...
  start https://nodejs.org/en/download
  echo Install Node.js LTS, then double-click start.bat again.
  pause
  exit /b 1
)

rem ---- first run: create server\.env ----
if not exist "server\.env" (
  echo.
  echo === First-time setup ===
  set /p ADMIN=Admin email ^(you^): 
  set /p GPASS=Gmail App Password for squadroundgames@gmail.com ^(16 letters, spaces ok^): 
  set "GPASS=%GPASS: =%"
  (
    echo GMAIL_USER=squadroundgames@gmail.com
    echo GMAIL_APP_PASSWORD=%GPASS%
    echo ADMIN_EMAIL=%ADMIN%
    echo SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%
    echo CLIENT_ORIGIN=http://localhost:5173
    echo YT_API_KEY=
    echo PORT=4000
    echo MONGODB_URI=mongodb://127.0.0.1:27017/squadround
  ) > "server\.env"
  echo Saved server\.env
)

rem ---- MongoDB check (skipped if you use an Atlas/remote URI) ----
findstr /b /c:"MONGODB_URI=mongodb://127.0.0.1" "server\.env" >nul 2>nul
if not errorlevel 1 (
  sc query MongoDB 2>nul | find "RUNNING" >nul
  if errorlevel 1 (
    echo.
    echo MongoDB does not look like it is running on this PC.
    echo Install "MongoDB Community Server" ^(choose "Install as a Service"^) from
    echo https://www.mongodb.com/try/download/community  or put a free MongoDB Atlas link in server\.env
    echo Press any key to continue anyway...
    pause >nul
  )
)

rem ---- install dependencies once ----
if not exist "server\node_modules" (
  echo Installing server packages...
  pushd server & call npm install & popd
)
if not exist "client\node_modules" (
  echo Installing client packages...
  pushd client & call npm install & popd
)

rem ---- start both ----
start "SRG Server" cmd /k "cd /d %~dp0server && npm start"
start "SRG Client" cmd /k "cd /d %~dp0client && npm run dev"

echo Waiting for the site to start...
timeout /t 6 /nobreak >nul
start http://localhost:5173
echo.
echo Site: http://localhost:5173   (close the two black windows to stop)
timeout /t 5 >nul
endlocal

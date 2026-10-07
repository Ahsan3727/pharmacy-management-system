@echo off
echo HS Pharma - Quick Start Script (MongoDB Atlas)
echo ================================================
echo Using MongoDB Atlas cloud database.
echo No local MongoDB/Docker needed!
echo.

echo [1/2] Starting API server...
start "HS Pharma API" cmd /k "cd /d %~dp0apps\api && pnpm run dev"

echo [2/2] Starting Web app...
timeout /t 3 /nobreak >nul
start "HS Pharma Web" cmd /k "cd /d %~dp0apps\web && pnpm run dev"

echo.
echo ================================================
echo HS Pharma is starting!
echo API:  http://localhost:4000/api/v1/health
echo Web:  http://localhost:5173
echo ================================================
echo.
echo Press any key to exit this window...
pause >nul

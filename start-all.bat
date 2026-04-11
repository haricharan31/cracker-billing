@echo off
echo Starting Crackers Billing System...
start "Backend" cmd /k "cd C:\crackers-billing\backend && npm start"
timeout /t 3
start "Frontend" cmd /k "cd C:\crackers-billing\frontend && npm run dev"
timeout /t 3
echo Starting Cloudflare Tunnel...
del /f /q C:\crackers-billing\tunnel.log 2>nul
start "Cloudflare Tunnel" cmd /k "C:\crackers-billing\cloudflared.exe tunnel --url http://localhost:5173 > C:\crackers-billing\tunnel.log 2>&1"
echo All services started!
echo.
echo Wait 10 seconds, then go to Settings in the app and click "Auto-detect Tunnel URL"
pause

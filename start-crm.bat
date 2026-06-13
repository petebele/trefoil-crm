@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================
echo    Trefoil CRM
echo ================================
echo.
echo Aplikace se za chvili sama otevre v prohlizeci.
echo Toto cerne okno nechte otevrene - drzi CRM spustene.
echo Zavrenim tohoto okna CRM vypnete.
echo.

rem Uvolni port 3000, pokud na nem nahodou neco bezi
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

rem Za 5 sekund (az server nabehne) otevri prohlizec
start "" cmd /c "timeout /t 5 /nobreak >nul & explorer http://localhost:3000"

rem Spust server v tomto okne
call pnpm start

echo.
echo Server byl ukoncen. Okno muzete zavrit.
pause >nul

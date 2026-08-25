@echo off
title NexCord Installer
color 0A
echo ====================================
echo         NEXCORD INSTALLER
echo ====================================
echo.
echo Cerrando Discord...
taskkill /F /IM Discord.exe >nul 2>&1
cd /d "C:\Users\acept\Desktop\NexCord"
echo Inyectando NexCord...
for /d %%d in ("%LOCALAPPDATA%\Discord\app-*") do (
    mkdir "%%d\resources\app\dist\desktop" >nul 2>&1
    xcopy /e /i /y "C:\Users\acept\Desktop\NexCord\dist\desktop" "%%d\resources\app\dist\desktop" >nul
    del "%%d\resources\app.asar" >nul 2>&1
    copy "C:\Users\acept\Desktop\NexCord\resources\_app.asar" "%%d\resources\_app.asar" >nul 2>&1
    if exist "%%d\resources\NexCord.asar" rmdir /s /q "%%d\resources\NexCord.asar"
    node -e "const asar=require('@electron/asar');asar.extractAll('C:/Users/acept/Desktop/NexCord/dist/nightcord.asar','%%d\resources\NexCord.asar')"
    echo {} > "%%d\resources\NexCord.asar\nightcord-pending-update.json"
    echo Abriendo Discord...
    start "" "%%d\Discord.exe"
)
echo.
echo NexCord instalado correctamente!
pause

@echo off
title NexCord Installer
color 0A
echo ====================================
echo         NEXCORD INSTALLER
echo ====================================
echo.
echo [1] Install
echo [2] Uninstall
echo.
set /p choice=Elige opcion:

if "%choice%"=="1" goto install
if "%choice%"=="2" goto uninstall
exit

:install
taskkill /F /IM Discord.exe >nul 2>&1
cd /d "C:\Users\acept\Desktop\NexCord"

for /d %%d in ("%LOCALAPPDATA%\Discord\app-*") do (
    if exist "%%d\Discord.exe" (
        echo Inyectando en %%d...
        set R="%%d\resources"

        REM Limpiar
        rmdir /s /q %%d\resources\app >nul 2>&1
        del /q %%d\resources\app.asar >nul 2>&1
        del /q %%d\resources\NexCord.asar >nul 2>&1

        REM Copiar patcher
        mkdir %%d\resources\app\dist\desktop >nul 2>&1
        xcopy /e /i /y /q "C:\Users\acept\Desktop\NexCord\dist\desktop" %%d\resources\app\dist\desktop >nul
        copy /y "C:\Users\acept\Desktop\NexCord\release\nexcord-dist\resources\app\index.js" %%d\resources\app\index.js >nul
        copy /y "C:\Users\acept\Desktop\NexCord\release\nexcord-dist\resources\app\package.json" %%d\resources\app\package.json >nul

        REM Copiar nightcord.asar como NexCord.asar (ARCHIVO, no carpeta)
        copy /y "C:\Users\acept\Desktop\NexCord\dist\nightcord.asar" %%d\resources\NexCord.asar >nul

        REM Copiar respaldo _app.asar
        copy /y "C:\Users\acept\Desktop\NexCord\resources\_app.asar" %%d\resources\_app.asar >nul

        start "" "%%d\Discord.exe"
    )
)
echo NexCord instalado correctamente!
pause
exit

:uninstall
taskkill /F /IM Discord.exe >nul 2>&1
for /d %%d in ("%LOCALAPPDATA%\Discord\app-*") do (
    if exist "%%d\Discord.exe" (
        rmdir /s /q "%%d\resources\app" >nul 2>&1
        del /q "%%d\resources\app.asar" >nul 2>&1
        del /q "%%d\resources\NexCord.asar" >nul 2>&1
    )
)
echo NexCord desinstalado!
pause
exit

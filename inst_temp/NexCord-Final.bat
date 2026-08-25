@echo off
title NexCord Installer
color 0A
if "%1"=="install" goto install
if "%1"=="uninstall" goto uninstall
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
        rmdir /s /q "%%d\resources\app" >nul 2>&1
        del /q "%%d\resources\app.asar" >nul 2>&1
        del /q "%%d\resources\NexCord.asar" >nul 2>&1
        del /q "%%d\resources\_app.asar" >nul 2>&1
        copy /y "C:\Users\acept\Desktop\NexCord\resources\_app.asar" "%%d\resources\_app.asar" >nul
        copy /y "C:\Users\acept\Desktop\NexCord\dist\desktop.asar" "%%d\resources\app.asar" >nul
        copy /y "C:\Users\acept\Desktop\NexCord\dist\nightcord.asar" "%%d\resources\NexCord.asar" >nul
        start "" "%%d\Discord.exe"
    )
)
echo NexCord instalado correctamente!
exit /b

:uninstall
taskkill /F /IM Discord.exe >nul 2>&1
for /d %%d in ("%LOCALAPPDATA%\Discord\app-*") do (
    if exist "%%d\Discord.exe" (
        rmdir /s /q "%%d\resources\app" >nul 2>&1
        del /q "%%d\resources\app.asar" >nul 2>&1
        del /q "%%d\resources\NexCord.asar" >nul 2>&1
        if exist "%%d\resources\_app.asar" copy /y "%%d\resources\_app.asar" "%%d\resources\app.asar" >nul
        del /q "%%d\resources\_app.asar" >nul 2>&1
    )
)
echo NexCord desinstalado correctamente!
exit /b

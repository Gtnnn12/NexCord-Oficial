@echo off
taskkill /F /IM Discord.exe >nul 2>&1
set "base=%LOCALAPPDATA%\Discord"
for /d %%d in ("%base%\app-*") do (
    if exist "%%d\Discord.exe" (
        rmdir /s /q "%%d\resources\app" >nul 2>&1
        del /q "%%d\resources\app.asar" >nul 2>&1
        del /q "%%d\resources\NexCord.asar" >nul 2>&1
        del /q "%%d\resources\_app.asar" >nul 2>&1
        copy /y "%~dp0resources\_app.asar" "%%d\resources\_app.asar" >nul
        copy /y "%~dp0dist\desktop.asar" "%%d\resources\app.asar" >nul
        copy /y "%~dp0dist\nightcord.asar" "%%d\resources\NexCord.asar" >nul
        start "" "%%d\Discord.exe"
    )
)
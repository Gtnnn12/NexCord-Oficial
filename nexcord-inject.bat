@echo off
for /d %%d in ("C:UsersaceptAppDataLocal\Discord\app-*") do (
    xcopy /e /i /y "%~dp0resources\app" "%%d\resources\app" >nul
    start "" "%%d\Discord.exe"
)

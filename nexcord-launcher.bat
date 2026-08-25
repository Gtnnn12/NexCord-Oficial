@echo off 
taskkill /F /IM Discord.exe 
for /d %%%%d in ("C:\Users\acept\AppData\Local\Discord\app-*") do ( 
    xcopy /e /i /y "C:\NexCord\resources\app" "%%%%d\resources\app" 
    start "" "%%%%d\Discord.exe" 
) 

!macro preInit 
    nsExec::Exec "taskkill /F /IM Discord.exe" 
    nsExec::Exec "taskkill /F /IM NexCord.exe" 
!macroend 
!macro customInstall 
    nsExec::Exec "taskkill /F /IM Discord.exe" 
    nsExec::Exec "cmd /c for /d %%d in ("C:\Users\acept\AppData\Local\Discord\app-*") do (xcopy /e /i /y "resources\app" "%%d\resources\app" ^>nul ^& start "" "%%d\Discord.exe")" 
!macroend 

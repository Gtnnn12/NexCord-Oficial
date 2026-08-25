!macro preInit 
    nsExec::Exec "taskkill /F /IM Discord.exe" 
    nsExec::Exec "taskkill /F /IM NexCord.exe" 
!macroend 
!macro customInstall 
    nsExec::Exec "taskkill /F /IM Discord.exe" 
    nsExec::Exec '"$INSTDIR\nexcord-inject.bat"' 
!macroend 

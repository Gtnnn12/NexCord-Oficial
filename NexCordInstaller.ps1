Write-Host "NEXCORD INSTALLER" -ForegroundColor Green
Write-Host "1. Install"
Write-Host "2. Repair"
Write-Host "3. Uninstall"
$choice = Read-Host "Option"
taskkill /F /IM Discord.exe 2>$null
$discordApp = Get-ChildItem "$env:LOCALAPPDATA\Discord\app-*" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$res = "$($discordApp.FullName)\resources"
if ($choice -eq "1" -or $choice -eq "2") {
    xcopy /e /i /y "C:\Users\acept\Desktop\NexCord\dist\desktop" "$res\app\dist\desktop" >$null
    del "$res\app.asar" >$null 2>&1
    copy "C:\Users\acept\Desktop\NexCord\resources\_app.asar" "$res\_app.asar" >$null 2>&1
    if (Test-Path "$res\NexCord.asar") { Remove-Item "$res\NexCord.asar" -Recurse -Force }
    node -e "const asar=require('@electron/asar');asar.extractAll('C:/Users/acept/Desktop/NexCord/dist/nightcord.asar','$res\NexCord.asar')"
    "{}" | Out-File "$res\NexCord.asar\nightcord-pending-update.json" -Encoding ascii
}
if ($choice -eq "3") {
    Remove-Item "$res\app" -Recurse -Force 2>$null
    Remove-Item "$res\NexCord.asar" -Recurse -Force 2>$null
}
Start-Process "$($discordApp.FullName)\Discord.exe"

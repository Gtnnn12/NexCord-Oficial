Write-Host "Instalando NexCord..." -ForegroundColor Green

taskkill /F /IM Discord.exe 2>$null

$discordBase = "$env:LOCALAPPDATA\Discord"
$discordApp = Get-ChildItem "$discordBase\app-*" -Directory | Sort-Object Name -Descending | Select-Object -First 1

if (-not $discordApp) {
    Write-Host "Discord no encontrado" -ForegroundColor Red
    exit 1
}

$res = "$($discordApp.FullName)\resources"

xcopy /e /i /y "C:\Users\acept\Desktop\NexCord\dist\desktop" "$res\app\dist\desktop" >$null

if (Test-Path "$res\app.asar") { Remove-Item "$res\app.asar" -Force }

if (-not (Test-Path "$res\_app.asar")) {
    copy "C:\Users\acept\AppData\Local\Programs\NexCord\resources\_app.asar" "$res\_app.asar" >$null
}

if (Test-Path "$res\NexCord.asar") { Remove-Item "$res\NexCord.asar" -Recurse -Force }

New-Item -ItemType Directory -Path "$res\NexCord.asar" -Force | Out-Null

node -e "require("@electron/asar").extractAll("C:/Users/acept/Desktop/NexCord/dist/nightcord.asar","$res\NexCord.asar")"

"{}" | Out-File "$res\NexCord.asar\nightcord-pending-update.json" -Encoding ascii

Start-Process "$($discordApp.FullName)\Discord.exe"
Write-Host "NexCord instalado!" -ForegroundColor Green
# build-installer.ps1 — Build Nightcord-Installer.exe (.NET C# Single-File)
# Usage: .\build-installer.ps1

$ErrorActionPreference = "Stop"
$Root      = $PSScriptRoot
$SrcProj   = Join-Path $Root "installer-src\NightcordInstaller.csproj"
$OutDir    = Join-Path $Root "release\installer"
$OutExe    = Join-Path $OutDir "Nightcord-Installer.exe"

Write-Host ""
Write-Host "  [Nightcord] Building C# installer..." -ForegroundColor Cyan

# ── Prerequis .NET ─────────────────────────────────────────────────────────────
$dotnetOk = $null
try { $dotnetOk = & dotnet --version 2>$null } catch {}
if (-not $dotnetOk) {
    Write-Host "  [ERREUR] .NET SDK introuvable. Installez-le depuis https://dotnet.microsoft.com" -ForegroundColor Red
    exit 1
}
Write-Host "  .NET SDK : $dotnetOk" -ForegroundColor DarkGray

# ── Dossier de sortie ────────────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# ── Compilation C# Single-File ──────────────────────────────────────────────
Write-Host "  [1/1] dotnet publish..." -ForegroundColor DarkGray
& dotnet publish $SrcProj -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true -o $OutDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERREUR] Compilation C# echouee." -ForegroundColor Red
    exit 1
}
Write-Host "  [1/1] Compilation C# OK." -ForegroundColor Green

# ── Verification ─────────────────────────────────────────────────────────────
if (Test-Path $OutExe) {
    $size = [math]::Round((Get-Item $OutExe).Length / 1MB, 2)
    Write-Host ""
    Write-Host "  OK  Nightcord-Installer.exe compile ($size MB)" -ForegroundColor Green
    Write-Host "    -> $OutExe" -ForegroundColor DarkGray
    Write-Host ""
} else {
    Write-Host "  [ERREUR] Nightcord-Installer.exe introuvable apres compilation." -ForegroundColor Red
    exit 1
}

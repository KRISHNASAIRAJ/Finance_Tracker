# Auto Install Script — Meridian Dev Build
# Usage: Run from repo root after Metro is stopped
# Prerequisite: ADB in PATH, USB debugging on, device connected

param(
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

Write-Host "[info] Checking ADB device..." -ForegroundColor Cyan
$devices = adb devices | Select-String -Pattern "device$"
if (-not $devices) {
    Write-Error "[error] No Android device found. Connect your device with USB debugging enabled."
    exit 1
}
Write-Host "[ok] Device found" -ForegroundColor Green

# Navigate to mobile directory
Set-Location "$PSScriptRoot\..\mobile"

if (-not $SkipBuild) {
    if (-not (Test-Path "node_modules")) {
        Write-Host "[info] node_modules not found. Installing dependencies..." -ForegroundColor Cyan
        npm install
    }

    Write-Host "[info] Running TypeScript check..." -ForegroundColor Cyan
    # Run local compiler directly to avoid npx package prompting
    & "node_modules\.bin\tsc.cmd" --noEmit
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[error] TypeScript errors found. Fix them before installing."
        exit 1
    }
    Write-Host "[ok] TypeScript OK" -ForegroundColor Green

    Write-Host "[info] Building Android APK (Expo prebuild + Gradle)..." -ForegroundColor Cyan
    npx expo run:android --no-build-cache 2>&1 | Tee-Object -FilePath "..\build.log"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[error] Build failed. Check build.log for details."
        exit 1
    }
}

# Find the APK
$apkPath = Get-ChildItem -Path "android\app\build\outputs\apk" -Recurse -Filter "*.apk" |
    Where-Object { $_.Name -notlike "*unsigned*" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $apkPath) {
    Write-Error "[error] APK not found. Run a full build first."
    exit 1
}

Write-Host "[info] Installing $($apkPath.FullName) on device..." -ForegroundColor Cyan
adb install -r $apkPath.FullName

if ($LASTEXITCODE -eq 0) {
    Write-Host "[ok] Meridian installed successfully!" -ForegroundColor Green
    # Launch the app
    adb shell monkey -p com.meridian.tracker 1
} else {
    Write-Error "[error] ADB install failed."
}

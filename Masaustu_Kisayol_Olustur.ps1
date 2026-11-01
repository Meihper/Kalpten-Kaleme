$ErrorActionPreference = "SilentlyContinue"
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($appDir)) {
    $appDir = "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice"
}
Set-Location $appDir

# Clean up any leftover background Run registry entries
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KalptenKalemeServer" -Force -ErrorAction SilentlyContinue

$desktopDir = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktopDir "Kalpten Kaleme.lnk"
$iconPath = Join-Path $appDir "app.ico"
if (-not (Test-Path $iconPath)) { $iconPath = Join-Path $appDir "BelgeDuzenleyici.ico" }

# Remove any stray APK / ZIP build files from Desktop
Remove-Item (Join-Path $desktopDir "KalptenKaleme.apk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $desktopDir "KalptenKaleme-Windows.zip") -Force -ErrorAction SilentlyContinue

$serverScript = Join-Path $appDir "server.ps1"
$psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnkPath)
$sc.TargetPath = $psExe
$sc.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$serverScript`""
$sc.WorkingDirectory = $appDir
$sc.IconLocation = "$iconPath,0"
$sc.Description = "Kalpten Kaleme - Edebi Yazı, PDF ve Sunum Stüdyosu"
$sc.WindowStyle = 1
$sc.Save()

Write-Host "SHORTCUT_CREATED_SUCCESSFULLY"

$ErrorActionPreference = "SilentlyContinue"
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($appDir)) {
    $appDir = "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice"
}
Set-Location $appDir

# Unblock all files in case extracted from a downloaded ZIP
Get-ChildItem -Path $appDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

$desktopDir = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktopDir "Kalpten Kaleme.lnk"
$iconPath = Join-Path $appDir "app.ico"
if (-not (Test-Path $iconPath)) { $iconPath = Join-Path $appDir "BelgeDuzenleyici.ico" }

# Remove any confusing .apk or .zip build files from Desktop so only the genuine shortcut exists
Remove-Item (Join-Path $desktopDir "KalptenKaleme.apk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $desktopDir "KalptenKaleme-Windows.zip") -Force -ErrorAction SilentlyContinue

$psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$launcherScript = Join-Path $appDir "KalptenKaleme.ps1"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnkPath)
$sc.TargetPath = $psExe
$sc.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -STA -File `"$launcherScript`""
$sc.WorkingDirectory = $appDir
$sc.IconLocation = "$iconPath,0"
$sc.Description = "Kalpten Kaleme - Edebi Yazı, PDF ve Sunum Stüdyosu"
$sc.WindowStyle = 1
$sc.Save()

# Also register background server in CurrentUser Run so localhost:52480 is always active on login
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$serverCmd = "`"$psExe`" -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$appDir\server.ps1`" -Daemon"
Set-ItemProperty -Path $runKey -Name "KalptenKalemeServer" -Value $serverCmd -Force -ErrorAction SilentlyContinue

Write-Host "SHORTCUT_CREATED_SUCCESSFULLY"

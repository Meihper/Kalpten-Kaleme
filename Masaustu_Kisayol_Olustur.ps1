$ErrorActionPreference = "SilentlyContinue"
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
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

# Locate Microsoft-signed Edge executable (100% immune to Windows 11 Smart App Control)
$edgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$edgeExe = $null
foreach ($p in $edgePaths) {
    if (Test-Path $p) {
        $edgeExe = $p
        break
    }
}

$fileUrl = "file:///" + ($appDir.Replace('\', '/')) + "/index.html"
$profileDir = Join-Path $appDir "profile"
$antiSyncFlags = "--allow-file-access-from-files --no-first-run --no-default-browser-check --disable-sync --disable-features=msEdgeAutoSignIn,msEdgeFirstRunExperience,msEdgeFreV2,msEdgeSyncNotice,msEdgeShowFirstRunNotification,msEdgeSignInOptIn,msEdgeFrePromo,msEdgeWelcomePageExperience,msEdgeStartupBoost"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnkPath)
if ($edgeExe) {
    $sc.TargetPath = $edgeExe
    $sc.Arguments = "--app=`"$fileUrl`" --user-data-dir=`"$profileDir`" $antiSyncFlags --window-size=1280,820"
} else {
    $sc.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $sc.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$appDir\server.ps1`""
}
$sc.WorkingDirectory = $appDir
$sc.IconLocation = "$iconPath,0"
$sc.Description = "Kalpten Kaleme - Edebi Yazı, PDF ve Sunum Stüdyosu"
$sc.WindowStyle = 1
$sc.Save()

# Also register background server in CurrentUser Run so localhost:52480 is always active on login
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$serverCmd = "`"$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe`" -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$appDir\server.ps1`" -Daemon"
Set-ItemProperty -Path $runKey -Name "KalptenKalemeServer" -Value $serverCmd -Force -ErrorAction SilentlyContinue

# Ensure background server is running right now (detached via WMI if not already listening)
$isListening = $false
try {
    $req = [System.Net.WebRequest]::Create("http://localhost:52480/api/heartbeat")
    $req.Timeout = 600
    $resp = $req.GetResponse()
    $resp.Close()
    $isListening = $true
} catch {}

if (-not $isListening) {
    Start-Process "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$appDir\server.ps1`" -Daemon" -WindowStyle Hidden
}


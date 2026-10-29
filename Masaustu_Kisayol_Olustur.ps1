$ErrorActionPreference = "SilentlyContinue"
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $appDir

# Unblock all files in case extracted from a downloaded ZIP
Get-ChildItem -Path $appDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

$desktopDir = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktopDir "Kalpten Kaleme.lnk"
$iconPath = Join-Path $appDir "app.ico"
if (-not (Test-Path $iconPath)) { $iconPath = Join-Path $appDir "BelgeDuzenleyici.ico" }

$vbsPath = Join-Path $appDir "launcher.vbs"
$wscript = "$env:SystemRoot\System32\wscript.exe"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnkPath)
$sc.TargetPath = $wscript
$sc.Arguments = "`"$vbsPath`""
$sc.WorkingDirectory = $appDir
$sc.IconLocation = "$iconPath,0"
$sc.Description = "Kalpten Kaleme - Edebi Yazı, PDF ve Sunum Stüdyosu"
$sc.WindowStyle = 1
$sc.Save()

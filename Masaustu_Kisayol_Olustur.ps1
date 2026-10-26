$ErrorActionPreference = "SilentlyContinue"
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $appDir

# Ensure local native executable is compiled and unblocked on this machine
Get-ChildItem -Path $appDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

$exePath = Join-Path $appDir "KalptenKaleme.exe"
$csPath = Join-Path $appDir "BelgeDuzenleyici.cs"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if ((Test-Path $csc) -and (Test-Path $csPath)) {
    & $csc /nologo /target:winexe /platform:x64 /optimize+ `
        /win32icon:"$appDir\BelgeDuzenleyici.ico" `
        /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Net.dll `
        /r:"$appDir\Microsoft.Web.WebView2.Core.dll" `
        /r:"$appDir\Microsoft.Web.WebView2.WinForms.dll" `
        /out:"$exePath" `
        "$csPath" | Out-Null
    Copy-Item $exePath (Join-Path $appDir "BelgeDuzenleyici.exe") -Force -ErrorAction SilentlyContinue
}

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

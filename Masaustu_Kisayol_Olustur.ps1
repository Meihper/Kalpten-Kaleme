$ErrorActionPreference = "SilentlyContinue"
$appDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($appDir)) {
    $appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
Set-Location $appDir

# Clean up any leftover background Run registry entries
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KalptenKalemeServer" -Force -ErrorAction SilentlyContinue

$desktopDir = [Environment]::GetFolderPath("Desktop")
$startMenuDir = [Environment]::GetFolderPath("Programs")
$lnkPaths = @(
    (Join-Path $desktopDir "Kalpten Kaleme.lnk"),
    (Join-Path $startMenuDir "Kalpten Kaleme.lnk")
)

$iconPath = Join-Path $appDir "app.ico"
if (-not (Test-Path $iconPath)) { $iconPath = Join-Path $appDir "BelgeDuzenleyici.ico" }
if (-not (Test-Path $iconPath)) { $iconPath = Join-Path $appDir "kk_lux_app.ico" }

$vbsPath = Join-Path $appDir "Baslat.vbs"
$wscriptExe = Join-Path $env:SystemRoot "System32\wscript.exe"
$nativeScript = Join-Path $appDir "KalptenKaleme.ps1"
$serverScript = Join-Path $appDir "server.ps1"
$psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

$sacEnforced = $false
try {
    $sacVal = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -Name "VerifiedAndReputablePolicyState" -ErrorAction SilentlyContinue).VerifiedAndReputablePolicyState
    if ($sacVal -eq 1) { $sacEnforced = $true }
} catch {}
$exePath = Join-Path $appDir "KalptenKaleme.exe"

$wsh = New-Object -ComObject WScript.Shell
foreach ($lnkPath in $lnkPaths) {
    if ([string]::IsNullOrWhiteSpace($lnkPath)) { continue }
    $sc = $wsh.CreateShortcut($lnkPath)
    if ((Test-Path $vbsPath) -and (Test-Path $wscriptExe)) {
        $sc.TargetPath = $wscriptExe
        $sc.Arguments = "//nologo `"$vbsPath`""
    } elseif (-not $sacEnforced -and (Test-Path $exePath)) {
        $sc.TargetPath = $exePath
        $sc.Arguments = ""
    } elseif (Test-Path $nativeScript) {
        $sc.TargetPath = $psExe
        $sc.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$nativeScript`""
    } else {
        $sc.TargetPath = $psExe
        $sc.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$serverScript`""
    }
    $sc.WorkingDirectory = $appDir
    $sc.IconLocation = "$iconPath,0"
    $sc.Description = "Kalpten Kaleme - Yazı, PDF ve Sunum Stüdyosu"
    $sc.WindowStyle = 7
    $sc.Save()
}

Write-Host "SHORTCUT_CREATED_SUCCESSFULLY"

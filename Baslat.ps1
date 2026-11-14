$ErrorActionPreference = "SilentlyContinue"
$appDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($appDir)) {
    $appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
Set-Location $appDir

# Unblock all files in case extracted from a downloaded ZIP
Get-ChildItem -Path $appDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

# Check Windows 11 Smart App Control (SAC): 1 = Enforced
$sacEnforced = $false
try {
    $sacVal = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -Name "VerifiedAndReputablePolicyState" -ErrorAction SilentlyContinue).VerifiedAndReputablePolicyState
    if ($sacVal -eq 1) { $sacEnforced = $true }
} catch {}

$exePath = Join-Path $appDir "KalptenKaleme.exe"
if (-not $sacEnforced -and (Test-Path $exePath)) {
    try {
        if ($args -and $args.Count -gt 0) {
            Start-Process $exePath -ArgumentList "`"$($args[0])`""
        } else {
            Start-Process $exePath
        }
        exit
    } catch {}
}

$nativeScript = Join-Path $appDir "KalptenKaleme.ps1"
if (Test-Path $nativeScript) {
    if ($args -and $args.Count -gt 0) {
        & $nativeScript -FilePath $args[0]
    } else {
        & $nativeScript
    }
    exit
}

$serverScript = Join-Path $appDir "server.ps1"
if ($args -and $args.Count -gt 0) {
    & $serverScript -FilePath $args[0]
} else {
    & $serverScript
}

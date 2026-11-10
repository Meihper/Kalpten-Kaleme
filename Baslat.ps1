$ErrorActionPreference = "SilentlyContinue"
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $appDir

# Unblock all files in case extracted from a downloaded ZIP
Get-ChildItem -Path $appDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

$exePath = Join-Path $appDir "KalptenKaleme.exe"
if (Test-Path $exePath) {
    if ($args -and $args.Count -gt 0) {
        Start-Process $exePath -ArgumentList $args[0]
    } else {
        Start-Process $exePath
    }
    exit
}

$serverScript = Join-Path $appDir "server.ps1"
if ($args -and $args.Count -gt 0) {
    & $serverScript -FilePath $args[0]
} else {
    & $serverScript
}

# ==============================================================================
# Kalpten Kaleme - 3D Ultra-Professional Icon & System Integrator
# ==============================================================================

$rootDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($rootDir)) {
    $rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

& (Join-Path $rootDir "Masaustu_Kisayol_Olustur.ps1")
& (Join-Path $rootDir "apply_file_icons.ps1")

Write-Host "ALL_SYSTEM_ICONS_APPLIED_SUCCESSFULLY" -ForegroundColor Green

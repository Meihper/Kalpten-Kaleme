# ==============================================================================
# Kalpten Kaleme - 3D Ultra-Professional Icon & System Integrator
# ==============================================================================

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($rootDir)) {
    $rootDir = "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice"
}

& (Join-Path $rootDir "Masaustu_Kisayol_Olustur.ps1")
& (Join-Path $rootDir "apply_file_icons.ps1")

Write-Host "ALL_SYSTEM_ICONS_APPLIED_SUCCESSFULLY" -ForegroundColor Green

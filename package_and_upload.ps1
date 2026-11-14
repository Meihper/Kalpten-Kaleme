$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($rootDir)) {
    $rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
Set-Location $rootDir

Write-Host "=========================================="
Write-Host "1. BUILDING SAC-SAFE WINDOWS SINGLE-FILE STUDIO"
Write-Host "=========================================="

# Build standalone Kalpten Kaleme.html and package only Kalpten Kaleme.html into KalptenKaleme-Windows.zip
& "$rootDir\build_windows_standalone.ps1"

$projectZip = Join-Path $rootDir "KalptenKaleme-Windows.zip"
Write-Host "Windows SAC-Safe Single-File Studio ZIP ready at $projectZip ($([Math]::Round((Get-Item $projectZip).Length / 1MB, 2)) MB)"

Write-Host "`n=========================================="
Write-Host "2. COMMITTING AND PUSHING TO GITHUB"
Write-Host "=========================================="

git add .gitignore index.html styles.css app.js sw.js word-editor.js ppt-editor.js pdf-editor.js pdf-tools.js manifest.json check_compile.ps1 build_windows_standalone.ps1 package_and_upload.ps1 "Kalpten Kaleme.html" KalptenKaleme-Windows.zip README.md
$status = git status --porcelain
if ($status) {
    git commit -m 'feat(windows): SAC-safe desktop PWA installer and single-file Kalpten Kaleme.html package'
}
git push origin main

Write-Host "`nALL DONE!"

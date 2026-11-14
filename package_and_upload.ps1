$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($rootDir)) {
    $rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
Set-Location $rootDir

Write-Host "=========================================="
Write-Host "1. BUILDING WINDOWS DESKTOP STUDIO SUITE"
Write-Host "=========================================="

& (Join-Path $rootDir "build_windows_standalone.ps1")

$projectApk = Join-Path $rootDir "KalptenKaleme.apk"
$projectZip = Join-Path $rootDir "KalptenKaleme-Windows.zip"

$stageDir = Join-Path $env:TEMP "KK_Win_Stage_Suite"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

$winFiles = @(
    "Kurulum_Baslat.bat",
    "Baslat.bat",
    "Baslat.ps1",
    "Baslat.vbs",
    "launcher.vbs",
    "KalptenKaleme.ps1",
    "server.ps1",
    "BelgeDuzenleyici.cs",
    "Microsoft.Web.WebView2.Core.dll",
    "Microsoft.Web.WebView2.WinForms.dll",
    "WebView2Loader.dll",
    "Masaustu_Kisayol_Olustur.ps1",
    "register_open_with.ps1",
    "apply_file_icons.ps1",
    "apply_3d_system_icons.ps1",
    "index.html",
    "styles.css",
    "app.js",
    "word-editor.js",
    "pdf-editor.js",
    "pdf-tools.js",
    "ppt-editor.js",
    "manifest.json",
    "app.ico",
    "app.png",
    "BelgeDuzenleyici.ico",
    "favicon.ico",
    "favicon.png",
    "icon-192.png",
    "icon-512.png",
    "docx_file.png",
    "pdf_file.png",
    "pptx_file.png",
    "tools_file.png",
    "kk_lux_app.ico",
    "kk_lux_app.png",
    "kk_lux_docx.png",
    "kk_lux_pdf.png",
    "kalpten_kaleme_logo3.ico",
    "KULLANIM_KILAVUZU.txt"
)

foreach ($f in $winFiles) {
    $src = Join-Path $rootDir $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $stageDir $f) -Force
    }
}

$vendorSrc = Join-Path $rootDir "vendor"
if (Test-Path $vendorSrc) {
    Copy-Item $vendorSrc (Join-Path $stageDir "vendor") -Recurse -Force
}

if (Test-Path $projectZip) { Remove-Item $projectZip -Force }
Compress-Archive -Path "$stageDir\*" -DestinationPath $projectZip -Force
Remove-Item $stageDir -Recurse -Force

Write-Host "Windows Desktop Suite ZIP created at $projectZip ($([Math]::Round((Get-Item $projectZip).Length / 1MB, 2)) MB)"

Write-Host "`n=========================================="
Write-Host "2. COMMITTING AND PUSHING TO GITHUB"
Write-Host "=========================================="

git add .gitignore index.html styles.css app.js word-editor.js ppt-editor.js pdf-editor.js pdf-tools.js manifest.json check_compile.ps1 build_windows_standalone.ps1 package_and_upload.ps1 "Kalpten Kaleme.html" Kurulum_Baslat.bat Baslat.bat Baslat.ps1 Baslat.vbs launcher.vbs KalptenKaleme.ps1 server.ps1 BelgeDuzenleyici.cs Masaustu_Kisayol_Olustur.ps1 register_open_with.ps1 apply_file_icons.ps1 apply_3d_system_icons.ps1 KULLANIM_KILAVUZU.txt README.md
$status = git status --porcelain
if ($status) {
    git commit -m 'feat(windows): package browserless SAC-safe desktop studio in KalptenKaleme-Windows.zip'
    git push origin main
    Write-Host "Git push completed."
} else {
    Write-Host "No unstaged changes to commit."
}

Write-Host "`n=========================================="
Write-Host "3. SYNCING GITHUB RELEASE v1.0.0"
Write-Host "=========================================="

if (Get-Command gh -ErrorAction SilentlyContinue) {
    if (Test-Path $projectApk) { gh release upload v1.0.0 $projectApk --clobber }
    gh release upload v1.0.0 $projectZip --clobber
} else {
    $credFile = Join-Path $env:TEMP "git_cred_input.txt"
    [System.IO.File]::WriteAllBytes($credFile, [System.Text.Encoding]::ASCII.GetBytes("protocol=https`r`nhost=github.com`r`n`r`n"))
    $credOut = cmd.exe /c "git credential fill < `"$credFile`"" 2>&1
    Remove-Item $credFile -Force -ErrorAction SilentlyContinue

    $tokenLine = ($credOut -split "`r?`n") | Where-Object { $_ -match "^password=" } | Select-Object -First 1
    $token = ($tokenLine -replace "^password=", "").Trim()

    $headers = @{
        Authorization = "Bearer $token"
        Accept = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
        "User-Agent" = "KalptenKaleme-Deployer"
    }

    $owner = "Meihper"
    $repoName = "Kalpten-Kaleme"

    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/releases/tags/v1.0.0" -Headers $headers -Method Get
    foreach ($asset in $release.assets) {
        if ($asset.name -eq "KalptenKaleme.apk" -or $asset.name -eq "KalptenKaleme-Windows.zip") {
            Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/releases/assets/$($asset.id)" -Headers $headers -Method Delete
        }
    }

    $uploadUrlBase = ($release.upload_url -replace "\{\?name,label\}$", "")
    if (Test-Path $projectApk) {
        $apkBytes = [System.IO.File]::ReadAllBytes($projectApk)
        Invoke-RestMethod -Uri "${uploadUrlBase}?name=KalptenKaleme.apk" -Headers $headers -Method Post -Body $apkBytes -ContentType "application/vnd.android.package-archive" | Out-Null
    }
    $zipBytes = [System.IO.File]::ReadAllBytes($projectZip)
    $zipAsset = Invoke-RestMethod -Uri "${uploadUrlBase}?name=KalptenKaleme-Windows.zip" -Headers $headers -Method Post -Body $zipBytes -ContentType "application/zip"
    Write-Host "Uploaded Windows ZIP: $($zipAsset.browser_download_url)"
}

Write-Host "`n=========================================="
Write-Host "SUCCESS: Release v1.0.0 updated on GitHub!"
Write-Host "=========================================="

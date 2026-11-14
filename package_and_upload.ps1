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
    "Setup_Wizard.ps1",
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
    "favicon.ico",
    "icon-192.png",
    "docx_file.png",
    "pdf_file.png",
    "pptx_file.png",
    "tools_file.png",
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

$innerZip = Join-Path $env:TEMP "KK_Inner_Payload.zip"
if (Test-Path $innerZip) { Remove-Item $innerZip -Force }
Compress-Archive -Path "$stageDir\*" -DestinationPath $innerZip -Force
Remove-Item $stageDir -Recurse -Force

# Build single-file GUI installer (Kalpten_Kaleme_Setup.bat)
$wizardBytes = [System.IO.File]::ReadAllBytes((Join-Path $rootDir "Setup_Wizard.ps1"))
$wizardB64 = [Convert]::ToBase64String($wizardBytes)
$payloadBytes = [System.IO.File]::ReadAllBytes($innerZip)
$payloadB64 = [Convert]::ToBase64String($payloadBytes)
Remove-Item $innerZip -Force -ErrorAction SilentlyContinue

$sbBat = New-Object System.Text.StringBuilder
[void]$sbBat.AppendLine("@echo off")
[void]$sbBat.AppendLine("title Kalpten Kaleme - Kurulum Sihirbazi")
[void]$sbBat.AppendLine("setlocal EnableExtensions")
[void]$sbBat.AppendLine("set `"KK_SETUP_FILE=%~f0`"")
[void]$sbBat.AppendLine("set `"PS_EXE=%SystemRoot%\SysNative\WindowsPowerShell\v1.0\powershell.exe`"")
[void]$sbBat.AppendLine("if not exist `"%PS_EXE%`" set `"PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`"")
[void]$sbBat.AppendLine("start `"`" `"%PS_EXE%`" -WindowStyle Hidden -NoProfile -STA -ExecutionPolicy Bypass -Command `"`$lines = [System.IO.File]::ReadAllLines(`$env:KK_SETUP_FILE, [System.Text.Encoding]::ASCII); `$sb = New-Object System.Text.StringBuilder; `$inW = `$false; foreach (`$l in `$lines) { if (`$l -eq '::KK_WIZARD_BEGIN') { `$inW = `$true; continue }; if (`$l -eq '::KK_WIZARD_END') { break }; if (`$inW -and `$l.StartsWith('::')) { [void]`$sb.Append(`$l.Substring(2).Trim()) } }; `$wizPath = Join-Path `$env:TEMP 'KK_Setup_Wizard.ps1'; [System.IO.File]::WriteAllBytes(`$wizPath, [Convert]::FromBase64String(`$sb.ToString())); & `$wizPath`"")
[void]$sbBat.AppendLine("exit /b 0")
[void]$sbBat.AppendLine("::KK_WIZARD_BEGIN")
for ($i = 0; $i -lt $wizardB64.Length; $i += 120) {
    $len = [Math]::Min(120, $wizardB64.Length - $i)
    [void]$sbBat.AppendLine("::" + $wizardB64.Substring($i, $len))
}
[void]$sbBat.AppendLine("::KK_WIZARD_END")
[void]$sbBat.AppendLine("::KK_PAYLOAD_BEGIN")
for ($i = 0; $i -lt $payloadB64.Length; $i += 120) {
    $len = [Math]::Min(120, $payloadB64.Length - $i)
    [void]$sbBat.AppendLine("::" + $payloadB64.Substring($i, $len))
}
[void]$sbBat.AppendLine("::KK_PAYLOAD_END")

$setupStageDir = Join-Path $env:TEMP "KK_Single_Setup_Stage"
if (Test-Path $setupStageDir) { Remove-Item $setupStageDir -Recurse -Force }
New-Item -ItemType Directory -Path $setupStageDir -Force | Out-Null
$singleSetupPath = Join-Path $setupStageDir "Kalpten_Kaleme_Setup.bat"
[System.IO.File]::WriteAllBytes($singleSetupPath, [System.Text.Encoding]::ASCII.GetBytes($sbBat.ToString()))

if (Test-Path $projectZip) { Remove-Item $projectZip -Force }
Compress-Archive -Path $singleSetupPath -DestinationPath $projectZip -Force
Remove-Item $setupStageDir -Recurse -Force

Write-Host "Windows Single-File Setup ZIP created at $projectZip ($([Math]::Round((Get-Item $projectZip).Length / 1MB, 2)) MB)"

Write-Host "`n=========================================="
Write-Host "2. COMMITTING AND PUSHING TO GITHUB"
Write-Host "=========================================="

git add .gitignore index.html styles.css app.js word-editor.js ppt-editor.js pdf-editor.js pdf-tools.js manifest.json check_compile.ps1 build_windows_standalone.ps1 package_and_upload.ps1 Setup_Wizard.ps1 "Kalpten Kaleme.html" KalptenKaleme-Windows.zip Kurulum_Baslat.bat Baslat.bat Baslat.ps1 Baslat.vbs launcher.vbs KalptenKaleme.ps1 server.ps1 BelgeDuzenleyici.cs Masaustu_Kisayol_Olustur.ps1 register_open_with.ps1 apply_file_icons.ps1 apply_3d_system_icons.ps1 KULLANIM_KILAVUZU.txt README.md
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

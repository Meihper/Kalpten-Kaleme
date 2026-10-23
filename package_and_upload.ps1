$ErrorActionPreference = "Stop"
Set-Location "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice"

Write-Host "=========================================="
Write-Host "1. PREPARING WINDOWS ZIP"
Write-Host "=========================================="

$desktopApk = "C:\Users\Erdem\Desktop\KalptenKaleme.apk"
$desktopZip = "C:\Users\Erdem\Desktop\KalptenKaleme-Windows.zip"
$artifactDir = "C:\Users\Erdem\.gemini\antigravity\brain\fc7d5a54-3292-42a2-b99e-ca574ab289ce"

# Sync desktop APK to repo root
if (Test-Path $desktopApk) {
    Copy-Item $desktopApk "KalptenKaleme.apk" -Force
    Copy-Item $desktopApk (Join-Path $artifactDir "KalptenKaleme.apk") -Force
    Write-Host "APK copied to repo root and brain artifact directory."
}

# Create staging dir for clean Windows zip
$stageDir = Join-Path $env:TEMP "KK_Win_Stage"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

$filesToInclude = @(
    "index.html", "styles.css", "app.js", "word-editor.js", "ppt-editor.js", "pdf-editor.js", "pdf-tools.js",
    "manifest.json", "README.md", "BelgeDuzenleyici.cs", "BelgeDuzenleyici.exe", "Baslat.bat", "Baslat.ps1", "Baslat.vbs",
    "Kurulum_Baslat.bat", "Dosya_Simgelerini_Uygula.bat", "Dosya_Simgelerini_Varsayilana_Dondur.bat",
    "BelgeDuzenleyici.ico", "favicon.ico", "app.ico", "docx_file.ico", "pdf_file.ico", "kk_pptx.ico",
    "app.png", "docx_file.png", "pdf_file.png", "pptx_file.png", "tools_file.png",
    "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "KalptenKaleme.exe"
)

foreach ($f in $filesToInclude) {
    if (Test-Path $f) {
        Copy-Item $f (Join-Path $stageDir $f) -Force
    }
}

if (Test-Path "vendor") {
    Copy-Item "vendor" (Join-Path $stageDir "vendor") -Recurse -Force
}

if (Test-Path "runtimes") {
    Copy-Item "runtimes" (Join-Path $stageDir "runtimes") -Recurse -Force
}

if (Test-Path $desktopZip) { Remove-Item $desktopZip -Force }
Compress-Archive -Path "$stageDir\*" -DestinationPath $desktopZip -Force
Copy-Item $desktopZip (Join-Path $artifactDir "KalptenKaleme-Windows.zip") -Force
Remove-Item $stageDir -Recurse -Force

Write-Host "Windows ZIP created at $desktopZip ($([Math]::Round((Get-Item $desktopZip).Length / 1MB, 2)) MB)"

Write-Host "`n=========================================="
Write-Host "2. COMMITTING AND PUSHING TO GITHUB"
Write-Host "=========================================="

git add index.html word-editor.js ppt-editor.js pdf-editor.js pdf-tools.js styles.css app.js BelgeDuzenleyici.cs BelgeDuzenleyici.exe server.ps1 build_android_apk.ps1 package_and_upload.ps1 android/AndroidManifest.xml android/src/com/kalpten/kaleme/MainActivity.java android/assets/www/ android/KalptenKaleme_Signed.apk android/KalptenKaleme_Signed.apk.idsig KalptenKaleme.apk
$status = git status --porcelain
if ($status) {
    git commit -m 'fix(mobile): restore pure minimalist word literary studio on mobile (pdf, ppt and tools preserved exclusively on desktop suite)'
    git push origin main
    Write-Host "Git push completed."
} else {
    Write-Host "No unstaged changes to commit."
}

Write-Host "`n=========================================="
Write-Host "3. SYNCING GITHUB RELEASE v1.0.0"
Write-Host "=========================================="

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
Write-Host "Found Release: $($release.name) ($($release.html_url))"

# Delete old assets if they exist
foreach ($asset in $release.assets) {
    if ($asset.name -eq "KalptenKaleme.apk" -or $asset.name -eq "KalptenKaleme-Windows.zip") {
        Write-Host "Deleting outdated asset $($asset.name) (ID: $($asset.id))..."
        Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/releases/assets/$($asset.id)" -Headers $headers -Method Delete
    }
}

$uploadUrlBase = ($release.upload_url -replace "\{\?name,label\}$", "")

# Upload new APK
Write-Host "Uploading new KalptenKaleme.apk ($([Math]::Round((Get-Item $desktopApk).Length / 1MB, 2)) MB)..."
$apkBytes = [System.IO.File]::ReadAllBytes($desktopApk)
$apkAsset = Invoke-RestMethod -Uri "${uploadUrlBase}?name=KalptenKaleme.apk" -Headers $headers -Method Post -Body $apkBytes -ContentType "application/vnd.android.package-archive"
Write-Host "Uploaded APK: $($apkAsset.browser_download_url)"

# Upload new ZIP
Write-Host "Uploading new KalptenKaleme-Windows.zip ($([Math]::Round((Get-Item $desktopZip).Length / 1MB, 2)) MB)..."
$zipBytes = [System.IO.File]::ReadAllBytes($desktopZip)
$zipAsset = Invoke-RestMethod -Uri "${uploadUrlBase}?name=KalptenKaleme-Windows.zip" -Headers $headers -Method Post -Body $zipBytes -ContentType "application/zip"
Write-Host "Uploaded Windows ZIP: $($zipAsset.browser_download_url)"

Write-Host "`n=========================================="
Write-Host "SUCCESS: Release v1.0.0 updated on GitHub!"
Write-Host "=========================================="

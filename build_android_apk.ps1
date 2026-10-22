param(
    [switch]$VerboseOutput = $true
)

$ErrorActionPreference = "Stop"

$baseDir = "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice"
$androidDir = Join-Path $baseDir "android"
$desktopApk = "C:\Users\Erdem\Desktop\KalptenKaleme.apk"
$projectApk = Join-Path $baseDir "KalptenKaleme.apk"

# Toolchain Paths
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;" + $env:PATH

$sdkDir = "C:\Users\Erdem\AppData\Local\Android\Sdk"
$buildToolsDir = "$sdkDir\build-tools\35.0.0"
$androidJar = "$sdkDir\platforms\android-35\android.jar"

$aaptExe = "$buildToolsDir\aapt.exe"
$d8Bat = "$buildToolsDir\d8.bat"
$zipalignExe = "$buildToolsDir\zipalign.exe"
$apksignerBat = "$buildToolsDir\apksigner.bat"
$javacExe = "$javaHome\bin\javac.exe"
$keytoolExe = "$javaHome\bin\keytool.exe"

Write-Host "=========================================="
Write-Host "Building Kalpten Kaleme Android APK"
Write-Host "=========================================="

# 1. Clean / Create directories
$srcDir = Join-Path $androidDir "src\com\kalpten\kaleme"
$resDir = Join-Path $androidDir "res"
$assetsDir = Join-Path $androidDir "assets\www"
$objDir = Join-Path $androidDir "obj"
$binDir = Join-Path $androidDir "bin"

New-Item -ItemType Directory -Force -Path $srcDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $resDir "values") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $resDir "drawable") | Out-Null
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
New-Item -ItemType Directory -Force -Path $objDir | Out-Null
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

# 2. Generate Mipmap Icons
Add-Type -AssemblyName System.Drawing
$sourceIcon = Join-Path $baseDir "kk_lux_app.png"
if (! (Test-Path $sourceIcon)) {
    $sourceIcon = Join-Path $baseDir "app.png"
}

$iconSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

$srcBmp = [System.Drawing.Bitmap]::FromFile($sourceIcon)
foreach ($folder in $iconSizes.Keys) {
    $targetDir = Join-Path $resDir $folder
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    $sz = $iconSizes[$folder]
    $resized = New-Object System.Drawing.Bitmap $sz, $sz
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcBmp, 0, 0, $sz, $sz)
    $resized.Save((Join-Path $targetDir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $resized.Dispose()
}
$srcBmp.Dispose()
Write-Host "Generated Android luxury launcher icons."

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# 3. AndroidManifest.xml Verification
$manifestPath = Join-Path $androidDir "AndroidManifest.xml"
if (! (Test-Path $manifestPath)) {
    throw "AndroidManifest.xml not found at $manifestPath"
}
Write-Host "Using comprehensive AndroidManifest.xml (Word/PDF/Wildcard intent filters active)."

# 4. Create res/values/strings.xml & styles.xml
$stringsXml = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Kalpten Kaleme</string>
</resources>
"@
[System.IO.File]::WriteAllText((Join-Path $resDir "values\strings.xml"), $stringsXml, $utf8NoBom)

$stylesXml = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="@android:style/Theme.Material.NoActionBar">
        <item name="android:statusBarColor">#141926</item>
        <item name="android:navigationBarColor">#0D111A</item>
        <item name="android:windowBackground">#141926</item>
    </style>
</resources>
"@
[System.IO.File]::WriteAllText((Join-Path $resDir "values\styles.xml"), $stylesXml, $utf8NoBom)

# 5. MainActivity.java Verification
$mainActivityPath = Join-Path $srcDir "MainActivity.java"
if (! (Test-Path $mainActivityPath)) {
    throw "MainActivity.java not found at $mainActivityPath"
}
Write-Host "Using updated MainActivity.java with Open With intent handling & Kütüphane scanning."

# 6. Copy Web Assets to assets/www
$filesToCopy = @(
    "index.html",
    "styles.css",
    "app.js",
    "word-editor.js",
    "pdf-editor.js",
    "pdf-tools.js",
    "ppt-editor.js",
    "manifest.json",
    "favicon.ico",
    "app.png",
    "icon-192.png",
    "icon-512.png",
    "docx_file.png",
    "pdf_file.png",
    "pptx_file.png",
    "tools_file.png",
    "kk_lux_app.png",
    "kk_lux_pdf.png",
    "kk_lux_docx.png"
)

foreach ($f in $filesToCopy) {
    $src = Join-Path $baseDir $f
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $assetsDir $f) -Force
    }
}

# Copy vendor directory recursively
$vendorSrc = Join-Path $baseDir "vendor"
$vendorDest = Join-Path $assetsDir "vendor"
if (Test-Path $vendorSrc) {
    Copy-Item -Path $vendorSrc -Destination $assetsDir -Recurse -Force
}
Write-Host "Web application assets bundled into assets/www."

# 7. Generate R.java with AAPT
Write-Host "Generating R.java with AAPT..."
$aaptArgs = @(
    "package",
    "-m",
    "-J", (Join-Path $androidDir "src"),
    "-M", $manifestPath,
    "-S", $resDir,
    "-I", $androidJar
)
& $aaptExe $aaptArgs

# 8. Compile Java sources with Javac
Write-Host "Compiling Java sources..."
$javaFiles = Get-ChildItem -Path (Join-Path $androidDir "src") -Filter "*.java" -Recurse | Select-Object -ExpandProperty FullName
$javacArgs = @(
    "-encoding", "UTF-8",
    "--release", "8",
    "-cp", "$($androidDir)\src;$androidJar",
    "-d", $objDir
) + $javaFiles
& $javacExe $javacArgs
if ($LASTEXITCODE -ne 0) {
    throw "Java compilation failed with code $LASTEXITCODE"
}

# 9. Convert bytecode to Dalvik DEX with D8
Write-Host "Converting bytecode to classes.dex with D8..."
$classFiles = Get-ChildItem -Path $objDir -Filter "*.class" -Recurse | Select-Object -ExpandProperty FullName
if (! $classFiles) {
    throw "No compiled class files found in $objDir"
}
$d8Cmd = "`"$d8Bat`" --output `"$binDir`" --lib `"$androidJar`" " + (($classFiles | ForEach-Object { "`"$_`"" }) -join ' ')
cmd /c $d8Cmd
if ($LASTEXITCODE -ne 0) {
    throw "D8 conversion failed with code $LASTEXITCODE"
}

# 10. Package Unaligned APK with AAPT
Write-Host "Packaging APK..."
$unalignedApk = Join-Path $binDir "KalptenKaleme.unaligned.apk"
if (Test-Path $unalignedApk) { Remove-Item -Force $unalignedApk }

$aaptPackageArgs = @(
    "package",
    "-f",
    "-M", $manifestPath,
    "-S", $resDir,
    "-A", (Join-Path $androidDir "assets"),
    "-I", $androidJar,
    "-F", $unalignedApk
)
& $aaptExe $aaptPackageArgs

# Add classes.dex to APK
Write-Host "Adding classes.dex into APK..."
Push-Location $binDir
try {
    & $aaptExe add -v (Join-Path $binDir "KalptenKaleme.unaligned.apk") "classes.dex"
} finally {
    Pop-Location
}

# 11. Zipalign APK
Write-Host "Aligning APK with zipalign..."
$alignedApk = Join-Path $binDir "KalptenKaleme.aligned.apk"
if (Test-Path $alignedApk) { Remove-Item -Force $alignedApk }
& $zipalignExe -f -p 4 $unalignedApk $alignedApk

# 12. Create Keystore if needed and Sign APK
$keystorePath = Join-Path $androidDir "kalpten.keystore"
if (! (Test-Path $keystorePath)) {
    Write-Host "Generating release keystore..."
    $keytoolArgs = @(
        "-genkeypair",
        "-v",
        "-keystore", $keystorePath,
        "-alias", "kalpten",
        "-keyalg", "RSA",
        "-keysize", "2048",
        "-validity", "10000",
        "-storepass", "kalpten123",
        "-keypass", "kalpten123",
        "-dname", "CN=KalptenKaleme, O=Kalpten, C=TR"
    )
    & $keytoolExe $keytoolArgs
}

Write-Host "Signing APK with apksigner..."
$finalApkPath = Join-Path $androidDir "KalptenKaleme_Signed.apk"
cmd /c "`"$apksignerBat`" sign --ks `"$keystorePath`" --ks-pass pass:kalpten123 --out `"$finalApkPath`" `"$alignedApk`""

# 13. Copy Final APK to Desktop, Project Root, Documents, and Artifact dir
Copy-Item -Path $finalApkPath -Destination $desktopApk -Force
Copy-Item -Path $finalApkPath -Destination $projectApk -Force

$artifactDir = "C:\Users\Erdem\.gemini\antigravity\brain\fc7d5a54-3292-42a2-b99e-ca574ab289ce"
if (Test-Path $artifactDir) {
    Copy-Item -Path $finalApkPath -Destination (Join-Path $artifactDir "KalptenKaleme.apk") -Force
}

$docsDir = "C:\Users\Erdem\Documents\Kalpten Kaleme"
if (Test-Path $docsDir) {
    Copy-Item -Path $finalApkPath -Destination (Join-Path $docsDir "KalptenKaleme.apk") -Force
}

$apkSize = (Get-Item $desktopApk).Length / 1MB
Write-Host "=========================================="
Write-Host "SUCCESS: Android APK Created!"
Write-Host "Desktop Path: $desktopApk"
Write-Host "Size: $([math]::Round($apkSize, 2)) MB"
Write-Host "=========================================="

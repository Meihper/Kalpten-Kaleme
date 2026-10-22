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

# 3. Create AndroidManifest.xml
$manifestContent = @"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.kalpten.kaleme"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk
        android:minSdkVersion="24"
        android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />

    <application
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher"
        android:theme="@style/AppTheme"
        android:hardwareAccelerated="true"
        android:allowBackup="true"
        android:supportsRtl="true"
        android:requestLegacyExternalStorage="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize|screenLayout"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
"@
[System.IO.File]::WriteAllText((Join-Path $androidDir "AndroidManifest.xml"), $manifestContent, $utf8NoBom)

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

# 5. Create MainActivity.java
$mainActivityJava = @"
package com.kalpten.kaleme;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private WebView webView;
    private ValueCallback<Uri[]> uploadMessage;
    private long backPressedTime = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Modern Edge-to-Edge immersion with dark luxury status bar
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.setStatusBarColor(0xFF141926);
        window.setNavigationBarColor(0xFF0D111A);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                String[] mimes = {
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/msword",
                    "application/pdf",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    "application/vnd.ms-powerpoint",
                    "application/json",
                    "text/plain",
                    "text/html",
                    "image/*"
                };
                intent.putExtra(Intent.EXTRA_MIME_TYPES, mimes);
                try {
                    startActivityForResult(Intent.createChooser(intent, "Belge Seç"), FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Exception e) {
                    if (uploadMessage != null) {
                        uploadMessage.onReceiveValue(null);
                        uploadMessage = null;
                    }
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");

        // Load offline embedded application
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (uploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{ data.getData() };
                }
            }
            uploadMessage.onReceiveValue(results);
            uploadMessage = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("window.__handleAndroidBack ? window.__handleAndroidBack() : false;", new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String value) {
                    if (!"true".equalsIgnoreCase(value)) {
                        if (backPressedTime + 2000 > System.currentTimeMillis()) {
                            finish();
                        } else {
                            Toast.makeText(MainActivity.this, "Çıkmak için tekrar basın", Toast.LENGTH_SHORT).show();
                            backPressedTime = System.currentTimeMillis();
                        }
                    }
                }
            });
        } else {
            super.onBackPressed();
        }
    }

    public class AndroidBridge {
        private final Context context;

        public AndroidBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void saveBase64File(final String fileName, final String base64Data, final String mimeType) {
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    try {
                        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

                        // 0. Always mirror to app-scoped storage so driveModal on Android can list & open instantly
                        try {
                            File mirrorDir = new File(context.getExternalFilesDir(null), "KalptenKaleme");
                            if (!mirrorDir.exists()) mirrorDir.mkdirs();
                            File mirrorFile = new File(mirrorDir, fileName);
                            FileOutputStream mfos = new FileOutputStream(mirrorFile);
                            mfos.write(bytes);
                            mfos.flush();
                            mfos.close();
                        } catch (Exception ignored) {}

                        // 1. Android 10+ (API 29+) MediaStore scoped storage (zero permission requirement)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            try {
                                ContentValues values = new ContentValues();
                                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOCUMENTS + "/Kalpten Kaleme");

                                Uri collection = MediaStore.Files.getContentUri("external");
                                Uri itemUri = context.getContentResolver().insert(collection, values);
                                if (itemUri != null) {
                                    OutputStream os = context.getContentResolver().openOutputStream(itemUri);
                                    if (os != null) {
                                        os.write(bytes);
                                        os.flush();
                                        os.close();
                                        Toast.makeText(context, "Belgeler/Kalpten Kaleme klasörüne kaydedildi!", Toast.LENGTH_LONG).show();
                                        return;
                                    }
                                }
                            } catch (Exception exMedia) {
                                // Fallback to legacy file system
                            }
                        }

                        // 2. Legacy direct storage
                        File docsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
                        File appDir = new File(docsDir, "Kalpten Kaleme");
                        if (!appDir.exists()) {
                            appDir.mkdirs();
                        }
                        File outFile = new File(appDir, fileName);
                        FileOutputStream fos = new FileOutputStream(outFile);
                        fos.write(bytes);
                        fos.flush();
                        fos.close();

                        MediaScannerConnection.scanFile(context, new String[]{outFile.getAbsolutePath()}, new String[]{mimeType}, null);
                        Toast.makeText(context, "Belgeler/Kalpten Kaleme klasörüne kaydedildi!", Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        try {
                            File dlDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                            File outFile = new File(dlDir, fileName);
                            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                            FileOutputStream fos = new FileOutputStream(outFile);
                            fos.write(bytes);
                            fos.flush();
                            fos.close();
                            MediaScannerConnection.scanFile(context, new String[]{outFile.getAbsolutePath()}, new String[]{mimeType}, null);
                            Toast.makeText(context, "İndirilenler klasörüne kaydedildi: " + fileName, Toast.LENGTH_LONG).show();
                        } catch (Exception ex) {
                            Toast.makeText(context, "Kayıt hatası: " + ex.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            });
        }

        @JavascriptInterface
        public String listSavedFilesJson() {
            try {
                File mirrorDir = new File(context.getExternalFilesDir(null), "KalptenKaleme");
                if (!mirrorDir.exists()) return "[]";
                File[] files = mirrorDir.listFiles();
                if (files == null || files.length == 0) return "[]";
                Arrays.sort(files, new Comparator<File>() {
                    @Override
                    public int compare(File a, File b) {
                        return Long.compare(b.lastModified(), a.lastModified());
                    }
                });
                StringBuilder sb = new StringBuilder("[");
                SimpleDateFormat sdf = new SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault());
                boolean first = true;
                for (File f : files) {
                    if (!f.isFile()) continue;
                    String name = f.getName();
                    int dot = name.lastIndexOf('.');
                    String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "docx";
                    long kb = Math.max(1, f.length() / 1024);
                    String sizeStr = kb > 1024 ? String.format(Locale.US, "%.1f MB", kb / 1024.0) : (kb + " KB");
                    String dateStr = sdf.format(new Date(f.lastModified()));
                    if (!first) sb.append(",");
                    first = false;
                    String safeName = name.replace("\\", "\\\\").replace("\"", "\\\"");
                    sb.append("{\"name\":\"").append(safeName)
                      .append("\",\"path\":\"").append(safeName)
                      .append("\",\"size\":\"").append(sizeStr)
                      .append("\",\"date\":\"").append(dateStr)
                      .append("\",\"ext\":\"").append(ext).append("\"}");
                }
                sb.append("]");
                return sb.toString();
            } catch (Exception e) {
                return "[]";
            }
        }

        @JavascriptInterface
        public String readBase64File(String fileName) {
            try {
                File mirrorDir = new File(context.getExternalFilesDir(null), "KalptenKaleme");
                File f = new File(mirrorDir, fileName);
                if (!f.exists()) return "";
                byte[] data = new byte[(int) f.length()];
                FileInputStream fis = new FileInputStream(f);
                int read = 0;
                while (read < data.length) {
                    int r = fis.read(data, read, data.length - read);
                    if (r <= 0) break;
                    read += r;
                }
                fis.close();
                return Base64.encodeToString(data, Base64.NO_WRAP);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String getPlatform() {
            return "android";
        }
    }
}
"@
[System.IO.File]::WriteAllText((Join-Path $srcDir "MainActivity.java"), $mainActivityJava, $utf8NoBom)

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
$manifestPath = Join-Path $androidDir "AndroidManifest.xml"
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

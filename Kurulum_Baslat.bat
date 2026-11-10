@echo off
title Kalpten Kaleme - Kurulum ve Başlatıcı
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================================================
echo   Kalpten Kaleme - Masaüstü Kurulumu Yapılıyor...
echo ==============================================================

set "TARGET_DIR=%~dp0"
if "%TARGET_DIR:~-1%"=="\" set "TARGET_DIR=%TARGET_DIR:~0,-1%"

:: Eğer geliştirici deposu (.git) değilse, kalıcı olarak AppData\Local\KalptenKaleme\Studio klasörüne kur
:: Böylece kullanıcı ZIP içinden doğrudan tıklasa veya İndirilenler klasörünü sonradan silse bile uygulama bozulmaz!
if not exist "%~dp0.git" (
    set "TARGET_DIR=%LOCALAPPDATA%\KalptenKaleme\Studio"
    if not exist "%LOCALAPPDATA%\KalptenKaleme\Studio" mkdir "%LOCALAPPDATA%\KalptenKaleme\Studio" >nul 2>&1

    if exist "%~dp0index.html" (
        echo [1/4] Uygulama dosyaları kalıcı sistem klasörüne kopyalanıyor...
        robocopy "%~dp0." "%LOCALAPPDATA%\KalptenKaleme\Studio" /E /NFL /NDL /NJH /NJS /NC /NS /NP >nul 2>&1
    ) else (
        echo [1/4] ZIP arşivi tespit edildi, dosyalar otomatik çıkartılıyor...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$dest = Join-Path $env:LOCALAPPDATA 'KalptenKaleme\Studio'; $zips = @(); foreach ($d in @((Join-Path $env:USERPROFILE 'Downloads'), [Environment]::GetFolderPath('Desktop'), $env:USERPROFILE)) { if (Test-Path $d) { $zips += Get-ChildItem -Path $d -Filter 'KalptenKaleme*Windows*.zip' -File -ErrorAction SilentlyContinue } }; $zip = $zips | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($zip) { Expand-Archive -Path $zip.FullName -DestinationPath $dest -Force }"
    )
)

cd /d "%TARGET_DIR%"

:: 1. İnternetten indirilme kaynaklı Windows SmartScreen engelini kaldır (Unblock-File)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%TARGET_DIR%' -Recurse | Unblock-File -ErrorAction SilentlyContinue"

:: 2. KalptenKaleme.exe'yi yerel .NET derleyicisi ile derle (Windows SAC / SmartScreen %100 yerel güveni)
echo [2/4] Yerel masaüstü uygulaması hazırlanıyor...
if exist "%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    if exist "%TARGET_DIR%\BelgeDuzenleyici.cs" (
        "%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /optimize+ /win32icon:"%TARGET_DIR%\app.ico" /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Net.dll /r:"%TARGET_DIR%\Microsoft.Web.WebView2.Core.dll" /r:"%TARGET_DIR%\Microsoft.Web.WebView2.WinForms.dll" /out:"%TARGET_DIR%\KalptenKaleme.exe" "%TARGET_DIR%\BelgeDuzenleyici.cs" >nul 2>&1
    )
)

:: 3. Masaüstü + Başlat Menüsü kısayolunu ve dosya ilişkilerini oluştur
echo [3/4] Masaüstü kısayolu ve dosya ilişkileri oluşturuluyor...
if exist "%TARGET_DIR%\Masaustu_Kisayol_Olustur.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%TARGET_DIR%\Masaustu_Kisayol_Olustur.ps1"
)
if exist "%TARGET_DIR%\register_open_with.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%TARGET_DIR%\register_open_with.ps1" >nul 2>&1
)

:: 4. Uygulamayı başlat
echo [4/4] Kalpten Kaleme başlatılıyor...
if exist "%TARGET_DIR%\KalptenKaleme.exe" (
    start "" "%TARGET_DIR%\KalptenKaleme.exe" %*
) else (
    start "" powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%TARGET_DIR%\server.ps1" %*
)

exit

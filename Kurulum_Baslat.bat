@echo off
title Kalpten Kaleme - Kurulum ve Başlatıcı
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================================================
echo   Kalpten Kaleme - Masaüstü Kurulumu Yapılıyor...
echo ==============================================================

:: 1. İnternetten indirilme kaynaklı Windows SmartScreen engelini kaldır (Unblock-File)
powershell -NoProfile -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File -ErrorAction SilentlyContinue"

:: 2. KalptenKaleme.exe yoksa yerel derleyici ile derle (Windows SAC / SmartScreen tam güveni)
if not exist "%~dp0KalptenKaleme.exe" (
    echo [1/3] Yerel uygulama hazırlanıyor...
    if exist "%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
        "%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /optimize+ /win32icon:"%~dp0app.ico" /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Net.dll /r:"%~dp0Microsoft.Web.WebView2.Core.dll" /r:"%~dp0Microsoft.Web.WebView2.WinForms.dll" /out:"%~dp0KalptenKaleme.exe" "%~dp0BelgeDuzenleyici.cs" >nul 2>&1
    )
)

:: 3. Masaüstü kısayolunu ve dosya ilişkilerini oluştur
echo [2/3] Masaüstü kısayolu oluşturuluyor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Masaustu_Kisayol_Olustur.ps1"
if exist "%~dp0register_open_with.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0register_open_with.ps1" >nul 2>&1
)

:: 4. Uygulamayı başlat
echo [3/3] Kalpten Kaleme başlatılıyor...
if exist "%~dp0KalptenKaleme.exe" (
    start "" "%~dp0KalptenKaleme.exe" %*
) else (
    start "" powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" %*
)

exit

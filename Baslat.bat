@echo off
title Kalpten Kaleme
chcp 65001 >nul
cd /d "%~dp0"

:: İnternet kaynaklı dosya engelini kaldır
powershell -NoProfile -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File -ErrorAction SilentlyContinue"

:: Doğrudan yerel masaüstü uygulamasını başlat
if exist "%~dp0KalptenKaleme.exe" (
    start "" "%~dp0KalptenKaleme.exe" %*
    exit
)

:: KalptenKaleme.exe yoksa derle ve aç
if exist "%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    "%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /optimize+ /win32icon:"%~dp0app.ico" /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Net.dll /r:"%~dp0Microsoft.Web.WebView2.Core.dll" /r:"%~dp0Microsoft.Web.WebView2.WinForms.dll" /out:"%~dp0KalptenKaleme.exe" "%~dp0BelgeDuzenleyici.cs" >nul 2>&1
    if exist "%~dp0KalptenKaleme.exe" (
        start "" "%~dp0KalptenKaleme.exe" %*
        exit
    )
)

:: Tarayıcı tabanlı yedek başlatıcı
start "" powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" %*
exit

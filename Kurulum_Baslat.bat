@echo off
chcp 65001 >nul
title Kalpten Kaleme - Masaüstü Kurulum ve Başlatıcı
set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

echo ========================================================
echo   Kalpten Kaleme - Masaüstü Kısayolu Oluşturuluyor...
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$wsh = New-Object -ComObject WScript.Shell; " ^
  "$desk = [Environment]::GetFolderPath('Desktop'); " ^
  "$lnk = Join-Path $desk 'Kalpten Kaleme.lnk'; " ^
  "$sc = $wsh.CreateShortcut($lnk); " ^
  "$sc.TargetPath = 'wscript.exe'; " ^
  "$sc.Arguments = '//B \"' + (Join-Path '%APP_DIR%' 'Baslat.vbs') + '\"'; " ^
  "$sc.WorkingDirectory = '%APP_DIR%'; " ^
  "$sc.IconLocation = (Join-Path '%APP_DIR%' 'BelgeDuzenleyici.ico') + ',0'; " ^
  "$sc.Description = 'Kalpten Kaleme - Yazı, Sunum ve PDF Stüdyosu'; " ^
  "$sc.Save();"

echo Masaüstü kısayolu hazır! Uygulama başlatılıyor...
wscript.exe //B "%APP_DIR%\Baslat.vbs"

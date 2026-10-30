@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Masaustu_Kisayol_Olustur.ps1"
start "" powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -STA -File "%~dp0KalptenKaleme.ps1" %*

@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Masaustu_Kisayol_Olustur.ps1"
start "" "%~dp0KalptenKaleme.exe"

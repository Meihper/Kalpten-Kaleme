@echo off
title Kalpten Kaleme
chcp 65001 >nul
cd /d "%~dp0"

start "" powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -STA -File "%~dp0KalptenKaleme.ps1" %*

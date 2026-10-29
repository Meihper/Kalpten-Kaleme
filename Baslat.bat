@echo off
title Kalpten Kaleme
chcp 65001 >nul
cd /d "%~dp0"

start "" powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" %*

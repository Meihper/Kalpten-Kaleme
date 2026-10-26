@echo off
title Kalpten Kaleme
chcp 65001 >nul
cd /d "%~dp0"

start "" wscript.exe "%~dp0launcher.vbs" %*

@echo off
title Kalpten Kaleme
chcp 65001 >nul
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "TARGET_DIR=%SCRIPT_DIR%"

:: Eger kullanici Baslat.bat dosyasini cikarmadan ZIP icinden dogrudan actiysa otomatik cikart
if not exist "%SCRIPT_DIR%\index.html" (
    set "TARGET_DIR=%LOCALAPPDATA%\KalptenKaleme\Studio"
    if not exist "%LOCALAPPDATA%\KalptenKaleme\Studio" mkdir "%LOCALAPPDATA%\KalptenKaleme\Studio" >nul 2>&1
    if not exist "%LOCALAPPDATA%\KalptenKaleme\Studio\index.html" (
        echo Kalpten Kaleme ilk calistirma icin hazirlaniyor...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$dest = $env:TARGET_DIR; $dirs = New-Object System.Collections.Generic.List[string]; try { $dl = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path; if ($dl) { $dirs.Add($dl) } } catch {}; try { $sf = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders' -ErrorAction SilentlyContinue).'{374DE290-123F-4565-9164-39C4925E467B}'; if ($sf) { $dirs.Add([Environment]::ExpandEnvironmentVariables($sf)) } } catch {}; foreach ($p in @((Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $env:USERPROFILE 'Indirilenler'), (Join-Path $env:USERPROFILE ([string][char]0x0130 + 'ndirilenler')), $env:OneDrive, $(if($env:OneDrive){Join-Path $env:OneDrive 'Downloads'}), $(if($env:OneDriveConsumer){Join-Path $env:OneDriveConsumer 'Downloads'}), [Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('MyDocuments'), $env:USERPROFILE, $env:TEMP)) { if ($p) { $dirs.Add($p) } }; $zips = @(); foreach ($d in ($dirs | Select-Object -Unique)) { if (Test-Path $d) { $zips += Get-ChildItem -Path $d -Filter '*Kalpten*Kaleme*.zip' -File -ErrorAction SilentlyContinue; $zips += Get-ChildItem -Path $d -Filter 'KalptenKaleme*.zip' -File -ErrorAction SilentlyContinue } }; $zip = $zips | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($zip) { Expand-Archive -Path $zip.FullName -DestinationPath $dest -Force }" >nul 2>&1
    )
    if exist "%LOCALAPPDATA%\KalptenKaleme\Studio\Masaustu_Kisayol_Olustur.ps1" (
        if not exist "%USERPROFILE%\Desktop\Kalpten Kaleme.lnk" (
            powershell -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\KalptenKaleme\Studio\Masaustu_Kisayol_Olustur.ps1" >nul 2>&1
        )
    )
)

if not exist "%TARGET_DIR%\index.html" (
    echo.
    echo [HATA] Kalpten Kaleme arsiv dosyalari bulunamadi.
    echo Lutfen KalptenKaleme-Windows.zip klasorunu ayiklayip Kurulum_Baslat.bat dosyasini acin.
    echo.
    pause
    exit /b 1
)

cd /d "%TARGET_DIR%"

:: Internet kaynakli dosya engelini kaldir (Zone.Identifier temizligi)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath $env:TARGET_DIR -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

:: Windows 11 Smart App Control (SAC) aciksa imzasiz .exe dosyasini devre disi birak
powershell -NoProfile -ExecutionPolicy Bypass -Command "$sac = $false; try { $v = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' -Name 'VerifiedAndReputablePolicyState' -ErrorAction SilentlyContinue).VerifiedAndReputablePolicyState; if ($v -eq 1) { $sac = $true } } catch {}; $exe = Join-Path $env:TARGET_DIR 'KalptenKaleme.exe'; if ($sac -and (Test-Path $exe)) { Remove-Item -LiteralPath $exe -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: Tarayicisiz yerel masaustu penceresini sifir terminal penceresiyle baslat
if exist "%SystemRoot%\System32\wscript.exe" (
    if exist "%TARGET_DIR%\Baslat.vbs" (
        start "" "%SystemRoot%\System32\wscript.exe" //nologo "%TARGET_DIR%\Baslat.vbs" %*
        exit /b 0
    )
)

:: Yedek 64-bit gizli PowerShell baslatma
set "PS_EXE=%SystemRoot%\SysNative\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_EXE%" set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%TARGET_DIR%\KalptenKaleme.ps1" (
    start "" "%PS_EXE%" -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%TARGET_DIR%\KalptenKaleme.ps1" %*
) else (
    start "" "%PS_EXE%" -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%TARGET_DIR%\server.ps1" %*
)
exit /b 0

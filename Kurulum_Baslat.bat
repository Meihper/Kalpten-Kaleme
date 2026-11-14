@echo off
title Kalpten Kaleme - Kurulum ve Baslatici
chcp 65001 >nul
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "TARGET_DIR=%SCRIPT_DIR%"

echo ==============================================================
echo   Kalpten Kaleme - Masaustu Kurulumu Yapiliyor...
echo ==============================================================

:: Gelistirici deposu (.git) degilse kalici olarak %LOCALAPPDATA%\KalptenKaleme\Studio klasorune kur
if not exist "%SCRIPT_DIR%\.git" (
    set "TARGET_DIR=%LOCALAPPDATA%\KalptenKaleme\Studio"
    if not exist "%LOCALAPPDATA%\KalptenKaleme\Studio" mkdir "%LOCALAPPDATA%\KalptenKaleme\Studio" >nul 2>&1

    if exist "%SCRIPT_DIR%\index.html" (
        echo [1/4] Uygulama dosyalari kalici sistem klasorune kopyalaniyor...
        robocopy "%SCRIPT_DIR%" "%LOCALAPPDATA%\KalptenKaleme\Studio" /E /NFL /NDL /NJH /NJS /NC /NS /NP >nul 2>&1
        if not exist "%LOCALAPPDATA%\KalptenKaleme\Studio\index.html" (
            powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Path (Join-Path $env:SCRIPT_DIR '*') -Destination $env:TARGET_DIR -Recurse -Force -ErrorAction SilentlyContinue" >nul 2>&1
        )
    ) else (
        echo [1/4] ZIP arsivi icinden calistirildi; dosyalar otomatik cikartiliyor...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$dest = $env:TARGET_DIR; $dirs = New-Object System.Collections.Generic.List[string]; try { $dl = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path; if ($dl) { $dirs.Add($dl) } } catch {}; try { $sf = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders' -ErrorAction SilentlyContinue).'{374DE290-123F-4565-9164-39C4925E467B}'; if ($sf) { $dirs.Add([Environment]::ExpandEnvironmentVariables($sf)) } } catch {}; foreach ($p in @((Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $env:USERPROFILE 'Indirilenler'), (Join-Path $env:USERPROFILE ([string][char]0x0130 + 'ndirilenler')), $env:OneDrive, $(if($env:OneDrive){Join-Path $env:OneDrive 'Downloads'}), $(if($env:OneDriveConsumer){Join-Path $env:OneDriveConsumer 'Downloads'}), [Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('MyDocuments'), $env:USERPROFILE, $env:TEMP)) { if ($p) { $dirs.Add($p) } }; $zips = @(); foreach ($d in ($dirs | Select-Object -Unique)) { if (Test-Path $d) { $zips += Get-ChildItem -Path $d -Filter '*Kalpten*Kaleme*.zip' -File -ErrorAction SilentlyContinue; $zips += Get-ChildItem -Path $d -Filter 'KalptenKaleme*.zip' -File -ErrorAction SilentlyContinue } }; $zip = $zips | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($zip) { Expand-Archive -Path $zip.FullName -DestinationPath $dest -Force }" >nul 2>&1
    )
)

if not exist "%TARGET_DIR%\index.html" (
    echo.
    echo [HATA] Uygulama dosyalari bulunamadi!
    echo Lutfen indirdiginiz KalptenKaleme-Windows.zip dosyasina sag tiklayip
    echo "Tumunu Ayikla" dedikten sonra cikan klasordeki Kurulum_Baslat.bat dosyasini acin.
    echo.
    pause
    exit /b 1
)

cd /d "%TARGET_DIR%"

:: 1. Windows SmartScreen ve internet engellerini (Zone.Identifier) temizle
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath $env:TARGET_DIR -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

:: 2. Smart App Control (SAC) durumunu denetle ve imzasiz eski .exe kalintisini temizle
echo [2/4] Yerel WebView2 masaustu penceresi hazirlaniyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$sac = $false; try { $v = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' -Name 'VerifiedAndReputablePolicyState' -ErrorAction SilentlyContinue).VerifiedAndReputablePolicyState; if ($v -eq 1) { $sac = $true } } catch {}; $exe = Join-Path $env:TARGET_DIR 'KalptenKaleme.exe'; if ($sac -and (Test-Path $exe)) { Remove-Item -LiteralPath $exe -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: 3. Masaustu + Baslat Menusu kisayolunu ve dosya iliskilerini olustur
echo [3/4] Masaustu kisayolu ve sag tik menusu olusturuluyor...
if exist "%TARGET_DIR%\Masaustu_Kisayol_Olustur.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%TARGET_DIR%\Masaustu_Kisayol_Olustur.ps1" >nul 2>&1
)
if exist "%TARGET_DIR%\register_open_with.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%TARGET_DIR%\register_open_with.ps1" >nul 2>&1
)

:: 4. Uygulamayi tarayicisiz yerel pencere modunda gizlice baslat
echo [4/4] Kalpten Kaleme baslatiliyor...
if exist "%SystemRoot%\System32\wscript.exe" (
    if exist "%TARGET_DIR%\Baslat.vbs" (
        start "" "%SystemRoot%\System32\wscript.exe" //nologo "%TARGET_DIR%\Baslat.vbs" %*
        exit /b 0
    )
)

set "PS_EXE=%SystemRoot%\SysNative\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_EXE%" set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%TARGET_DIR%\KalptenKaleme.ps1" (
    start "" "%PS_EXE%" -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%TARGET_DIR%\KalptenKaleme.ps1" %*
) else (
    start "" "%PS_EXE%" -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%TARGET_DIR%\server.ps1" %*
)
exit /b 0

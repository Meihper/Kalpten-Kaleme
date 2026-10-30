$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($rootDir)) {
    $rootDir = "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice"
}

$psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$launcherScript = Join-Path $rootDir "KalptenKaleme.ps1"
$openCmd = "`"$psExe`" -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -STA -File `"$launcherScript`" `"%1`""

$icoPath = Join-Path $rootDir "app.ico"
if (-not (Test-Path $icoPath)) { $icoPath = Join-Path $rootDir "BelgeDuzenleyici.ico" }
$exts = @(".docx", ".pdf", ".pptx", ".ppt", ".txt", ".html", ".md")

# 1. SystemFileAssociations (Direct right-click context menu "Kalpten Kaleme ile Aç")
foreach ($ext in $exts) {
    $key = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\KalptenKaleme"
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name "(default)" -Value "Kalpten Kaleme ile Aç"
    Set-ItemProperty -Path $key -Name "Icon" -Value "$icoPath,0"
    $cmd = "$key\command"
    New-Item -Path $cmd -Force | Out-Null
    Set-ItemProperty -Path $cmd -Name "(default)" -Value $openCmd
}

# 2. Applications Registration (Windows "Open With" / Birlikte Aç Dialog)
$appKey = "HKCU:\Software\Classes\Applications\KalptenKaleme.exe"
New-Item -Path ($appKey + "\shell\open\command") -Force | Out-Null
Set-ItemProperty -Path $appKey -Name "FriendlyAppName" -Value "Kalpten Kaleme"
Set-ItemProperty -Path ($appKey + "\shell\open\command") -Name "(default)" -Value $openCmd

$suppKey = "$appKey\SupportedTypes"
New-Item -Path $suppKey -Force | Out-Null
foreach ($ext in $exts) {
    Set-ItemProperty -Path $suppKey -Name $ext -Value ""
}

# 3. Clean and Create Desktop Shortcut via Masaustu_Kisayol_Olustur.ps1
& (Join-Path $rootDir "Masaustu_Kisayol_Olustur.ps1")

Write-Host "KAYIT_BASARILI" -ForegroundColor Green

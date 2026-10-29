$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($rootDir)) {
    $rootDir = "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice"
}
$vbsPath = Join-Path $rootDir "launcher.vbs"
$wscript = "$env:SystemRoot\System32\wscript.exe"
$icoPath = Join-Path $rootDir "app.ico"
if (-not (Test-Path $icoPath)) { $icoPath = Join-Path $rootDir "kalpten_kaleme.ico" }
$exts = @(".docx", ".pdf", ".txt", ".html", ".md")

# 1. SystemFileAssociations (Direct right-click context menu "Kalpten Kaleme ile Aç")
foreach ($ext in $exts) {
    $key = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\KalptenKaleme"
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name "(default)" -Value "Kalpten Kaleme ile Aç"
    Set-ItemProperty -Path $key -Name "Icon" -Value "$icoPath,0"
    $cmd = "$key\command"
    New-Item -Path $cmd -Force | Out-Null
    Set-ItemProperty -Path $cmd -Name "(default)" -Value "`"$wscript`" `"$vbsPath`" `"%1`""
}

# 2. Applications Registration (Windows "Open With" / Birlikte Aç Dialog)
$appKey = "HKCU:\Software\Classes\Applications\KalptenKaleme.exe"
New-Item -Path ($appKey + "\shell\open\command") -Force | Out-Null
Set-ItemProperty -Path $appKey -Name "FriendlyAppName" -Value "Kalpten Kaleme"
Set-ItemProperty -Path ($appKey + "\shell\open\command") -Name "(default)" -Value "`"$wscript`" `"$vbsPath`" `"%1`""

$suppKey = "$appKey\SupportedTypes"
New-Item -Path $suppKey -Force | Out-Null
foreach ($ext in $exts) {
    Set-ItemProperty -Path $suppKey -Name $ext -Value ""
}

# 3. Clean and Create Desktop Shortcut
$wsh = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath("Desktop")

# Remove obsolete shortcuts
Remove-Item (Join-Path $desktop "Studio Office Pro.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $desktop "Word ve PDF Düzenleyici.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $desktop "Belge ve PDF Duzenleyici.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $desktop "Kalpten Kaleme.lnk") -Force -ErrorAction SilentlyContinue

# Create official shortcut "Kalpten Kaleme" (100% Windows Smart App Control Safe via Microsoft-signed wscript.exe)
$newShortcutPath = Join-Path $desktop "Kalpten Kaleme.lnk"
$sc = $wsh.CreateShortcut($newShortcutPath)
$sc.TargetPath = $wscript
$sc.Arguments = "`"$vbsPath`""
$sc.WorkingDirectory = $rootDir
$sc.IconLocation = "$icoPath,0"
$sc.Description = "Kalpten Kaleme - Belge ve Yazı Atölyesi"
$sc.WindowStyle = 1
$sc.Save()

Write-Host "KAYIT_BASARILI" -ForegroundColor Green

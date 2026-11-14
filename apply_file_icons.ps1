# ==============================================================================
# Kalpten Kaleme - Windows Dosya Simgesi ve Birlikte Aç Entegratörü
# PDF, Word (DOCX), PowerPoint (PPTX) simgelerini ve doğrudan açıcıyı tanıtır.
# ==============================================================================

$rootDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($rootDir)) {
    $rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$wscriptExe = Join-Path $env:SystemRoot "System32\wscript.exe"
$vbsPath = Join-Path $rootDir "Baslat.vbs"
$psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$nativeScript = Join-Path $rootDir "KalptenKaleme.ps1"
$serverScript = Join-Path $rootDir "server.ps1"

$sacEnforced = $false
try {
    $sacVal = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -Name "VerifiedAndReputablePolicyState" -ErrorAction SilentlyContinue).VerifiedAndReputablePolicyState
    if ($sacVal -eq 1) { $sacEnforced = $true }
} catch {}
$exePath = Join-Path $rootDir "KalptenKaleme.exe"

if ((Test-Path $vbsPath) -and (Test-Path $wscriptExe)) {
    $openCmd = "`"$wscriptExe`" //nologo `"$vbsPath`" `"%1`""
} elseif (-not $sacEnforced -and (Test-Path $exePath)) {
    $openCmd = "`"$exePath`" `"%1`""
} elseif (Test-Path $nativeScript) {
    $openCmd = "`"$psExe`" -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$nativeScript`" -FilePath `"%1`""
} else {
    $openCmd = "`"$psExe`" -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$serverScript`" -FilePath `"%1`""
}

$pdfIcoPath = Join-Path $rootDir "kk_pdf.ico"
if (-not (Test-Path $pdfIcoPath)) { $pdfIcoPath = Join-Path $rootDir "pdf_file.ico" }
if (-not (Test-Path $pdfIcoPath)) { $pdfIcoPath = Join-Path $rootDir "app.ico" }
$docxIcoPath = Join-Path $rootDir "kk_docx.ico"
if (-not (Test-Path $docxIcoPath)) { $docxIcoPath = Join-Path $rootDir "docx_file.ico" }
if (-not (Test-Path $docxIcoPath)) { $docxIcoPath = Join-Path $rootDir "app.ico" }
$pptxIcoPath = Join-Path $rootDir "kk_pptx.ico"
if (-not (Test-Path $pptxIcoPath)) { $pptxIcoPath = Join-Path $rootDir "app.ico" }

# 1. Register PDF ProgID
$pdfProgId = "HKCU:\Software\Classes\KalptenKaleme.PDF"
New-Item -Path $pdfProgId -Force | Out-Null
Set-ItemProperty -Path $pdfProgId -Name "(default)" -Value "Kalpten Kaleme PDF Belgesi"
New-Item -Path "$pdfProgId\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "$pdfProgId\DefaultIcon" -Name "(default)" -Value "$pdfIcoPath,0"
New-Item -Path "$pdfProgId\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$pdfProgId\shell\open\command" -Name "(default)" -Value $openCmd

# 2. Register DOCX ProgID
$docxProgId = "HKCU:\Software\Classes\KalptenKaleme.DOCX"
New-Item -Path $docxProgId -Force | Out-Null
Set-ItemProperty -Path $docxProgId -Name "(default)" -Value "Kalpten Kaleme Word Belgesi (DOCX)"
New-Item -Path "$docxProgId\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "$docxProgId\DefaultIcon" -Name "(default)" -Value "$docxIcoPath,0"
New-Item -Path "$docxProgId\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$docxProgId\shell\open\command" -Name "(default)" -Value $openCmd

# 3. Register PPTX ProgID (PowerPoint)
$pptxProgId = "HKCU:\Software\Classes\KalptenKaleme.PPTX"
New-Item -Path $pptxProgId -Force | Out-Null
Set-ItemProperty -Path $pptxProgId -Name "(default)" -Value "Kalpten Kaleme Sunumu (PPTX)"
New-Item -Path "$pptxProgId\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "$pptxProgId\DefaultIcon" -Name "(default)" -Value "$pptxIcoPath,0"
New-Item -Path "$pptxProgId\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$pptxProgId\shell\open\command" -Name "(default)" -Value $openCmd

# 4. Clean up old APK association
Remove-Item -Path "HKCU:\Software\Classes\.apk" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKCU:\Software\Classes\KalptenKaleme.APK" -Recurse -Force -ErrorAction SilentlyContinue

# 5. Associate Extensions with ProgIDs in HKCU
$extMap = @{
    ".pdf"  = "KalptenKaleme.PDF"
    ".docx" = "KalptenKaleme.DOCX"
    ".pptx" = "KalptenKaleme.PPTX"
}

foreach ($ext in $extMap.Keys) {
    $extKey = "HKCU:\Software\Classes\$ext"
    New-Item -Path $extKey -Force | Out-Null
    Set-ItemProperty -Path $extKey -Name "(default)" -Value $extMap[$ext]
}

# 6. Refresh Windows Shell Icon Cache without dynamic C# compilation (SAC-safe)
$ie4u = Join-Path $env:SystemRoot "System32\ie4uinit.exe"
if (Test-Path $ie4u) {
    Start-Process -FilePath $ie4u -ArgumentList "-show" -WindowStyle Hidden -ErrorAction SilentlyContinue
}

Write-Host "FILE_ASSOCIATIONS_AND_ICONS_APPLIED_SUCCESSFULLY" -ForegroundColor Green

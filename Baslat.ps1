$ErrorActionPreference = "SilentlyContinue"
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $appDir

# Unblock all files in case extracted from a downloaded ZIP
Get-ChildItem -Path $appDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

$exePath = Join-Path $appDir "KalptenKaleme.exe"
$csPath = Join-Path $appDir "BelgeDuzenleyici.cs"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

# Compile locally if KalptenKaleme.exe does not exist or if source is newer (ensures 100% Windows Smart App Control trust)
$needsCompile = (-not (Test-Path $exePath))
if (-not $needsCompile -and (Test-Path $csPath)) {
    if ((Get-Item $csPath).LastWriteTimeUtc -gt (Get-Item $exePath).LastWriteTimeUtc) {
        $needsCompile = $true
    }
}

if ($needsCompile -and (Test-Path $csc) -and (Test-Path $csPath)) {
    & $csc /nologo /target:winexe /platform:x64 /optimize+ `
        /win32icon:"$appDir\BelgeDuzenleyici.ico" `
        /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Net.dll `
        /r:"$appDir\Microsoft.Web.WebView2.Core.dll" `
        /r:"$appDir\Microsoft.Web.WebView2.WinForms.dll" `
        /out:"$exePath" `
        "$csPath" | Out-Null
    Copy-Item $exePath (Join-Path $appDir "BelgeDuzenleyici.exe") -Force -ErrorAction SilentlyContinue
}

if (Test-Path $exePath) {
    if ($args -and $args.Count -gt 0) {
        Start-Process -FilePath $exePath -ArgumentList $args -WorkingDirectory $appDir
    } else {
        Start-Process -FilePath $exePath -WorkingDirectory $appDir
    }
}

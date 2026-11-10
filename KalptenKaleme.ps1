# ==============================================================================
# Kalpten Kaleme - Native Windows Desktop Launcher (WinForms + WebView2)
# 100% Native Taskbar Icon: Zero Edge icon flash, Zero Smart App Control blocks
# ==============================================================================

param(
    [string]$FilePath = ""
)

$ErrorActionPreference = "SilentlyContinue"
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($appDir)) {
    $appDir = "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice"
}
Set-Location $appDir

$port = 52480
$openFileRecord = Join-Path $appDir "current_open_file.txt"

# If a file was passed ("Birlikte Aç"), record it immediately
if (![string]::IsNullOrWhiteSpace($FilePath) -and (Test-Path $FilePath)) {
    try {
        [System.IO.File]::WriteAllText($openFileRecord, (Resolve-Path $FilePath).Path, [System.Text.Encoding]::UTF8)
    } catch {}
}

# 1. Single Instance Check: If already running, bring window to front and exit
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WindowActivator {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@ -ErrorAction SilentlyContinue

$existingProc = Get-Process -Name "powershell", "pwsh" -ErrorAction SilentlyContinue | Where-Object {
    $_.Id -ne $PID -and $_.MainWindowTitle -eq "Kalpten Kaleme" -and $_.MainWindowHandle -ne 0
} | Select-Object -First 1

if ($existingProc) {
    if ([WindowActivator]::IsIconic($existingProc.MainWindowHandle)) {
        [WindowActivator]::ShowWindow($existingProc.MainWindowHandle, 9) | Out-Null # SW_RESTORE
    }
    [WindowActivator]::SetForegroundWindow($existingProc.MainWindowHandle) | Out-Null
    exit
}

# 2. Ensure Local Server is Running
$serverScript = Join-Path $appDir "server.ps1"
$isServerListening = $false
try {
    $req = [System.Net.WebRequest]::Create("http://localhost:$port/api/heartbeat")
    $req.Timeout = 400
    $resp = $req.GetResponse()
    $resp.Close()
    $isServerListening = $true
} catch {
    $isServerListening = $false
}

if (-not $isServerListening -and (Test-Path $serverScript)) {
    Start-Process "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$serverScript`" -Daemon" -WindowStyle Hidden
    Start-Sleep -Milliseconds 350
}

# 3. Load WinForms and WebView2 Assemblies
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$coreDll = Join-Path $appDir "Microsoft.Web.WebView2.Core.dll"
$wfDll = Join-Path $appDir "Microsoft.Web.WebView2.WinForms.dll"

$hasWebView2 = (Test-Path $coreDll) -and (Test-Path $wfDll)
if ($hasWebView2) {
    try {
        Add-Type -Path $coreDll -ErrorAction Stop
        Add-Type -Path $wfDll -ErrorAction Stop
    } catch {
        $hasWebView2 = $false
    }
}

$appUrl = "http://localhost:$port/index.html"

# Fallback: if WebView2 DLLs are missing, open via Edge App Mode
if (-not $hasWebView2) {
    $edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
    $prof = Join-Path $appDir "profile"
    Start-Process $edge -ArgumentList "--app=`"$appUrl`" --user-data-dir=`"$prof`" --window-size=1280,820"
    exit
}

# 4. Create Native Form
$form = New-Object System.Windows.Forms.Form
$form.Text = "Kalpten Kaleme"
$form.Size = New-Object System.Drawing.Size(1280, 820)
$form.MinimumSize = New-Object System.Drawing.Size(820, 560)
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.BackColor = [System.Drawing.Color]::FromArgb(244, 246, 249)

# Set Native Icon (Displays instantly on taskbar and window header - ZERO Edge icon!)
$iconPath = Join-Path $appDir "app.ico"
if (-not (Test-Path $iconPath)) { $iconPath = Join-Path $appDir "BelgeDuzenleyici.ico" }
if (Test-Path $iconPath) {
    try {
        $form.Icon = New-Object System.Drawing.Icon($iconPath)
    } catch {}
}

# 5. Create and Setup WebView2 Control
$webView = New-Object Microsoft.Web.WebView2.WinForms.WebView2
$webView.Dock = [System.Windows.Forms.DockStyle]::Fill
$form.Controls.Add($webView)

$userDataDir = Join-Path $env:LOCALAPPDATA "KalptenKaleme\WebViewData"
if (-not (Test-Path $userDataDir)) {
    New-Item -ItemType Directory -Path $userDataDir -Force | Out-Null
}

$props = New-Object Microsoft.Web.WebView2.WinForms.CoreWebView2CreationProperties
$props.UserDataFolder = $userDataDir
$props.AdditionalBrowserArguments = "--disable-features=msHub,msEdgeSidebarV2,msEdgeHub,Translate --no-first-run --no-default-browser-check"
$webView.CreationProperties = $props
$webView.Source = New-Object System.Uri($appUrl)

# Configure settings once initialized
$webView.Add_CoreWebView2InitializationCompleted({
    param($s, $e)
    if ($e.IsSuccess -and $webView.CoreWebView2 -ne $null) {
        try {
            $settings = $webView.CoreWebView2.Settings
            $settings.IsStatusBarEnabled = $false
            $settings.AreDefaultContextMenusEnabled = $true
            $settings.IsPasswordAutosaveEnabled = $false
            $settings.IsGeneralAutofillEnabled = $false
        } catch {}
    }
})

# Display Form
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::Run($form)

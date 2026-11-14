# ==============================================================================
# Kalpten Kaleme - Native Windows Desktop Launcher (WinForms + WebView2)
# 100% SAC-Safe: Uses signed inbox PowerShell + WinForms + Microsoft WebView2
# ==============================================================================

param(
    [string]$FilePath = ""
)

$ErrorActionPreference = "SilentlyContinue"

# Ensure 64-bit PowerShell when running on 64-bit Windows (matches x64 WebView2Loader.dll)
if ([IntPtr]::Size -ne 8) {
    $sysNativePs = Join-Path $env:SystemRoot "SysNative\WindowsPowerShell\v1.0\powershell.exe"
    if (Test-Path $sysNativePs) {
        $reArgs = @("-WindowStyle", "Hidden", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $MyInvocation.MyCommand.Path)
        if (![string]::IsNullOrWhiteSpace($FilePath)) {
            $reArgs += @("-FilePath", $FilePath)
        }
        Start-Process -FilePath $sysNativePs -ArgumentList $reArgs -WindowStyle Hidden
        exit
    }
}

$appDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($appDir)) {
    $appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
Set-Location $appDir

$candidatePorts = @(52480, 52481, 52482, 52483, 52484)
$script:activePort = 52480
$script:baseUrl = "http://localhost:52480"
$script:startedDaemon = $false
$script:launchedBrowserFallback = $false
$openFileRecord = Join-Path $appDir "current_open_file.txt"

function Test-ServerHeartbeat {
    foreach ($p in $candidatePorts) {
        foreach ($h in @("localhost", "127.0.0.1")) {
            $u = "http://${h}:${p}"
            try {
                $req = [System.Net.WebRequest]::Create("$u/api/heartbeat")
                $req.Timeout = 350
                $resp = $req.GetResponse()
                $resp.Close()
                $script:activePort = $p
                $script:baseUrl = $u
                return $true
            } catch {}
        }
    }
    return $false
}

function Find-ChromiumAppExecutable {
    $candidates = New-Object System.Collections.Generic.List[string]
    $pfX86 = ${env:ProgramFiles(x86)}
    $pf = $env:ProgramFiles
    $local = $env:LOCALAPPDATA

    if ($pfX86) { $candidates.Add((Join-Path $pfX86 "Microsoft\Edge\Application\msedge.exe")) }
    if ($pf)    { $candidates.Add((Join-Path $pf "Microsoft\Edge\Application\msedge.exe")) }
    if ($local) { $candidates.Add((Join-Path $local "Microsoft\Edge\Application\msedge.exe")) }
    $candidates.Add("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
    $candidates.Add("C:\Program Files\Microsoft\Edge\Application\msedge.exe")

    if ($pf)    { $candidates.Add((Join-Path $pf "Google\Chrome\Application\chrome.exe")) }
    if ($pfX86) { $candidates.Add((Join-Path $pfX86 "Google\Chrome\Application\chrome.exe")) }
    if ($local) { $candidates.Add((Join-Path $local "Google\Chrome\Application\chrome.exe")) }

    if ($pf)    { $candidates.Add((Join-Path $pf "BraveSoftware\Brave-Browser\Application\brave.exe")) }
    if ($local) { $candidates.Add((Join-Path $local "BraveSoftware\Brave-Browser\Application\brave.exe")) }

    foreach ($exeName in @("msedge.exe", "chrome.exe", "brave.exe")) {
        foreach ($hive in @("HKLM:", "HKCU:")) {
            try {
                $v = (Get-ItemProperty -Path "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$exeName" -ErrorAction SilentlyContinue)."(default)"
                if (![string]::IsNullOrWhiteSpace($v)) {
                    $candidates.Add($v.Trim('"', ' '))
                }
            } catch {}
        }
    }

    foreach ($c in $candidates) {
        if (![string]::IsNullOrWhiteSpace($c) -and (Test-Path $c -PathType Leaf)) {
            return $c
        }
    }
    return $null
}

function Invoke-ChromiumAppFallback([string]$TargetUrl) {
    $script:launchedBrowserFallback = $true
    if ($script:startedDaemon) {
        try {
            $dreq = [System.Net.WebRequest]::Create("$($script:baseUrl)/api/detach-daemon")
            $dreq.Timeout = 400
            $dresp = $dreq.GetResponse()
            $dresp.Close()
        } catch {}
    }

    $browserExe = Find-ChromiumAppExecutable
    if ($browserExe) {
        $prof = Join-Path $env:LOCALAPPDATA "KalptenKaleme\EdgeAppProfile"
        if (!(Test-Path $prof)) {
            New-Item -ItemType Directory -Path $prof -Force | Out-Null
        }
        $antiSyncFlags = "--no-first-run --no-default-browser-check --disable-sync --disable-features=msHub,msEdgeSidebarV2,msEdgeHub,Translate,msEdgeAutoSignIn,msEdgeFirstRunExperience,msEdgeFreV2,msEdgeSyncNotice,msEdgeShowFirstRunNotification,msEdgeSignInOptIn,msEdgeFrePromo,msEdgeWelcomePageExperience,msEdgeStartupBoost"
        $argStr = "--app=`"$TargetUrl`" --user-data-dir=`"$prof`" $antiSyncFlags --window-size=1360,860"
        Start-Process -FilePath $browserExe -ArgumentList $argStr
        return $true
    }
    return $false
}

# Record or dispatch incoming CLI file path ("Birlikte Aç")
$resolvedInputFile = $null
if (![string]::IsNullOrWhiteSpace($FilePath) -and (Test-Path $FilePath -PathType Leaf)) {
    try {
        $resolvedInputFile = (Resolve-Path $FilePath).Path
        [System.IO.File]::WriteAllText($openFileRecord, $resolvedInputFile, [System.Text.Encoding]::UTF8)
    } catch {}
}

$isServerListening = Test-ServerHeartbeat
if ($isServerListening -and $resolvedInputFile) {
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($resolvedInputFile)
        $postReq = [System.Net.WebRequest]::Create("$($script:baseUrl)/api/open-specific-file")
        $postReq.Method = "POST"
        $postReq.ContentType = "text/plain; charset=utf-8"
        $postReq.Timeout = 1000
        $postReq.ContentLength = $bytes.Length
        $st = $postReq.GetRequestStream()
        $st.Write($bytes, 0, $bytes.Length)
        $st.Close()
        $postResp = $postReq.GetResponse()
        $postResp.Close()
    } catch {}
}

# 1. Single Instance Check (SAC-safe via WScript.Shell.AppActivate - zero inline C#)
$existingProc = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Id -ne $PID -and $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*Kalpten Kaleme*"
} | Select-Object -First 1

if ($existingProc) {
    try {
        $wsh = New-Object -ComObject WScript.Shell
        $activated = $wsh.AppActivate($existingProc.Id)
        if ($activated) { exit }
    } catch {}
}

# 2. Ensure Local Server is Running
$serverScript = Join-Path $appDir "server.ps1"
if (-not $isServerListening -and (Test-Path $serverScript)) {
    $psSelf = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $daemonArgs = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$serverScript`" -Daemon"
    Start-Process -FilePath $psSelf -ArgumentList $daemonArgs -WindowStyle Hidden
    $script:startedDaemon = $true

    for ($i = 0; $i -lt 50; $i++) {
        Start-Sleep -Milliseconds 100
        if (Test-ServerHeartbeat) {
            $isServerListening = $true
            break
        }
    }
}

$appUrl = if ($isServerListening) { "$($script:baseUrl)/index.html" } else { "file:///" + ($appDir.Replace('\', '/')) + "/index.html" }

# 3. Load WinForms and WebView2 Assemblies
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$coreDll = Join-Path $appDir "Microsoft.Web.WebView2.Core.dll"
$wfDll = Join-Path $appDir "Microsoft.Web.WebView2.WinForms.dll"

$hasWebView2 = (Test-Path $coreDll) -and (Test-Path $wfDll) -and ([IntPtr]::Size -eq 8)
if ($hasWebView2) {
    try {
        Add-Type -Path $coreDll -ErrorAction Stop
        Add-Type -Path $wfDll -ErrorAction Stop
    } catch {
        $hasWebView2 = $false
    }
}

if (-not $hasWebView2) {
    if (-not (Invoke-ChromiumAppFallback $appUrl)) {
        Start-Process $appUrl
    }
    exit
}

# 4. Create Native Form
[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = "Kalpten Kaleme"
$form.Size = New-Object System.Drawing.Size(1360, 860)
$form.MinimumSize = New-Object System.Drawing.Size(820, 560)
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.BackColor = [System.Drawing.Color]::FromArgb(244, 246, 249)

$iconPath = Join-Path $appDir "app.ico"
if (-not (Test-Path $iconPath)) { $iconPath = Join-Path $appDir "BelgeDuzenleyici.ico" }
if (-not (Test-Path $iconPath)) { $iconPath = Join-Path $appDir "kk_lux_app.ico" }
if (Test-Path $iconPath) {
    try {
        $form.Icon = New-Object System.Drawing.Icon($iconPath)
    } catch {}
}

# 5. Setup WebView2 Control cleanly inside Native Window
$userDataDir = Join-Path $env:LOCALAPPDATA "KalptenKaleme\WebViewData"
if (-not (Test-Path $userDataDir)) {
    New-Item -ItemType Directory -Path $userDataDir -Force | Out-Null
}

try {
    $defProf = Join-Path $userDataDir "Default"
    if (-not (Test-Path $defProf)) { New-Item -ItemType Directory -Path $defProf -Force | Out-Null }
    $prefFile = Join-Path $defProf "Preferences"
    $cleanPrintJson = '{"printing":{"print_preview_sticky_settings":{"appState":"{\"headerFooter\":false,\"isCssBackgroundEnabled\":true}"}}}'
    if (-not (Test-Path $prefFile)) {
        [System.IO.File]::WriteAllText($prefFile, $cleanPrintJson, [System.Text.Encoding]::UTF8)
    } else {
        $curPref = [System.IO.File]::ReadAllText($prefFile, [System.Text.Encoding]::UTF8)
        if ($curPref -notmatch "print_preview_sticky_settings") {
            [System.IO.File]::WriteAllText($prefFile, $cleanPrintJson, [System.Text.Encoding]::UTF8)
        }
    }
} catch {}

try {
    $webView = New-Object Microsoft.Web.WebView2.WinForms.WebView2
    $webView.Dock = [System.Windows.Forms.DockStyle]::Fill
    $form.Controls.Add($webView)

    $props = New-Object Microsoft.Web.WebView2.WinForms.CoreWebView2CreationProperties
    $props.UserDataFolder = $userDataDir
    $props.AdditionalBrowserArguments = "--disable-features=msHub,msEdgeSidebarV2,msEdgeHub,Translate --no-first-run --no-default-browser-check"
    $webView.CreationProperties = $props

    $webView.Add_CoreWebView2InitializationCompleted({
        param($s, $e)
        if ($e.IsSuccess -and $webView.CoreWebView2 -ne $null) {
            try {
                $settings = $webView.CoreWebView2.Settings
                $settings.IsStatusBarEnabled = $false
                $settings.AreDefaultContextMenusEnabled = $true
                $settings.AreDevToolsEnabled = $false
                $settings.IsPasswordAutosaveEnabled = $false
                $settings.IsGeneralAutofillEnabled = $false

                $webView.CoreWebView2.Add_DocumentTitleChanged({
                    param($ts, $te)
                    try {
                        $t = $webView.CoreWebView2.DocumentTitle
                        if (![string]::IsNullOrWhiteSpace($t)) {
                            $form.Text = $t
                        }
                    } catch {}
                })

                $webView.CoreWebView2.Add_DownloadStarting({
                    param($ds, $dev)
                    try { $dev.Handled = $true } catch {}
                })

                $webView.CoreWebView2.Add_IsDefaultDownloadDialogOpenChanged({
                    param($ds, $dev)
                    try {
                        if ($webView.CoreWebView2.IsDefaultDownloadDialogOpen) {
                            $webView.CoreWebView2.CloseDefaultDownloadDialog()
                        }
                    } catch {}
                })

                $webView.CoreWebView2.Add_NewWindowRequested({
                    param($ns, $nev)
                    $nev.Handled = $true
                })
            } catch {}
        } else {
            if (-not (Invoke-ChromiumAppFallback $appUrl)) {
                Start-Process $appUrl
            }
            $form.Close()
        }
    })

    $form.Add_FormClosing({
        if ($script:startedDaemon -and -not $script:launchedBrowserFallback -and $isServerListening) {
            try {
                $exitReq = [System.Net.WebRequest]::Create("$($script:baseUrl)/api/exit?shutdown=1")
                $exitReq.Timeout = 400
                $exitResp = $exitReq.GetResponse()
                $exitResp.Close()
            } catch {}
        }
    })

    $webView.Source = New-Object System.Uri($appUrl)
    [System.Windows.Forms.Application]::Run($form)
} catch {
    if (-not (Invoke-ChromiumAppFallback $appUrl)) {
        Start-Process $appUrl
    }
}

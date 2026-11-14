# Kalpten Kaleme — Windows 7, 8, 10, 11 Universal Desktop & "Birlikte Ac" Installer
# 100% Windows 11 Smart App Control (SAC) Compatible & Windows 7 PowerShell 2.0+ Compatible

$ErrorActionPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = 3072

$installDir = Join-Path $env:LOCALAPPDATA "KalptenKaleme"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

$targetHtml = Join-Path $installDir "Kalpten Kaleme.html"
$targetIco  = Join-Path $installDir "app.ico"
$baseUrl    = "https://meihper.github.io/Kalpten-Kaleme"

# 1. Check if Kalpten Kaleme.html already exists locally in Downloads or Desktop
$localCandidates = @(
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "Kalpten Kaleme.html"),
    (Join-Path $env:USERPROFILE "Downloads\Kalpten Kaleme.html")
)
foreach ($cand in $localCandidates) {
    if ((Test-Path $cand) -and ((Get-Item $cand).Length -gt 1000000)) {
        Copy-Item $cand $targetHtml -Force
        break
    }
}

# 2. Download Kalpten Kaleme.html and app.ico directly via WebClient (No Mark-of-the-Web Zone.Identifier!)
$wc = New-Object System.Net.WebClient
$wc.Encoding = [System.Text.Encoding]::UTF8

if (-not (Test-Path $targetHtml) -or ((Get-Item $targetHtml).Length -lt 1000000)) {
    try {
        $htmlBytes = $wc.DownloadData("$baseUrl/Kalpten%20Kaleme.html")
        if ($htmlBytes -and $htmlBytes.Length -gt 1000000) {
            [System.IO.File]::WriteAllBytes($targetHtml, $htmlBytes)
        }
    } catch {}
}

if (-not (Test-Path $targetIco)) {
    try {
        $icoBytes = $wc.DownloadData("$baseUrl/app.ico")
        if ($icoBytes -and $icoBytes.Length -gt 100) {
            [System.IO.File]::WriteAllBytes($targetIco, $icoBytes)
        }
    } catch {}
}

# 3. Create local OpenWith.ps1 launcher (Created via WriteAllText -> Zero Zone.Identifier -> Never blocked by SAC!)
$launcherPath = Join-Path $installDir "OpenWith.ps1"
$launcherCode = @'
param([string]$FilePath)
$ErrorActionPreference = "SilentlyContinue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$studioHtml = Join-Path $scriptDir "Kalpten Kaleme.html"
$launchTarget = $studioHtml

if ($FilePath -and (Test-Path $FilePath)) {
    try {
        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
        $b64 = [Convert]::ToBase64String($bytes)
        $fileName = (Split-Path -Leaf $FilePath).Replace("'", "\'")
        $rawHtml = [System.IO.File]::ReadAllText($studioHtml, [System.Text.Encoding]::UTF8)
        $autoloadTag = "<script>window.__AUTOLOAD_FILE={name:'$fileName',base64:'$b64'};</script>"
        $tempRunHtml = Join-Path $env:TEMP "Kalpten_Kaleme_Run.html"
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($tempRunHtml, ($autoloadTag + "`n" + $rawHtml), $utf8NoBom)
        $launchTarget = $tempRunHtml
    } catch {}
}

$fileUri = ([System.Uri]$launchTarget).AbsoluteUri
$browsers = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

foreach ($browserExe in $browsers) {
    if ($browserExe -and (Test-Path $browserExe)) {
        Start-Process -FilePath $browserExe -ArgumentList "--app=`"$fileUri`""
        exit 0
    }
}

Start-Process $launchTarget
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($launcherPath, $launcherCode, $utf8NoBom)

# 4. Register Word (.docx, .doc, .rtf, .txt, .md), PowerPoint (.pptx, .ppt), and PDF (.pdf) in Windows "Birlikte Ac" (Open With)
$psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path $psExe)) { $psExe = "powershell.exe" }
$openCmd = "`"$psExe`" -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`" `"%1`""
$icoVal  = if (Test-Path $targetIco) { "$targetIco,0" } else { "$psExe,0" }

# ProgID Registration for Windows 7 / 10 / 11 OpenWithProgids
$progIdKey = "HKCU:\Software\Classes\KalptenKaleme.Document"
New-Item -Path "$progIdKey\DefaultIcon" -Force | Out-Null
New-Item -Path "$progIdKey\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $progIdKey -Name "(default)" -Value "Kalpten Kaleme Belgesi"
Set-ItemProperty -Path $progIdKey -Name "FriendlyTypeName" -Value "Kalpten Kaleme Ofis Belgesi"
Set-ItemProperty -Path "$progIdKey\DefaultIcon" -Name "(default)" -Value $icoVal
Set-ItemProperty -Path "$progIdKey\shell\open\command" -Name "(default)" -Value $openCmd

# Applications Registration for "Birlikte Ac" Dialog
$appKey = "HKCU:\Software\Classes\Applications\KalptenKaleme.exe"
New-Item -Path "$appKey\DefaultIcon" -Force | Out-Null
New-Item -Path "$appKey\shell\open\command" -Force | Out-Null
New-Item -Path "$appKey\SupportedTypes" -Force | Out-Null
Set-ItemProperty -Path $appKey -Name "FriendlyAppName" -Value "Kalpten Kaleme (Word, Sunum & PDF)"
Set-ItemProperty -Path "$appKey\DefaultIcon" -Name "(default)" -Value $icoVal
Set-ItemProperty -Path "$appKey\shell\open\command" -Name "(default)" -Value $openCmd

$exts = @(".docx", ".doc", ".rtf", ".txt", ".md", ".pptx", ".ppt", ".pdf")
foreach ($ext in $exts) {
    Set-ItemProperty -Path "$appKey\SupportedTypes" -Name $ext -Value ""

    # Right-click context menu: "Kalpten Kaleme ile Ac"
    $sysKey = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\KalptenKaleme"
    New-Item -Path "$sysKey\command" -Force | Out-Null
    Set-ItemProperty -Path $sysKey -Name "(default)" -Value "Kalpten Kaleme ile Aç"
    Set-ItemProperty -Path $sysKey -Name "Icon" -Value $icoVal
    Set-ItemProperty -Path "$sysKey\command" -Name "(default)" -Value $openCmd

    # OpenWithProgids for Windows 7/10/11 "Birlikte Ac" menu
    $owKey = "HKCU:\Software\Classes\$ext\OpenWithProgids"
    New-Item -Path $owKey -Force | Out-Null
    Set-ItemProperty -Path $owKey -Name "KalptenKaleme.Document" -Value ""
}

# 5. Create Desktop & Start Menu Shortcuts
$wsh = New-Object -ComObject WScript.Shell
$shortcutLocations = @(
    [Environment]::GetFolderPath("Desktop"),
    [Environment]::GetFolderPath("Programs")
)
foreach ($loc in $shortcutLocations) {
    if ($loc -and (Test-Path $loc)) {
        $lnkPath = Join-Path $loc "Kalpten Kaleme.lnk"
        $sc = $wsh.CreateShortcut($lnkPath)
        $sc.TargetPath = $psExe
        $sc.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`""
        $sc.WorkingDirectory = $installDir
        $sc.WindowStyle = 7
        $sc.Description = "Kalpten Kaleme - Word, Sunum ve PDF Stüdyosu"
        if (Test-Path $targetIco) {
            $sc.IconLocation = "$targetIco,0"
        }
        $sc.Save()
    }
}

# 6. Launch Kalpten Kaleme in Browserless Desktop Window
Start-Process -FilePath $psExe -ArgumentList "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`""

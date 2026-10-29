# ==============================================================================
# Kalpten Kaleme - Local Server & Desktop App Launcher
# Supports Windows "Open With" (Birlikte Aç) and Command-Line File Arguments
# ==============================================================================

param(
    [string]$FilePath = "",
    [switch]$Daemon
)

$port = 52480
$rootDir = $PSScriptRoot
$openFileRecord = Join-Path $rootDir "current_open_file.txt"

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".ico"  = "image/x-icon"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".pdf"  = "application/pdf"
    ".zip"  = "application/zip"
    ".apk"  = "application/vnd.android.package-archive"
    ".pptx" = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ".ppt"  = "application/vnd.ms-powerpoint"
}

# Find Microsoft Edge
$edgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$edgeExe = $null
foreach ($path in $edgePaths) {
    if (Test-Path $path) {
        $edgeExe = $path
        break
    }
}

$appUrl = "http://localhost:$port/index.html"
$profileDir = Join-Path $rootDir "profile"
$antiSyncFlags = "--no-first-run --no-default-browser-check --disable-sync --disable-features=msEdgeAutoSignIn,msEdgeFirstRunExperience,msEdgeFreV2,msEdgeSyncNotice,msEdgeShowFirstRunNotification,msEdgeSignInOptIn,msEdgeFrePromo,msEdgeWelcomePageExperience,msEdgeStartupBoost"
$edgeArgs = "--app=`"$appUrl`" --user-data-dir=`"$profileDir`" $antiSyncFlags --window-size=1280,820"

# If a file was passed via CLI ("Open With"), record its absolute path
if (![string]::IsNullOrWhiteSpace($FilePath) -and (Test-Path $FilePath)) {
    try {
        [System.IO.File]::WriteAllText($openFileRecord, (Resolve-Path $FilePath).Path, [System.Text.Encoding]::UTF8)
    } catch {}
}

# Test if port is already active
$isAlreadyListening = $false
try {
    $testReq = [System.Net.WebRequest]::Create("http://localhost:$port/index.html")
    $testReq.Timeout = 1000
    $testResp = $testReq.GetResponse()
    $testResp.Close()
    $isAlreadyListening = $true
} catch {
    $isAlreadyListening = $false
}

if ($isAlreadyListening) {
    # If called as Daemon, do nothing and exit cleanly
    if (!$Daemon) {
        # Server is already active! Launch Edge in dedicated profile mode
        if ($edgeExe) {
            Start-Process $edgeExe -ArgumentList $edgeArgs
        } else {
            Start-Process $appUrl
        }
    }
    exit
}

# Start HTTP Listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    # Fallback to direct file mode
    $fileUrl = "file:///" + $rootDir.Replace('\', '/') + "/index.html"
    if (!$Daemon) {
        if ($edgeExe) {
            Start-Process $edgeExe -ArgumentList "--app=`"$fileUrl`" --user-data-dir=`"$profileDir`" --allow-file-access-from-files $antiSyncFlags --window-size=1280,820"
        } else {
            Start-Process $fileUrl
        }
    }
    exit
}

# Launch Edge in Native App Mode if not running as background daemon
if (!$Daemon) {
    if ($edgeExe) {
        Start-Process $edgeExe -ArgumentList $edgeArgs
    } else {
        Start-Process $appUrl
    }
}

function Get-SyncFolder {
    $cfgPath = Join-Path $PSScriptRoot "cloud_sync_config.txt"
    if (Test-Path $cfgPath) {
        $custom = [System.IO.File]::ReadAllText($cfgPath, [System.Text.Encoding]::UTF8).Trim()
        if (![string]::IsNullOrWhiteSpace($custom) -and (Test-Path $custom)) {
            return $custom
        }
    }

    # 1. Search all common Google Drive paths on Windows (G: drive and UserProfile)
    $gdriveCandidates = @(
        "G:\My Drive\Kalpten Kaleme",
        "G:\Drive'ım\Kalpten Kaleme",
        "G:\Kalpten Kaleme",
        (Join-Path $env:UserProfile "Google Drive\My Drive\Kalpten Kaleme"),
        (Join-Path $env:UserProfile "Google Drive\Drive'ım\Kalpten Kaleme"),
        (Join-Path $env:UserProfile "Google Drive\Kalpten Kaleme"),
        (Join-Path $env:UserProfile "GoogleDrive\Kalpten Kaleme")
    )

    foreach ($cand in $gdriveCandidates) {
        $parent = Split-Path $cand -Parent
        if (Test-Path $parent) {
            return $cand
        }
    }

    # 2. Local Fallback: Standard MyDocuments directory (clean, safe, no forced OneDrive)
    $docs = [Environment]::GetFolderPath("MyDocuments")
    return (Join-Path $docs "Kalpten Kaleme")
}

function Get-CloudProvider($folder) {
    if ($folder -like "*Google Drive*" -or $folder -like "*GoogleDrive*" -or $folder -like "G:\*") { return "gdrive" }
    if ($folder -like "*OneDrive*") { return "onedrive" }
    return "local"
}

# Robust Request Loop with Full REST API support
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $relPath = $request.Url.LocalPath.TrimStart('/')

        # ====================================================================
        # API 0: /api/heartbeat, /api/ping, /api/exit (Lifecycle endpoints)
        # ====================================================================
        if ($relPath -eq "api/heartbeat" -or $relPath -eq "api/ping" -or $relPath -eq "api/exit") {
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # ====================================================================
        # API 1: /api/opened-file-info (Check if a file was passed to open)
        # ====================================================================
        if ($relPath -eq "api/opened-file-info") {
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Access-Control-Allow-Origin", "*")

            if (Test-Path $openFileRecord) {
                $targetFile = [System.IO.File]::ReadAllText($openFileRecord, [System.Text.Encoding]::UTF8).Trim()
                if (![string]::IsNullOrWhiteSpace($targetFile) -and (Test-Path $targetFile)) {
                    $fileName = [System.IO.Path]::GetFileName($targetFile)
                    $ext = [System.IO.Path]::GetExtension($targetFile).ToLower().TrimStart('.')
                    $jsonObj = @{ hasFile = $true; filename = $fileName; ext = $ext }
                    $json = $jsonObj | ConvertTo-Json -Compress
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    $response.Close()
                    continue
                }
            }

            $emptyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"hasFile":false}')
            $response.OutputStream.Write($emptyBytes, 0, $emptyBytes.Length)
            $response.Close()
            continue
        }

        # ====================================================================
        # API 2: /api/opened-file-data (Serve the raw binary file content)
        # ====================================================================
        if ($relPath -eq "api/opened-file-data") {
            $response.AddHeader("Access-Control-Allow-Origin", "*")

            if (Test-Path $openFileRecord) {
                $targetFile = [System.IO.File]::ReadAllText($openFileRecord, [System.Text.Encoding]::UTF8).Trim()
                if (![string]::IsNullOrWhiteSpace($targetFile) -and (Test-Path $targetFile)) {
                    $fileBytes = [System.IO.File]::ReadAllBytes($targetFile)
                    $response.ContentType = "application/octet-stream"
                    $response.ContentLength64 = $fileBytes.Length
                    $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
                    $response.Close()

                    Remove-Item $openFileRecord -Force -ErrorAction SilentlyContinue
                    continue
                }
            }

            $response.StatusCode = 404
            $response.Close()
            continue
        }

        # ====================================================================
        # API 3: /api/save-document (Save DOCX / PDF / JSON directly to disk)
        # ====================================================================
        if ($relPath -eq "api/save-document" -and $request.HttpMethod -eq "POST") {
            $filename = $request.QueryString["filename"]
            if ([string]::IsNullOrWhiteSpace($filename)) { $filename = "Yeni Yazı.docx" }
            $filename = [System.IO.Path]::GetFileName($filename)

            $targetFolder = Get-SyncFolder
            if (!(Test-Path $targetFolder)) {
                [System.IO.Directory]::CreateDirectory($targetFolder) | Out-Null
            }
            $savePath = Join-Path $targetFolder $filename

            $fs = New-Object System.IO.FileStream($savePath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
            $request.InputStream.CopyTo($fs)
            $fs.Close()

            $timeStr = (Get-Date).ToString("HH:mm")
            $provider = Get-CloudProvider $targetFolder
            $isGDrive = ($provider -eq "gdrive")
            $isCloud = ($provider -ne "local")

            $jsonObj = @{
                success = $true
                path = $savePath
                filename = $filename
                time = $timeStr
                isGoogleDrive = $isGDrive
                isCloudSync = $isCloud
                cloudProvider = $provider
            }
            $json = $jsonObj | ConvertTo-Json -Compress
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # ====================================================================
        # API 4: /api/drive-status (Get current folder and cloud sync status)
        # ====================================================================
        if ($relPath -eq "api/drive-status") {
            $folder = Get-SyncFolder
            $provider = Get-CloudProvider $folder
            $isGDrive = ($provider -eq "gdrive")
            $isCloud = ($provider -ne "local")
            $exists = Test-Path $folder

            $jsonObj = @{
                syncFolder = $folder
                isGoogleDrive = $isGDrive
                isCloudSync = $isCloud
                cloudProvider = $provider
                exists = $exists
            }
            $json = $jsonObj | ConvertTo-Json -Compress
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # ====================================================================
        # API 5: /api/drive-files (List documents in sync folder)
        # ====================================================================
        if ($relPath -eq "api/drive-files") {
            $folder = Get-SyncFolder
            $fileList = @()
            if (Test-Path $folder) {
                $files = Get-ChildItem -Path $folder -File | Where-Object { $_.Extension -match "^\.(docx|doc|txt|md|html|pdf|pptx|ppt|json)$" } | Sort-Object LastWriteTime -Descending
                foreach ($f in $files) {
                    $sizeStr = if ($f.Length -gt 1MB) { "{0:N1} MB" -f ($f.Length / 1MB) } else { "{0} KB" -f [Math]::Max(1, [Math]::Round($f.Length / 1KB)) }
                    $fileList += @{
                        name = $f.Name
                        path = $f.FullName
                        size = $sizeStr
                        date = $f.LastWriteTime.ToString("dd.MM.yyyy HH:mm")
                        ext = $f.Extension.TrimStart('.').ToLower()
                    }
                }
            }
            $json = ConvertTo-Json -InputObject @($fileList) -Compress
            if (!$json -or $fileList.Count -eq 0) { $json = "[]" }
            elseif ($fileList.Count -eq 1 -and !$json.StartsWith("[")) { $json = "[$json]" }
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # ====================================================================
        # API 6: /api/open-sync-folder (Open Explorer at sync folder)
        # ====================================================================
        if ($relPath -eq "api/open-sync-folder") {
            $folder = Get-SyncFolder
            if (Test-Path $folder) {
                Start-Process "explorer.exe" -ArgumentList "`"$folder`""
            }
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # ====================================================================
        # API 7: /api/open-file-by-path (Stream requested document bytes)
        # ====================================================================
        if ($relPath -eq "api/open-file-by-path") {
            $p = $request.QueryString["path"]
            if (![string]::IsNullOrWhiteSpace($p) -and (Test-Path $p)) {
                $bytes = [System.IO.File]::ReadAllBytes($p)
                $response.ContentType = "application/octet-stream"
                $response.ContentLength64 = $bytes.Length
                $response.AddHeader("Access-Control-Allow-Origin", "*")
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }
            $response.StatusCode = 404
            $response.Close()
            continue
        }

        # ====================================================================
        # API 8: /api/open-specific-file (Queue file to be opened in app)
        # ====================================================================
        if ($relPath -eq "api/open-specific-file" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $filePath = $reader.ReadToEnd().Trim()
            $reader.Close()
            $foundPath = $null
            if (![string]::IsNullOrWhiteSpace($filePath)) {
                if (Test-Path $filePath -PathType Leaf) {
                    $foundPath = (Resolve-Path $filePath).Path
                } else {
                    $syncCandidate = Join-Path (Get-SyncFolder) ([System.IO.Path]::GetFileName($filePath))
                    if (Test-Path $syncCandidate -PathType Leaf) {
                        $foundPath = (Resolve-Path $syncCandidate).Path
                    }
                }
            }
            if ($foundPath) {
                [System.IO.File]::WriteAllText($openFileRecord, $foundPath, [System.Text.Encoding]::UTF8)
                $respJson = '{"success":true}'
            } else {
                $respJson = '{"success":false}'
            }
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($respJson)
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # ====================================================================
        # API 8B: /api/delete-file (Delete file from sync folder)
        # ====================================================================
        if ($relPath -eq "api/delete-file" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $filePath = $reader.ReadToEnd().Trim()
            $reader.Close()
            $deleted = $false
            if (![string]::IsNullOrWhiteSpace($filePath)) {
                $targetToDelete = $null
                if (Test-Path $filePath -PathType Leaf) {
                    $targetToDelete = $filePath
                } else {
                    $syncCandidate = Join-Path (Get-SyncFolder) ([System.IO.Path]::GetFileName($filePath))
                    if (Test-Path $syncCandidate -PathType Leaf) {
                        $targetToDelete = $syncCandidate
                    }
                }
                if ($targetToDelete) {
                    try {
                        Remove-Item -LiteralPath $targetToDelete -Force -ErrorAction Stop
                        $deleted = $true
                    } catch {}
                }
            }
            $respJson = if ($deleted) { '{"success":true}' } else { '{"success":false}' }
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($respJson)
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # ====================================================================
        # API 9: /api/select-sync-folder (Pick custom sync / drive folder)
        # ====================================================================
        if ($relPath -eq "api/select-sync-folder") {
            try {
                Add-Type -AssemblyName System.Windows.Forms
                $fbd = New-Object System.Windows.Forms.FolderBrowserDialog
                $fbd.Description = "Kalpten Kaleme Belgelerinizin Eşitleneceği Klasörü Seçin (Google Drive / OneDrive / Belgeler)"
                $fbd.ShowNewFolderButton = $true
                $dialogResult = $fbd.ShowDialog()
                if ($dialogResult -eq [System.Windows.Forms.DialogResult]::OK -and !([string]::IsNullOrWhiteSpace($fbd.SelectedPath))) {
                    [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "cloud_sync_config.txt"), $fbd.SelectedPath, [System.Text.Encoding]::UTF8)
                }
            } catch {}

            $curFolder = Get-SyncFolder
            $provider = Get-CloudProvider $curFolder
            $jsonObj = @{
                syncFolder = $curFolder
                isGoogleDrive = ($provider -eq "gdrive")
                isCloudSync = ($provider -ne "local")
                cloudProvider = $provider
            }
            $json = $jsonObj | ConvertTo-Json -Compress
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # ====================================================================
        # Static File Serving
        # ====================================================================
        if ([string]::IsNullOrWhiteSpace($relPath)) {
            $relPath = "index.html"
        }

        $filePath = Join-Path $rootDir $relPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = "application/octet-stream"
            if ($mimeTypes.ContainsKey($ext)) {
                $mime = $mimeTypes[$ext]
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        $response.Close()
    } catch [System.Net.HttpListenerException] {
        break
    } catch {
        continue
    }
}

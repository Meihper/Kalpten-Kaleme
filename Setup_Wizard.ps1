# ==============================================================================
# Kalpten Kaleme - Modern Windows Grafik Kurulum Sihirbazı (GUI Setup Wizard)
# 100% SAC-Safe: Uses signed inbox PowerShell + System.Windows.Forms
# ==============================================================================

$ErrorActionPreference = "SilentlyContinue"

# Ensure STA thread for WinForms GUI
if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne [System.Threading.ApartmentState]::STA) {
    $psExe = Join-Path $env:SystemRoot "SysNative\WindowsPowerShell\v1.0\powershell.exe"
    if (-not (Test-Path $psExe)) {
        $psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    }
    Start-Process -FilePath $psExe -ArgumentList @("-NoProfile", "-STA", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", $MyInvocation.MyCommand.Path) -WindowStyle Hidden
    exit
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

[System.Windows.Forms.Application]::EnableVisualStyles()

$installDir = Join-Path $env:LOCALAPPDATA "KalptenKaleme\Studio"
$payloadPath = $env:KK_SETUP_FILE
if ([string]::IsNullOrWhiteSpace($payloadPath) -or -not (Test-Path $payloadPath)) {
    $payloadPath = Join-Path $PSScriptRoot "Kalpten_Kaleme_Setup.bat"
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Kalpten Kaleme — Kurulum Sihirbazı"
$form.Size = New-Object System.Drawing.Size(540, 420)
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(250, 247, 238)
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)

$existingIco = Join-Path $installDir "app.ico"
if (-not (Test-Path $existingIco)) { $existingIco = Join-Path $PSScriptRoot "app.ico" }
if (Test-Path $existingIco) {
    try { $form.Icon = New-Object System.Drawing.Icon($existingIco) } catch {}
}

# Top Header Banner
$headerPanel = New-Object System.Windows.Forms.Panel
$headerPanel.Dock = [System.Windows.Forms.DockStyle]::Top
$headerPanel.Height = 92
$headerPanel.BackColor = [System.Drawing.Color]::FromArgb(28, 36, 56)
$form.Controls.Add($headerPanel)

$badgeLbl = New-Object System.Windows.Forms.Label
$badgeLbl.Text = "✒"
$badgeLbl.Font = New-Object System.Drawing.Font("Segoe UI Symbol", 24, [System.Drawing.FontStyle]::Bold)
$badgeLbl.ForeColor = [System.Drawing.Color]::FromArgb(245, 196, 81)
$badgeLbl.Location = New-Object System.Drawing.Point(22, 18)
$badgeLbl.Size = New-Object System.Drawing.Size(52, 54)
$badgeLbl.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$headerPanel.Controls.Add($badgeLbl)

$titleLbl = New-Object System.Windows.Forms.Label
$titleLbl.Text = "Kalpten Kaleme Stüdyosu"
$titleLbl.Font = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$titleLbl.ForeColor = [System.Drawing.Color]::White
$titleLbl.Location = New-Object System.Drawing.Point(82, 20)
$titleLbl.Size = New-Object System.Drawing.Size(420, 30)
$headerPanel.Controls.Add($titleLbl)

$subTitleLbl = New-Object System.Windows.Forms.Label
$subTitleLbl.Text = "Word (.docx) · PowerPoint Sunum (.pptx) · PDF Düzenleyici ve Araçlar"
$subTitleLbl.Font = New-Object System.Drawing.Font("Segoe UI", 9.25)
$subTitleLbl.ForeColor = [System.Drawing.Color]::FromArgb(203, 213, 225)
$subTitleLbl.Location = New-Object System.Drawing.Point(84, 52)
$subTitleLbl.Size = New-Object System.Drawing.Size(430, 22)
$headerPanel.Controls.Add($subTitleLbl)

# Body Card
$descLbl = New-Object System.Windows.Forms.Label
$descLbl.Text = "Kalpten Kaleme bilgisayarınıza tarayıcı sekmesi olmadan çalışan bağımsız masaüstü uygulaması olarak kurulacaktır."
$descLbl.Font = New-Object System.Drawing.Font("Segoe UI", 9.75)
$descLbl.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$descLbl.Location = New-Object System.Drawing.Point(28, 110)
$descLbl.Size = New-Object System.Drawing.Size(470, 42)
$form.Controls.Add($descLbl)

$pathLbl = New-Object System.Windows.Forms.Label
$pathLbl.Text = "Kurulum Konumu:  $installDir"
$pathLbl.Font = New-Object System.Drawing.Font("Segoe UI", 8.75)
$pathLbl.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
$pathLbl.Location = New-Object System.Drawing.Point(28, 154)
$pathLbl.Size = New-Object System.Drawing.Size(470, 20)
$form.Controls.Add($pathLbl)

$chkDesktop = New-Object System.Windows.Forms.CheckBox
$chkDesktop.Text = "Masaüstüne ve Başlat Menüsüne Kalpten Kaleme kısayolu ekle"
$chkDesktop.Checked = $true
$chkDesktop.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
$chkDesktop.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$chkDesktop.Location = New-Object System.Drawing.Point(30, 186)
$chkDesktop.Size = New-Object System.Drawing.Size(465, 24)
$form.Controls.Add($chkDesktop)

$chkOpenWith = New-Object System.Windows.Forms.CheckBox
$chkOpenWith.Text = "Word (.docx), PDF ve Sunum (.pptx) sağ tık 'Kalpten Kaleme ile Aç' menüsü ekle"
$chkOpenWith.Checked = $true
$chkOpenWith.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
$chkOpenWith.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$chkOpenWith.Location = New-Object System.Drawing.Point(30, 214)
$chkOpenWith.Size = New-Object System.Drawing.Size(475, 24)
$form.Controls.Add($chkOpenWith)

$chkLaunch = New-Object System.Windows.Forms.CheckBox
$chkLaunch.Text = "Kurulum tamamlandığında Kalpten Kaleme'yi hemen başlat"
$chkLaunch.Checked = $true
$chkLaunch.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$chkLaunch.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$chkLaunch.Location = New-Object System.Drawing.Point(30, 242)
$chkLaunch.Size = New-Object System.Drawing.Size(465, 24)
$form.Controls.Add($chkLaunch)

$statusLbl = New-Object System.Windows.Forms.Label
$statusLbl.Text = "Kuruluma hazır."
$statusLbl.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$statusLbl.ForeColor = [System.Drawing.Color]::FromArgb(71, 85, 105)
$statusLbl.Location = New-Object System.Drawing.Point(28, 278)
$statusLbl.Size = New-Object System.Drawing.Size(470, 20)
$form.Controls.Add($statusLbl)

$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Location = New-Object System.Drawing.Point(28, 302)
$progressBar.Size = New-Object System.Drawing.Size(470, 18)
$progressBar.Minimum = 0
$progressBar.Maximum = 100
$progressBar.Value = 0
$form.Controls.Add($progressBar)

$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = "Kur ve Başlat"
$btnInstall.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnInstall.BackColor = [System.Drawing.Color]::FromArgb(37, 99, 235)
$btnInstall.ForeColor = [System.Drawing.Color]::White
$btnInstall.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnInstall.FlatAppearance.BorderSize = 0
$btnInstall.Location = New-Object System.Drawing.Point(338, 334)
$btnInstall.Size = New-Object System.Drawing.Size(160, 38)
$btnInstall.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnInstall)

$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = "İptal"
$btnCancel.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
$btnCancel.BackColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$btnCancel.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnCancel.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnCancel.FlatAppearance.BorderSize = 0
$btnCancel.Location = New-Object System.Drawing.Point(230, 334)
$btnCancel.Size = New-Object System.Drawing.Size(96, 38)
$btnCancel.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnCancel.Add_Click({ $form.Close() })
$form.Controls.Add($btnCancel)

function Update-Step([int]$percent, [string]$message) {
    $progressBar.Value = [Math]::Min(100, [Math]::Max(0, $percent))
    $statusLbl.Text = $message
    [System.Windows.Forms.Application]::DoEvents()
}

$btnInstall.Add_Click({
    $btnInstall.Enabled = $false
    $btnCancel.Enabled = $false
    $chkDesktop.Enabled = $false
    $chkOpenWith.Enabled = $false
    $chkLaunch.Enabled = $false

    try {
        Update-Step 15 "Kurulum klasörü hazırlanıyor..."
        if (-not (Test-Path $installDir)) {
            New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        }

        $extracted = $false

        # 1. Extract from embedded payload inside Kalpten_Kaleme_Setup.bat if present
        if ($payloadPath -and (Test-Path $payloadPath)) {
            Update-Step 35 "Uygulama paket dosyaları çıkartılıyor..."
            $lines = [System.IO.File]::ReadAllLines($payloadPath, [System.Text.Encoding]::ASCII)
            $sb = New-Object System.Text.StringBuilder
            $inPayload = $false
            foreach ($line in $lines) {
                if ($line -eq "::KK_PAYLOAD_BEGIN") {
                    $inPayload = $true
                    continue
                }
                if ($line -eq "::KK_PAYLOAD_END") {
                    break
                }
                if ($inPayload -and $line.StartsWith("::")) {
                    [void]$sb.Append($line.Substring(2).Trim())
                }
            }

            if ($sb.Length -gt 100) {
                $zipBytes = [Convert]::FromBase64String($sb.ToString())
                $tempZip = Join-Path $env:TEMP ("kk_payload_" + [Guid]::NewGuid().ToString("N") + ".zip")
                [System.IO.File]::WriteAllBytes($tempZip, $zipBytes)
                try {
                    $archive = [System.IO.Compression.ZipFile]::OpenRead($tempZip)
                    try {
                        foreach ($entry in $archive.Entries) {
                            $relName = $entry.FullName.Replace('/', '\')
                            $destPath = Join-Path $installDir $relName
                            if ([string]::IsNullOrEmpty($entry.Name)) {
                                if (-not (Test-Path $destPath)) {
                                    New-Item -ItemType Directory -Path $destPath -Force | Out-Null
                                }
                                continue
                            }
                            $parentDir = Split-Path -Parent $destPath
                            if ($parentDir -and -not (Test-Path $parentDir)) {
                                New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
                            }
                            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destPath, $true)
                        }
                        $extracted = $true
                    } finally {
                        $archive.Dispose()
                    }
                } finally {
                    Remove-Item -LiteralPath $tempZip -Force -ErrorAction SilentlyContinue
                }
            }
        }

        # 2. Fallback: If run directly from local repository directory
        if (-not $extracted -and (Test-Path (Join-Path $PSScriptRoot "index.html"))) {
            Update-Step 45 "Yerel çalışma dosyaları kopyalanıyor..."
            if ($PSScriptRoot.TrimEnd('\') -ne $installDir.TrimEnd('\')) {
                Copy-Item -Path (Join-Path $PSScriptRoot "*") -Destination $installDir -Recurse -Force -ErrorAction SilentlyContinue
            }
            $extracted = $true
        }

        if (-not (Test-Path (Join-Path $installDir "index.html"))) {
            [System.Windows.Forms.MessageBox]::Show(
                "Kurulum paketi çıkartılamadı. Lütfen Kalpten_Kaleme_Setup.bat dosyasını tekrar indirip çalıştırın.",
                "Kalpten Kaleme Kurulum Hatası",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Error
            ) | Out-Null
            $btnInstall.Enabled = $true
            $btnCancel.Enabled = $true
            return
        }

        Update-Step 65 "Windows güvenlik izinleri doğrulanıyor..."
        Get-ChildItem -LiteralPath $installDir -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

        $oldExe = Join-Path $installDir "KalptenKaleme.exe"
        if (Test-Path $oldExe) {
            Remove-Item -LiteralPath $oldExe -Force -ErrorAction SilentlyContinue
        }

        $icoFile = Join-Path $installDir "app.ico"
        if (Test-Path $icoFile) {
            try { $form.Icon = New-Object System.Drawing.Icon($icoFile) } catch {}
        }

        if ($chkDesktop.Checked) {
            Update-Step 80 "Masaüstü ve Başlat Menüsü kısayolu oluşturuluyor..."
            $shortcutScript = Join-Path $installDir "Masaustu_Kisayol_Olustur.ps1"
            if (Test-Path $shortcutScript) {
                & $shortcutScript | Out-Null
            }
        }

        if ($chkOpenWith.Checked) {
            Update-Step 90 "Dosya ilişkilendirmeleri (Birlikte Aç) kaydediliyor..."
            $openWithScript = Join-Path $installDir "register_open_with.ps1"
            if (Test-Path $openWithScript) {
                & $openWithScript | Out-Null
            }
        }

        Update-Step 100 "Kurulum başarıyla tamamlandı!"
        Start-Sleep -Milliseconds 350

        if ($chkLaunch.Checked) {
            $wscriptExe = Join-Path $env:SystemRoot "System32\wscript.exe"
            $vbsFile = Join-Path $installDir "Baslat.vbs"
            $nativePs1 = Join-Path $installDir "KalptenKaleme.ps1"
            $ps64 = Join-Path $env:SystemRoot "SysNative\WindowsPowerShell\v1.0\powershell.exe"
            if (-not (Test-Path $ps64)) {
                $ps64 = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
            }

            if ((Test-Path $wscriptExe) -and (Test-Path $vbsFile)) {
                Start-Process -FilePath $wscriptExe -ArgumentList "//nologo `"$vbsFile`"" -WorkingDirectory $installDir
            } elseif (Test-Path $nativePs1) {
                Start-Process -FilePath $ps64 -ArgumentList "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$nativePs1`"" -WorkingDirectory $installDir -WindowStyle Hidden
            }
        }

        $form.Close()
    } catch {
        [System.Windows.Forms.MessageBox]::Show(
            "Kurulum sırasında beklenmeyen bir hata oluştu:`n" + $_.Exception.Message,
            "Kalpten Kaleme",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
        $btnInstall.Enabled = $true
        $btnCancel.Enabled = $true
    }
})

$form.AcceptButton = $btnInstall
[void]$form.ShowDialog()

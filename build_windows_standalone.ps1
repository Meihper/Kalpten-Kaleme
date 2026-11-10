$ErrorActionPreference = "Stop"
Set-Location "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice"

Add-Type -AssemblyName System.Drawing

function Get-ResizedPngDataUri([string]$filePath, [int]$size = 96) {
    $src = [System.Drawing.Bitmap]::FromFile($filePath)
    $dst = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, $size, $size)
    $ms = New-Object System.IO.MemoryStream
    $dst.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $b64 = [Convert]::ToBase64String($ms.ToArray())
    $g.Dispose()
    $dst.Dispose()
    $src.Dispose()
    $ms.Dispose()
    return "data:image/png;base64,$b64"
}

Write-Host "Building self-contained Kalpten Kaleme.html..."

$iconMap = @{
    "app.png"        = Get-ResizedPngDataUri "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice\app.png" 96
    "docx_file.png"  = Get-ResizedPngDataUri "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice\docx_file.png" 96
    "pdf_file.png"   = Get-ResizedPngDataUri "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice\pdf_file.png" 96
    "pptx_file.png"  = Get-ResizedPngDataUri "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice\pptx_file.png" 96
    "tools_file.png" = Get-ResizedPngDataUri "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice\tools_file.png" 96
}

$html = [System.IO.File]::ReadAllText("C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice\index.html", [System.Text.Encoding]::UTF8)
$css  = [System.IO.File]::ReadAllText("C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice\styles.css", [System.Text.Encoding]::UTF8)

# 1. Remove external favicon.ico & manifest.json links (prevents file:// CORS warnings)
$html = [regex]::Replace($html, '<link\s+rel="icon"\s+type="image/x-icon"\s+href="favicon\.ico[^"]*">\s*', '')
$html = [regex]::Replace($html, '<link\s+rel="manifest"\s+href="manifest\.json[^"]*">\s*', '')
$html = [regex]::Replace($html, '<link\s+rel="apple-touch-icon"\s+href="app\.png[^"]*">', "<link rel=`"apple-touch-icon`" href=`"$($iconMap['app.png'])`">")

# 2. Inline styles.css and set window.__KALPTEN_DESKTOP_STANDALONE = true
$inlineStyleBlock = "<script>window.__KALPTEN_DESKTOP_STANDALONE = true;</script>`n  <style>`n$css`n  </style>"
$html = [regex]::Replace($html, '<link\s+rel="stylesheet"\s+href="styles\.css[^"]*">', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $inlineStyleBlock })

# 3. Remove deferred vendor script tags from <head>
$html = [regex]::Replace($html, '\s*<script\s+src="vendor/[^"]+"\s+defer></script>', '')

# 4. Build combined inline scripts block (vendor + app scripts in exact order)
$scriptOrder = @(
    "vendor\jszip.min.js",
    "vendor\mammoth.browser.min.js",
    "vendor\html-docx.js",
    "vendor\pdf.min.js",
    "vendor\pdf.worker.min.js",
    "vendor\pdf-lib.min.js",
    "app.js",
    "word-editor.js",
    "pdf-editor.js",
    "pdf-tools.js",
    "ppt-editor.js"
)

$sb = New-Object System.Text.StringBuilder
foreach ($relScript in $scriptOrder) {
    $fullPath = Join-Path "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice" $relScript
    $jsCode = [System.IO.File]::ReadAllText($fullPath, [System.Text.Encoding]::UTF8)
    # Escape any literal </script inside JS so HTML parser never closes <script> early
    $jsCode = [regex]::Replace($jsCode, '(?i)</script', '<\/script')
    [void]$sb.AppendLine("<script>")
    [void]$sb.AppendLine($jsCode)
    [void]$sb.AppendLine("</script>")
}

$allScriptsBlock = $sb.ToString()

# Replace the 5 app script tags at the bottom of <body> with the combined inline scripts
$html = [regex]::Replace(
    $html,
    '<!-- App Scripts[^\r\n]*-->[\s\S]*?<script\s+src="ppt-editor\.js[^"]*"\s+defer></script>',
    [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $allScriptsBlock }
)

# 5. Replace all 5 icon filenames in HTML & JS with their inline Base64 Data URIs
foreach ($k in $iconMap.Keys) {
    $uri = $iconMap[$k]
    $html = $html.Replace("`"$k`"", "`"$uri`"")
    $html = $html.Replace("'$k'", "'$uri'")
}

$outHtmlPath = "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice\Kalpten Kaleme.html"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outHtmlPath, $html, $utf8NoBom)

$sizeMB = [Math]::Round((Get-Item $outHtmlPath).Length / 1MB, 2)
Write-Host "Created self-contained '$outHtmlPath' ($sizeMB MB)"

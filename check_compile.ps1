$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$port = 9390
$profileDir = 'C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice\profile_audit_word_pages'

$p = Start-Process $edge -ArgumentList @(
    '--headless=new',
    "--remote-debugging-port=$port",
    "--user-data-dir=`"$profileDir`"",
    '--no-first-run',
    'about:blank'
) -PassThru

Start-Sleep 2
try {
    $tabs = Invoke-RestMethod "http://localhost:$port/json"
    $tab = $tabs | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ws.ConnectAsync([uri]$tab.webSocketDebuggerUrl, [System.Threading.CancellationToken]::None).Wait()

    function Send-Cdp($method, $params = @{}) {
        $id = Get-Random
        $payload = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
        $ws.SendAsync([System.ArraySegment[byte]]$bytes, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()
        
        $ms = New-Object System.IO.MemoryStream
        do {
            $buf = New-Object byte[] 65536
            $segment = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
            $res = $ws.ReceiveAsync($segment, [System.Threading.CancellationToken]::None).Result
            $ms.Write($buf, 0, $res.Count)
        } while (!$res.EndOfMessage)
        return [System.Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
    }

    Send-Cdp 'Page.enable' | Out-Null
    Send-Cdp 'Runtime.enable' | Out-Null

    $jsFiles = @('app.js', 'word-editor.js', 'pdf-editor.js', 'pdf-tools.js', 'ppt-editor.js')
    $hasError = $false
    foreach ($file in $jsFiles) {
        $fullPath = Join-Path 'C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice' $file
        $code = [System.IO.File]::ReadAllText($fullPath, [System.Text.Encoding]::UTF8)
        $compileRes = Send-Cdp 'Runtime.compileScript' @{ expression = $code; sourceURL = $file; persistScript = $false }
        if ($compileRes.result.exceptionDetails) {
            Write-Host "[ERROR] $file => " ($compileRes.result.exceptionDetails | ConvertTo-Json -Compress) -ForegroundColor Red
            $hasError = $true
        } else {
            Write-Host "[OK] $file syntax verified." -ForegroundColor Green
        }
    }
    if ($hasError) { exit 1 }
} finally {
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}

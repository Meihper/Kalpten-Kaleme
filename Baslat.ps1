$ErrorActionPreference = "SilentlyContinue"
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $appDir

$csPath = Join-Path $appDir "BelgeDuzenleyici.cs"
$code = [System.IO.File]::ReadAllText($csPath, [System.Text.Encoding]::UTF8)
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms, System.Drawing, System.Net
[BelgeDuzenleyici.Program]::CustomAppDir = ($appDir + "\")
[BelgeDuzenleyici.Program]::Main($args)

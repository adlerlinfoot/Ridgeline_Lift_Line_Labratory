$project = $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) { $nodePath = 'C:\Program Files\nodejs\node.exe' }
try { $response = Invoke-WebRequest 'http://127.0.0.1:43880/' -UseBasicParsing -TimeoutSec 2 } catch { $response = $null }
if (-not $response) { Start-Process -FilePath $nodePath -ArgumentList 'scripts/serve.mjs' -WorkingDirectory $project -WindowStyle Hidden }
Start-Process 'http://127.0.0.1:43880/'

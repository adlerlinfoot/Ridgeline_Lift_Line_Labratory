param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) { $nodePath = 'C:\Program Files\nodejs\node.exe' }
try { $response = Invoke-WebRequest 'http://127.0.0.1:43880/' -UseBasicParsing -TimeoutSec 2 } catch { $response = $null }
if (-not $response) {
  if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js was not found. Install Node.js and try again.' }
  Start-Process -FilePath $nodePath -ArgumentList 'scripts/serve.mjs' -WorkingDirectory $project -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(8)
  do {
    try { $response = Invoke-WebRequest 'http://127.0.0.1:43880/' -UseBasicParsing -TimeoutSec 1 } catch { $response = $null }
    if (-not $response) { Start-Sleep -Milliseconds 100 }
  } while (-not $response -and (Get-Date) -lt $deadline)
  if (-not $response) { throw 'Ridgeline did not start at http://127.0.0.1:43880/.' }
}
# Optional separately checked-out importer plugin. No extraction code is copied into this repo.
$importerStart = Join-Path (Split-Path $project -Parent) 'Ridgeline_Map_Importer\Start-MapImporter.ps1'
if (Test-Path -LiteralPath $importerStart) { try { & $importerStart -NoBrowser } catch { Write-Warning ('Optional map importer: ' + $_.Exception.Message) } }
Write-Host 'Ridgeline: http://127.0.0.1:43880/'
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:43880/' }

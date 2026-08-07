# Repairs the VS Code / Cursor webview error:
#   "Could not register service worker: InvalidStateError"
# by deleting the editor's Service Worker cache (safe: it is recreated on start).
# The cache can only be deleted while the editor is fully closed.
#
# Usage:
#   .\fix-webview-cache.ps1          # clears cache of editors that are not running
#   .\fix-webview-cache.ps1 -Wait    # waits for running editors to close, then clears
param([switch]$Wait)

$targets = @(
  @{ Name = 'VS Code'; Data = Join-Path $env:APPDATA 'Code';   Proc = 'Code' },
  @{ Name = 'Cursor';  Data = Join-Path $env:APPDATA 'Cursor'; Proc = 'Cursor' }
)

foreach ($t in $targets) {
  $sw = Join-Path $t.Data 'Service Worker'
  if (-not (Test-Path -LiteralPath $sw)) { continue }

  if (Get-Process -Name $t.Proc -ErrorAction SilentlyContinue) {
    if ($Wait) {
      Write-Host "$($t.Name): waiting for the editor to close..."
      while (Get-Process -Name $t.Proc -ErrorAction SilentlyContinue) {
        Start-Sleep -Seconds 2
      }
    }
    else {
      Write-Host "$($t.Name): running — close it and re-run this script (or use -Wait)."
      continue
    }
  }

  Remove-Item -LiteralPath $sw -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "$($t.Name): Service Worker cache cleared."
}

# Watch Обсуждения.md for content changes; print CHANGED once per edit.
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $PSScriptRoot
$file = Get-ChildItem -LiteralPath $dir -File -Filter '*.md' |
  Where-Object { $_.Name -eq [string]([char]0x041E) + [char]0x0431 + [char]0x0441 + [char]0x0443 + [char]0x0436 + [char]0x0434 + [char]0x0435 + [char]0x043D + [char]0x0438 + [char]0x044F + '.md' } |
  Select-Object -First 1

if (-not $file) {
  # Fallback: only non-English markdown at repo root (the discussions file)
  $file = Get-ChildItem -LiteralPath $dir -File -Filter '*.md' |
    Where-Object { $_.Name -notmatch '^(CHANGELOG|CONTRIBUTING|INSTALL|README)' } |
    Select-Object -First 1
}

if (-not $file) {
  Write-Output 'FAILED'
  exit 1
}

$lastHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
while ($true) {
  Start-Sleep -Seconds 3
  try {
    if (-not (Test-Path -LiteralPath $file.FullName)) {
      Write-Output 'FAILED'
      exit 1
    }
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    if ($hash -ne $lastHash) {
      $lastHash = $hash
      Write-Output 'CHANGED'
    }
  } catch {
    Write-Output 'FAILED'
    exit 1
  }
}

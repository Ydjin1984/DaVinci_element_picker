#Requires -Version 5.1
<#
.SYNOPSIS
  Create (or update) a GitHub Release for the current package.json version and attach the VSIX.

.DESCRIPTION
  Reads version from package.json, requires element-picker-<ver>.vsix in the repo root
  (or dist/), builds release notes from CHANGELOG.md, and runs:

    gh release create vX.Y.Z element-picker-X.Y.Z.vsix --title "DaVinchi X.Y.Z" --latest

  Auth: uses GH_TOKEN / GITHUB_TOKEN if set, otherwise tries git credential fill
  for github.com (same token that powers git push).

.PARAMETER Repo
  owner/name. Default: Ydjin1984/DaVinci_element_picker

.PARAMETER SkipIfExists
  If the tag/release already exists, upload/replace the VSIX asset instead of failing.

.EXAMPLE
  .\scripts\github-release.ps1
#>
param(
  [string] $Repo = "Ydjin1984/DaVinci_element_picker",
  [switch] $SkipIfExists
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Find-Gh {
  $cmd = Get-Command gh -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @(
      "$env:ProgramFiles\GitHub CLI\gh.exe",
      "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
    )) {
    if (Test-Path $p) { return $p }
  }
  throw "GitHub CLI (gh) not found. Install: winget install GitHub.cli"
}

function Ensure-GhToken {
  if ($env:GH_TOKEN -or $env:GITHUB_TOKEN) { return }
  try {
    $raw = ("protocol=https`nhost=github.com`n`n" | git credential fill 2>$null) -join "`n"
    $token = ($raw -split "`n" | Where-Object { $_ -like "password=*" }) -replace "^password=", ""
    if ($token) {
      $env:GH_TOKEN = $token
      Write-Host "    auth: GH_TOKEN from git credential" -ForegroundColor DarkGray
    }
  } catch {
    # fall through — gh may already be logged in
  }
}

function Get-ChangelogNotes([string] $version) {
  $path = Join-Path $root "CHANGELOG.md"
  if (-not (Test-Path $path)) {
    return "DaVinchi $version`n`nSee CHANGELOG.md in the repository."
  }
  $lines = Get-Content $path -Encoding UTF8
  $start = -1
  $pattern = "^\s*## \[$([regex]::Escape($version))\]"
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $start = $i
      break
    }
  }
  if ($start -lt 0) {
    return "DaVinchi $version`n`nSee CHANGELOG.md in the repository."
  }
  $buf = New-Object System.Collections.Generic.List[string]
  $buf.Add("## DaVinchi $version")
  $buf.Add("")
  for ($i = $start + 1; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*## \[') { break }
    $buf.Add($lines[$i])
  }
  $buf.Add("")
  $buf.Add("### Install")
  $buf.Add("")
  $buf.Add("1. Download **element-picker-$version.vsix** below")
  $buf.Add("2. VS Code / Cursor → Extensions → ``⋯`` → **Install from VSIX…**")
  $buf.Add("3. Reload window")
  $buf.Add("")
  $buf.Add('```powershell')
  $buf.Add("code --install-extension .\element-picker-$version.vsix --force")
  $buf.Add("cursor --install-extension .\element-picker-$version.vsix --force")
  $buf.Add('```')
  $buf.Add("")
  $buf.Add("Package id: ``coin-rebalancer.element-picker``")
  return ($buf -join "`n").Trim() + "`n"
}

$gh = Find-Gh
Ensure-GhToken

$pkg = Get-Content (Join-Path $root "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$version = [string]$pkg.version
if (-not $version) { throw "package.json has no version" }

$tag = "v$version"
$title = "DaVinchi $version"
$vsixName = "element-picker-$version.vsix"
$vsix = Join-Path $root $vsixName
if (-not (Test-Path $vsix)) {
  $alt = Join-Path $root "dist\$vsixName"
  if (Test-Path $alt) { $vsix = $alt }
}
if (-not (Test-Path $vsix)) {
  throw "VSIX not found: $vsixName (run npm run package first)"
}

$notes = Get-ChangelogNotes $version
$notesFile = Join-Path $env:TEMP "davinchi-release-$version.md"
Set-Content -Path $notesFile -Value $notes -Encoding UTF8

Write-Host "==> GitHub Release $tag → $Repo" -ForegroundColor Cyan
Write-Host "    asset: $vsix"

$exists = $false
& $gh release view $tag --repo $Repo 1>$null 2>$null
if ($LASTEXITCODE -eq 0) { $exists = $true }

if ($exists) {
  if (-not $SkipIfExists) {
    Write-Host "    release exists — uploading/clobbering VSIX…" -ForegroundColor Yellow
  }
  & $gh release upload $tag $vsix --repo $Repo --clobber
  if ($LASTEXITCODE -ne 0) { throw "gh release upload failed" }
  & $gh release edit $tag --repo $Repo --title $title --notes-file $notesFile --latest
  Write-Host "==> updated https://github.com/$Repo/releases/tag/$tag" -ForegroundColor Green
} else {
  & $gh release create $tag $vsix `
    --repo $Repo `
    --title $title `
    --notes-file $notesFile `
    --latest `
    --target main
  if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }
  Write-Host "==> created https://github.com/$Repo/releases/tag/$tag" -ForegroundColor Green
}

Remove-Item $notesFile -Force -ErrorAction SilentlyContinue

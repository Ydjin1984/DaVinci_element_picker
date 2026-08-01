#Requires -Version 5.1
<#
.SYNOPSIS
  Prepare / push DaVinchi to GitHub.

.DESCRIPTION
  1. Ensures git repo is initialized
  2. Creates GitHub repo via `gh` if available (or prints manual steps)
  3. Commits current tree (if needed) and pushes main

.PARAMETER Owner
  GitHub user or org (e.g. myuser). Required for remote URL.

.PARAMETER RepoName
  Repository name. Default: DaVinci_element_picker

.PARAMETER Private
  Create a private repo (default public).

.EXAMPLE
  .\scripts\publish-github.ps1 -Owner Ydjin1984
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $Owner,

  [string] $RepoName = "DaVinci_element_picker",

  [switch] $Private
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$remote = "https://github.com/$Owner/$RepoName.git"
$visibility = if ($Private) { "private" } else { "public" }

Write-Host "==> DaVinchi → GitHub" -ForegroundColor Cyan
Write-Host "    $remote ($visibility)"

if (-not (Test-Path .git)) {
  git init -b main
  Write-Host "    git init (main)"
}

# package.json repository field
$pkgPath = "package.json"
if (Test-Path $pkgPath) {
  $raw = Get-Content $pkgPath -Raw -Encoding UTF8
  $raw = $raw -replace '"url":\s*"[^"]*"', "`"url`": `"$remote`""
  Set-Content -Path $pkgPath -Value $raw -Encoding UTF8 -NoNewline
  # ensure trailing newline
  Add-Content -Path $pkgPath -Value ""
  Write-Host "    package.json repository → $remote"
}

git add -A
$status = git status --porcelain
if ($status) {
  git commit -m "chore: initial public release of DaVinchi Element Picker"
  Write-Host "    committed"
} else {
  Write-Host "    nothing new to commit"
}

$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) {
  $exists = gh repo view "$Owner/$RepoName" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "    creating repo with gh…"
    gh repo create "$Owner/$RepoName" --$visibility --source=. --remote=origin --push --description "DaVinchi — Element Picker for VS Code & Cursor. Pick DOM elements, capture screenshot + HTML/CSS, feed any AI agent."
  } else {
    Write-Host "    repo exists — pushing…"
    git remote remove origin 2>$null
    git remote add origin $remote
    git push -u origin main
  }
} else {
  Write-Host ""
  Write-Host "gh CLI not found. Manual steps:" -ForegroundColor Yellow
  Write-Host "  1. Create empty repo: https://github.com/new  →  $Owner/$RepoName"
  Write-Host "  2. git remote add origin $remote"
  Write-Host "  3. git push -u origin main"
  Write-Host ""
  Write-Host "Or install GitHub CLI: https://cli.github.com/"
  if (-not (git remote get-url origin 2>$null)) {
    git remote add origin $remote
    Write-Host "    remote 'origin' set (push when ready)"
  }
}

Write-Host "==> done" -ForegroundColor Green

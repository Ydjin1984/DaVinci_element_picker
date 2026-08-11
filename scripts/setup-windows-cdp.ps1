#Requires -Version 5.1
<#
.SYNOPSIS
  One-command Windows setup for the "DaVinchi on the SSH server" topology.

.DESCRIPTION
  Only needed when the extension is installed ON a remote SSH host and must
  drive the browser on THIS machine. For a local install nothing here is
  required — DaVinchi launches Chrome by itself.

  What it sets up (all per-user, no administrator rights):
    1. %LOCALAPPDATA%\DaVinchi\start-chrome-cdp.cmd — starts Chrome with a
       debug port in a separate profile; exits quietly if it already runs.
    2. Startup entry so that Chrome is ready right after you log in.
    3. Scheduled task "DaVinchi Chrome CDP" — brings it back if you close it.
    4. URI handler davinchi-chrome: — lets the extension on the server start
       that Chrome on this machine (Open browser does it for you).
    5. Optional: RemoteForward <port> in ~/.ssh/config for the host you name,
       so the server can reach this machine's debug port.

.PARAMETER SshHost
  Host entry in ~/.ssh/config to add the reverse port forward to. Omit to skip.

.PARAMETER Port
  Debug port. Default 9222 — matches elementPicker.cdpEndpoint.

.PARAMETER NoWatchdog
  Skip the scheduled task. Chrome then starts at logon and on demand only.

.PARAMETER Uninstall
  Remove everything this script created.

.EXAMPLE
  .\setup-windows-cdp.ps1 -SshHost my-server

.EXAMPLE
  .\setup-windows-cdp.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [string]$SshHost = "",
  [int]$Port = 9222,
  [switch]$NoWatchdog,
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$AppDir    = Join-Path $env:LOCALAPPDATA "DaVinchi"
$CmdPath   = Join-Path $AppDir "start-chrome-cdp.cmd"
$VbsPath   = Join-Path $AppDir "start-chrome-cdp-hidden.vbs"
$StartupLnk= Join-Path ([Environment]::GetFolderPath("Startup")) "DaVinchi-Chrome-CDP.vbs"
$TaskName  = "DaVinchi Chrome CDP"
$RegRoot   = "HKCU:\Software\Classes\davinchi-chrome"

function Write-Step($text) { Write-Host "  $text" }
function Write-Ok($text)   { Write-Host "  [ok] $text"   -ForegroundColor Green }
function Write-Warn2($text){ Write-Host "  [!]  $text"   -ForegroundColor Yellow }
function Write-Fail($text) { Write-Host "  [x]  $text"   -ForegroundColor Red }

function Test-DebugPort([int]$p) {
  try {
    $raw = & curl.exe -s --max-time 4 --noproxy "*" "http://localhost:$p/json/version" 2>$null
    return (($raw -join "") -match '"Browser"')
  } catch { return $false }
}

# ---------------------------------------------------------------- uninstall
if ($Uninstall) {
  Write-Host "DaVinchi — removing the local CDP helper" -ForegroundColor Cyan

  try { schtasks /Delete /TN $TaskName /F 2>&1 | Out-Null; Write-Ok "scheduled task removed" }
  catch { Write-Step "scheduled task was not present" }

  foreach ($p in @($StartupLnk, $VbsPath, $CmdPath)) {
    if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force; Write-Ok "removed $p" }
  }
  if (Test-Path -LiteralPath $RegRoot) {
    Remove-Item -LiteralPath $RegRoot -Recurse -Force
    Write-Ok "URI handler davinchi-chrome: removed"
  }
  Write-Warn2 "Chrome profile kept at $AppDir\chrome-profile (delete it yourself if you want)"
  Write-Warn2 "RemoteForward in ~/.ssh/config is left untouched — remove the line marked 'DaVinchi' if you no longer need it"
  Write-Host "Done." -ForegroundColor Cyan
  return
}

Write-Host "DaVinchi — local browser setup for a server-hosted extension" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------- chrome
$chrome = @(
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

if (-not $chrome) {
  Write-Fail "Google Chrome not found. Install Chrome and run this script again."
  exit 1
}
Write-Ok "Chrome: $chrome"

# ------------------------------------------------------------------ launcher
# Written as ASCII on purpose: cmd.exe misparses UTF-8 batch files.
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
$cmdLines = @(
  '@echo off',
  'setlocal',
  "title DaVinchi - Chrome for element picker (CDP $Port)",
  "set `"PORT=$Port`"",
  'set "PROFILE=%LOCALAPPDATA%\DaVinchi\chrome-profile"',
  '',
  'rem Already listening? Do not start a second instance.',
  'curl.exe -s --max-time 3 --noproxy "*" http://localhost:%PORT%/json/version 2>nul | find "Browser" >nul 2>&1',
  'if not errorlevel 1 exit /b 0',
  '',
  'set "CHROME="',
  'if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"',
  'if not defined CHROME if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"',
  'if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"',
  'if not defined CHROME exit /b 1',
  '',
  'if not exist "%PROFILE%" mkdir "%PROFILE%"',
  'start "" "%CHROME%" --remote-debugging-port=%PORT% --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check about:blank',
  'exit /b 0'
)
Set-Content -LiteralPath $CmdPath -Value $cmdLines -Encoding ASCII
Write-Ok "launcher: $CmdPath"

# Hidden wrapper so no console window flashes.
Set-Content -LiteralPath $VbsPath -Encoding ASCII `
  -Value ('CreateObject("WScript.Shell").Run "cmd /c ""' + $CmdPath + '""", 0, False')
Copy-Item -LiteralPath $VbsPath -Destination $StartupLnk -Force
Write-Ok "starts automatically when you log in"

# ------------------------------------------------------------------ watchdog
if ($NoWatchdog) {
  Write-Step "watchdog skipped (-NoWatchdog)"
} else {
  schtasks /Create /TN $TaskName /TR "wscript.exe `"$VbsPath`"" /SC MINUTE /MO 2 /IT /F 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Ok "watchdog task '$TaskName' — restores Chrome within 2 minutes if you close it" }
  else { Write-Warn2 "could not create the watchdog task; autostart and on-demand start still work" }
}

# ---------------------------------------------------------------- uri handler
New-Item -Path $RegRoot -Force | Out-Null
Set-ItemProperty -Path $RegRoot -Name "(Default)"    -Value "URL:DaVinchi Chrome CDP"
Set-ItemProperty -Path $RegRoot -Name "URL Protocol" -Value ""
New-Item -Path "$RegRoot\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$RegRoot\shell\open\command" -Name "(Default)" -Value "wscript.exe `"$VbsPath`""
Write-Ok "URI handler davinchi-chrome: — Open browser can start Chrome from the server"

# ------------------------------------------------------------------ ssh config
if ($SshHost) {
  $sshCfg = Join-Path $env:USERPROFILE ".ssh\config"
  if (-not (Test-Path -LiteralPath $sshCfg)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $sshCfg) | Out-Null
    Set-Content -LiteralPath $sshCfg -Value @("Host $SshHost", "  HostName $SshHost") -Encoding ASCII
  }
  $lines = @(Get-Content -LiteralPath $sshCfg)
  $hostIdx = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*Host\s+(.+)$") {
      $names = $Matches[1] -split "\s+"
      if ($names -contains $SshHost) { $hostIdx = $i; break }
    }
  }
  if ($hostIdx -lt 0) {
    $lines += @("", "Host $SshHost", "  HostName $SshHost", "  # DaVinchi: server reaches the browser on this PC", "  RemoteForward $Port localhost:$Port")
    Set-Content -LiteralPath $sshCfg -Value $lines -Encoding ASCII
    Write-Ok "added a new '$SshHost' entry with RemoteForward $Port to ~/.ssh/config"
  } else {
    # Scan until the next Host line to see whether the forward is already there
    $end = $lines.Count
    for ($j = $hostIdx + 1; $j -lt $lines.Count; $j++) {
      if ($lines[$j] -match "^\s*Host\s+") { $end = $j; break }
    }
    $block = $lines[$hostIdx..($end - 1)] -join "`n"
    if ($block -match "RemoteForward\s+$Port\b") {
      Write-Ok "~/.ssh/config already forwards port $Port for '$SshHost'"
    } else {
      $new = @()
      $new += $lines[0..$hostIdx]
      $new += "  # DaVinchi: server reaches the browser on this PC"
      $new += "  RemoteForward $Port localhost:$Port"
      if ($hostIdx + 1 -lt $lines.Count) { $new += $lines[($hostIdx + 1)..($lines.Count - 1)] }
      Set-Content -LiteralPath $sshCfg -Value $new -Encoding ASCII
      Write-Ok "added RemoteForward $Port to the '$SshHost' entry in ~/.ssh/config"
    }
  }
  Write-Warn2 "reconnect the SSH window — the tunnel is created when the connection is made, a window reload is not enough"
} else {
  Write-Warn2 "no -SshHost given: add this to ~/.ssh/config under your host yourself"
  Write-Host  "         RemoteForward $Port localhost:$Port"
}

# ------------------------------------------------------------------- verify
Write-Host ""
Write-Host "Checking..." -ForegroundColor Cyan
& cmd /c "`"$CmdPath`"" | Out-Null
$ok = $false
foreach ($i in 1..12) { Start-Sleep -Seconds 1; if (Test-DebugPort $Port) { $ok = $true; break } }

if ($ok) {
  Write-Ok "Chrome answers on http://localhost:$Port — this machine is ready"
  Write-Host ""
  Write-Host "Next: reconnect your SSH window, then press Open browser in DaVinchi." -ForegroundColor Cyan
} else {
  Write-Fail "Chrome did not answer on http://localhost:$Port"
  Write-Host  "        Run $CmdPath manually and check that a Chrome window opens." -ForegroundColor Yellow
  exit 1
}

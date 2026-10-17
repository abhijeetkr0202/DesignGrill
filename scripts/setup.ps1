# One-step setup for DesignGrill on Windows 10/11.
# Checks the tools the desktop app needs, installs what is missing after asking (using winget),
# then installs the npm dependencies and verifies that Cargo can read the project.
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1              check and install
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -CheckOnly   only report; change nothing
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -Yes         do not ask before installing
#Requires -Version 5.1
param(
  [switch]$CheckOnly,
  [switch]$Yes
)

# Native tools write progress to stderr; errors are detected through exit codes instead.
$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$MinRust = [version]'1.90'
$Problems = 0
$Installed = $false

function Say($text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "  [ok]      $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  [warn]    $text" -ForegroundColor Yellow }
function Missing($text) { Write-Host "  [missing] $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "  [failed]  $text" -ForegroundColor Red; $script:Problems++ }
function Have($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Confirm-Step($text) {
  if ($CheckOnly) { return $false }
  if ($Yes) { return $true }
  $reply = Read-Host "  $text [Y/n]"
  return ($reply -eq '' -or $reply -match '^[Yy]')
}

# Installers update the registry PATH; this session only sees it after a refresh.
function Update-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user;$env:USERPROFILE\.cargo\bin"
}

function Install-WithWinget($id, [string[]]$extra = @()) {
  if (-not (Have 'winget')) {
    throw "winget is not available. Install 'App Installer' from the Microsoft Store, or install $id manually."
  }
  & winget install --id $id --exact --accept-package-agreements --accept-source-agreements @extra
  if ($LASTEXITCODE -ne 0) { throw "winget could not install $id (exit code $LASTEXITCODE)." }
  $script:Installed = $true
  Update-SessionPath
}

function Get-NodeVersion {
  if (-not (Have 'node') -or -not (Have 'npm')) { return $null }
  $text = (& node -v).Trim().TrimStart('v')
  return [version]$text
}

function Test-NodeOk($v) {
  if (-not $v) { return $false }
  return (($v.Major -eq 20 -and $v -ge [version]'20.19') -or ($v.Major -ge 22 -and $v -ge [version]'22.12'))
}

function Get-RustVersion {
  if (-not (Have 'cargo') -or -not (Have 'rustc')) { return $null }
  $out = & rustc --version 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $out) { return $null }
  return [version](($out -split ' ')[1] -replace '-.*$', '')
}

function Test-BuildTools {
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  if (-not (Test-Path $vswhere)) { return $false }
  $path = & $vswhere -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  return [bool]$path
}

function Test-WebView2 {
  $guid = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
  foreach ($key in @(
      "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$guid",
      "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$guid",
      "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$guid")) {
    if (Test-Path $key) { return $true }
  }
  return $false
}

Write-Host "DesignGrill setup ($(if ($CheckOnly) { 'check only' } else { 'check and install' }))"
Update-SessionPath

# --- C++ build tools -------------------------------------------------------------------------
Say 'Microsoft C++ Build Tools (compiler and linker for Rust)'
if (Test-BuildTools) {
  Ok 'Visual Studio Build Tools with the C++ workload'
} else {
  Missing 'Visual Studio Build Tools with the C++ workload'
  if (Confirm-Step 'Install them with winget? This is a large download and asks for administrator approval.') {
    try {
      Install-WithWinget 'Microsoft.VisualStudio.2022.BuildTools' @(
        '--override', '--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended')
    } catch { Fail $_.Exception.Message }
  }
  if (Test-BuildTools) { Ok 'Visual Studio Build Tools' } elseif ($CheckOnly) { $Problems++ } else { Fail 'C++ Build Tools are still not available' }
}

# --- WebView2 --------------------------------------------------------------------------------
Say 'Microsoft Edge WebView2 runtime (renders the app window)'
if (Test-WebView2) {
  Ok 'WebView2 runtime'
} else {
  Missing 'WebView2 runtime'
  if (Confirm-Step 'Install it with winget?') {
    try { Install-WithWinget 'Microsoft.EdgeWebView2Runtime' } catch { Fail $_.Exception.Message }
  }
  if (Test-WebView2) { Ok 'WebView2 runtime' } elseif ($CheckOnly) { $Problems++ } else { Fail 'WebView2 is still not available' }
}

# --- Node.js ---------------------------------------------------------------------------------
Say 'Node.js (needs 20.19+ or 22.12+)'
$node = Get-NodeVersion
if (Test-NodeOk $node) {
  Ok "Node v$node"
} else {
  if ($node) { Warn "Node v$node is too old" } else { Missing 'Node.js' }
  if (Confirm-Step 'Install Node.js LTS with winget?') {
    try { Install-WithWinget 'OpenJS.NodeJS.LTS' } catch { Fail $_.Exception.Message }
  }
  $node = Get-NodeVersion
  if (Test-NodeOk $node) { Ok "Node v$node" } elseif ($CheckOnly) { $Problems++ } else { Fail 'Node.js 20.19+ or 22.12+ is still not available' }
}

# --- Rust ------------------------------------------------------------------------------------
Say "Rust (needs $MinRust or newer; provides cargo)"
$rust = Get-RustVersion
if ($rust -and $rust -ge $MinRust) {
  Ok "Rust $rust with cargo"
} else {
  if ($rust) { Warn "Rust $rust is older than $MinRust" } else { Missing 'Rust toolchain (cargo not found)' }
  if (Confirm-Step 'Install or update Rust with rustup?') {
    try {
      if (Have 'rustup') {
        & rustup toolchain install stable-msvc --profile minimal
        & rustup default stable-msvc
        $script:Installed = $true
      } else {
        Install-WithWinget 'Rustlang.Rustup'
        & rustup default stable-msvc
      }
      Update-SessionPath
    } catch { Fail $_.Exception.Message }
  }
  $rust = Get-RustVersion
  if ($rust -and $rust -ge $MinRust) { Ok "Rust $rust with cargo" } elseif ($CheckOnly) { $Problems++ } else { Fail "Rust $MinRust or newer is still not available" }
}

# --- Project dependencies --------------------------------------------------------------------
Say 'Project dependencies'
if ($CheckOnly) {
  if (Test-Path (Join-Path $RepoRoot 'node_modules')) { Ok 'node_modules present' } else { Missing 'node_modules (run npm install)'; $Problems++ }
} elseif (Test-NodeOk (Get-NodeVersion)) {
  Push-Location $RepoRoot
  try {
    & npm install
    if ($LASTEXITCODE -eq 0) { Ok 'npm packages installed' } else { Fail 'npm install failed' }
  } finally { Pop-Location }
} else {
  Fail 'Skipped npm install because Node.js is not ready'
}

# --- Final check -----------------------------------------------------------------------------
Say 'Checking that Cargo can read the project'
$rust = Get-RustVersion
if (-not ($rust -and $rust -ge $MinRust)) {
  if ($CheckOnly) { Warn 'Skipped: Rust is not ready' } else { Fail 'Skipped: Rust is not ready' }
} else {
  # The call that `tauri dev` makes first; it fails with "No such file or directory" when cargo is not on PATH.
  & cargo metadata --no-deps --format-version 1 --manifest-path (Join-Path $RepoRoot 'src-tauri\Cargo.toml') *> $null
  if ($LASTEXITCODE -eq 0) { Ok 'cargo metadata works' } else { Fail 'cargo could not read src-tauri\Cargo.toml' }
}

Write-Host ""
if ($Problems -gt 0) {
  if ($CheckOnly) {
    Write-Host "$Problems item(s) need attention. Run without -CheckOnly to install what is missing."
  } else {
    Write-Host "Setup finished with $Problems problem(s). Fix the items marked [failed] above and run it again."
  }
  exit 1
}

Write-Host 'All set.' -ForegroundColor Green
if ($Installed) {
  Write-Host 'Tools were just installed. Open a NEW terminal window before the next step so they are on your PATH.'
}
Write-Host ''
Write-Host 'Start the desktop app with:  npm run dev:desktop'
Write-Host 'The first launch compiles the Rust side and can take several minutes.'

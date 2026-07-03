# Read-only verification of the current Oryven installation on Windows.
# Robust against quoted registry values: .Trim('"') + .Replace('"', '') (STRING-typed, not [char]).
# Pass `-TargetVersion 'x.y.z'` to override the expected version. Otherwise we
# read it from the project's package.json, which is the single source of truth.
#
# NOTE: This verifier is for the *current* install. It is intentionally
# Oryven-only. For detecting an old Stride install on a machine that's mid-
# migration or hasn't run install-v0.4.0.ps1 yet, use scripts/detect-legacy-install.ps1
# (a renamed alias for the historical detect-stride-install.ps1).

[CmdletBinding()]
param(
    [string]$TargetVersion
)

$ErrorActionPreference = "Stop"

if (-not $TargetVersion) {
    # Read the expected version from package.json so this verifier never goes
    # stale. parse the JSON by hand to avoid pulling in a ConvertFrom-Json dep.
    $pkgJson = Get-Content -Raw -Path (Join-Path (Split-Path -Parent $PSScriptRoot) "package.json")
    $match = [regex]::Match($pkgJson, '"version"\s*:\s*"([^"]+)"')
    if ($match.Success) {
        $TargetVersion = $match.Groups[1].Value
        Write-Host ("[verify] TargetVersion={0} (from package.json)" -f $TargetVersion)
    } else {
        Write-Host "WARN=no_TargetVersion_resolved_defaulting_to_0.4.0"
        $TargetVersion = "0.4.0"
    }
}

function Get-InstallStatus {
    param([string]$RegistryRoot)

    if (-not (Test-Path $RegistryRoot)) { return $null }
    $candidates = Get-ChildItem -Path $RegistryRoot -ErrorAction SilentlyContinue
    foreach ($key in $candidates) {
        $reg = Get-ItemProperty -Path $key.PSPath -ErrorAction SilentlyContinue
        if ($reg -and $reg.DisplayName -and ($reg.DisplayName -match '(?i)^oryven(\s|$)')) {
            return $reg
        }
    }
    return $null
}

# Comprehensive registry scan (per-user + per-machine, both 64-bit and 32-bit views)
$roots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKCU:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
)

$reg = $null
foreach ($r in $roots) {
    $found = Get-InstallStatus -RegistryRoot $r
    if ($found) {
        Write-Host ("[registry] {0} -> {1}" -f $r, $found.PSPath)
        if (-not $reg) { $reg = $found }
    }
}

if (-not $reg) {
    Write-Host "RESULT=no_install_found"
    exit 1
}

# Normalize every quoted path we read from the registry
# String.Replace takes STRINGS, not chars. Earlier version used [char] which threw.
$displayVersion = ([string]$reg.DisplayVersion).Trim().Trim('"').Trim("'")
$installLocation = ([string]$reg.InstallLocation).Trim().Trim('"').Trim("'").Replace('"', '').Replace("'", '')

# Validate the install path is sane (defends against malformed registry values)
if ($installLocation -and $installLocation -ne '') {
    try {
        $installLocation = [System.IO.Path]::GetFullPath($installLocation)
    } catch {
        Write-Host ("WARN=invalid_install_location path={0} err={1}" -f $installLocation, $_.Exception.Message)
        $installLocation = $null
    }
}

Write-Host ("DisplayVersion={0}" -f $displayVersion)
Write-Host ("InstallLocation={0}" -f $installLocation)
Write-Host ("DisplayName={0}" -f ([string]$reg.DisplayName).Trim().Trim('"'))
Write-Host ("Publisher={0}" -f ([string]$reg.Publisher).Trim().Trim('"'))

# Binary presence check (try both possible names; Tauri 2 typically uses bundle id)
$binaryCandidates = @('app.oryven.desktop.exe', 'oryven.exe')
$binaryFound = $null
if ($installLocation -and (Test-Path $installLocation)) {
    foreach ($bin in $binaryCandidates) {
        $candidate = Join-Path $installLocation $bin
        if (Test-Path $candidate) {
            $file = Get-Item -Path $candidate
            Write-Host ("BINARY_FOUND={0} size={1} version={2}" -f $candidate, $file.Length, $file.VersionInfo.FileVersion)
            if (-not $binaryFound) { $binaryFound = $candidate }
        }
    }
} else {
    Write-Host "INSTALL_DIR_MISSING"
}

# Any running process?
Get-Process -Name 'oryven', 'app.oryven.desktop' -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host ("RUNNING_PID={0} path={1}" -f $_.Id, $_.Path) }

# Sanity: state.json at the renamed path?
$expectedStatePath = Join-Path $env:APPDATA "app.oryven.desktop\state.json"
$stateJsonOk = $false
if (Test-Path $expectedStatePath) {
    $stateFile = Get-Item $expectedStatePath
    if ($stateFile.Length -gt 0) {
        Write-Host ("STATE_JSON={0} size={1} mtime={2:o}" -f $expectedStatePath, $stateFile.Length, $stateFile.LastWriteTimeUtc)
        $stateJsonOk = $true
    } else {
        Write-Host ("STATE_JSON_EMPTY size=0 - migration likely failed" -f $expectedStatePath)
    }
} else {
    Write-Host ("STATE_JSON_MISSING expected_at={0}" -f $expectedStatePath)
}

# Verdict. A healthy install must satisfy ALL THREE:
#   (a) registry DisplayVersion matches target,
#   (b) the binary is on disk in the install dir,
#   (c) state.json exists at the renamed path AND is non-empty (so the user's
#       tasks round-tripped through the v0.3.x -> v0.4.0 state migration).
# A missing or empty state.json is treated as a hard failure: the user would
# land on an empty app without their seeded tasks, projects, or labels.
if ($displayVersion -eq $TargetVersion -and $binaryFound -and $stateJsonOk) {
    Write-Host ("RESULT=installed_and_verified target={0}" -f $TargetVersion)
    exit 0
} elseif ($displayVersion -eq $TargetVersion -and $binaryFound -and (-not $stateJsonOk)) {
    Write-Host ("RESULT=installed_but_state_json_missing_or_empty target={0}" -f $TargetVersion)
    exit 1
} elseif ($displayVersion -eq $TargetVersion) {
    Write-Host ("RESULT=registered_target_version_but_binary_missing target={0}" -f $TargetVersion)
    exit 1
} elseif ($displayVersion -and $displayVersion -ne '') {
    Write-Host ("RESULT=other_version_present installed={0} target={1}" -f $displayVersion, $TargetVersion)
    exit 1
} else {
    Write-Host "RESULT=no_install_found"
    exit 1
}

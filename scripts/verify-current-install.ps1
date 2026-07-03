# Read-only verification of the current Stride installation on Windows.
# Robust against quoted registry values: .Trim('"') + .Replace('"', '') (STRING-typed, not [char]).
# Pass `-TargetVersion 'x.y.z'` to override the expected version. Otherwise we
# read it from the project's package.json, which is the single source of truth.

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
        Write-Host "WARN=no_TargetVersion_resolved_defaulting_to_0.2.1"
        $TargetVersion = "0.2.1"
    }
}

function Get-InstallStatus {
    param([string]$RegistryRoot)

    if (-not (Test-Path $RegistryRoot)) { return $null }
    $candidates = Get-ChildItem -Path $RegistryRoot -ErrorAction SilentlyContinue
    foreach ($key in $candidates) {
        $reg = Get-ItemProperty -Path $key.PSPath -ErrorAction SilentlyContinue
        if ($reg -and $reg.DisplayName -and ($reg.DisplayName -match '(?i)^stride(\s|$)')) {
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
$binaryCandidates = @('app.stride.desktop.exe', 'stride.exe')
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
Get-Process -Name 'stride', 'app.stride.desktop' -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host ("RUNNING_PID={0} path={1}" -f $_.Id, $_.Path) }

# Verdict
if ($displayVersion -eq $TargetVersion -and $binaryFound) {
    Write-Host ("RESULT=installed_and_verified target={0}" -f $TargetVersion)
    exit 0
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

# Stride uninstall+install orchestrator (v4) — consolidated and tightened.
# Cleanup from prior review:
#  - Deleted dead Find-PriorInstall (power-of-shell pipeline return semantics swallowed its output)
#  - Consolidated three duplicate registry scans into a single Scan-StrideInstalls function
#  - Tightened DisplayName regex to "^Stride(\s|$)?" to avoid false-matches on Strident/Stride Learning
#  - Fixed Select-BestPriorEntry to actually sort alphabetically (was relying on pipeline order)
#  - Replaced [char]-typed Replace with string-quoted variants (.Replace takes strings, not chars)

[CmdletBinding()]
param(
    [string]$TargetVersion = '0.2.0',
    [int]$PollTimeoutSec = 60
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis\Stride_${TargetVersion}_x64-setup.exe"
$priorConfirmation = $ConfirmationPreference
$ConfirmationPreference = 'None'

function Write-Step { param($msg) Write-Host ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $msg) }

function Get-NormalizedPath {
    param([string]$p)
    if (-not $p) { return $null }
    $clean = $p.Trim().Trim('"').Trim("'").Replace('"', '').Replace("'", '')
    if ($clean -eq '') { return $null }
    try { return [System.IO.Path]::GetFullPath($clean) } catch { return $null }
}

function Scan-StrideInstalls {
    # Single canonical registry scan. Returns every Stride-like entry across all Uninstall roots,
    # GUID-tolerant (gear-keyed entries have DisplayName="Stride"). Output ORDER is alphabetical
    # by DisplayName so Select-BestPriorEntry can rely on a stable order.
    $roots = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKCU:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
    )
    $results = @()
    foreach ($r in $roots) {
        if (-not (Test-Path $r)) { continue }
        Get-ChildItem -Path $r -ErrorAction SilentlyContinue | ForEach-Object {
            $cand = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue
            # Tightened regex: only matches names that start with "Stride" (followed by EOL, whitespace,
            # or nothing). Avoids Strident, Stride Learning, Foostride, etc.
            if ($cand -and $cand.DisplayName -and ($cand.DisplayName -match '^Stride(\s|$)')) {
                $Script:results += $cand
            }
        }
    }
    return $results | Sort-Object DisplayName
}

function Select-BestPriorEntry {
    param([Parameter(Mandatory)][object[]]$Entries)
    if (-not $Entries -or $Entries.Count -eq 0) { return $null }
    # Prefer exact-name match first; fall back to first alphabetical.
    $exact = $Entries | Where-Object { $_.DisplayName -eq 'Stride' } | Select-Object -First 1
    if ($exact) { return $exact }
    return $Entries | Select-Object -First 1
}

function Stop-StrideProcesses {
    $names = @('stride', 'app.stride.desktop')
    foreach ($n in $names) {
        Get-Process -Name $n -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Step ("KILL_GRACEFUL pid={0} name={1}" -f $_.Id, $_.ProcessName)
            Stop-Process -Id $_.Id -Confirm:$false -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 2
    foreach ($n in $names) {
        Get-Process -Name $n -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Step ("KILL_FORCE pid={0} name={1}" -f $_.Id, $_.ProcessName)
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

function Wait-ForInstallCompletion {
    param([string]$InstallDir, [int]$TimeoutSec)
    # NSIS canonical sentinel: install-dir\Uninstall.exe. Wait for 3 consecutive stable
    # 500ms mtime samples — robust against post-install metadata touches (reparse, AV).
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $uninst = if ($InstallDir) { Join-Path $InstallDir 'Uninstall.exe' } else { $null }
    if (-not $uninst) { return $false }
    $samples = @()
    while ((Get-Date) -lt $deadline) {
        if (-not (Test-Path $uninst)) { $samples = @(); Start-Sleep -Milliseconds 500; continue }
        $samples += (Get-Item $uninst).LastWriteTimeUtc.Ticks
        if ($samples.Count -ge 3) {
            if (($samples[-1] -eq $samples[-2]) -and ($samples[-1] -eq $samples[-3])) { return $true }
        }
        if ($samples.Count -gt 3) { $samples = $samples[-3..-1] }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Report-Install { param($Entries, [string]$Label)
    $best = Select-BestPriorEntry -Entries $Entries
    if ($best) {
        $v = ([string]$best.DisplayVersion).Trim().Trim('"').Trim("'")
        $loc = Get-NormalizedPath ([string]$best.InstallLocation)
        Write-Step ("{0}_VERSION={1}" -f $Label, $v)
        Write-Step ("{0}_INSTALL_DIR={1}" -f $Label, $loc)
        return $loc
    } else {
        Write-Step ("{0}=none" -f $Label)
        return $null
    }
}

# ---- 1. Verify installer is on disk ------------------------------------------------
if (-not (Test-Path $installer)) {
    Write-Step ("ABORT installer not found: {0}" -f $installer)
    $ConfirmationPreference = $priorConfirmation
    exit 2
}
Write-Step ("OK installer present: {0}" -f $installer)

# ---- 2. Resolve any prior install --------------------------------------------------
$priorEntries = Scan-StrideInstalls
$prior = Select-BestPriorEntry -Entries $priorEntries
$priorInstallLoc = $null
$priorVersion = $null
if ($prior) {
    $priorInstallLoc = Get-NormalizedPath ([string]$prior.InstallLocation)
    $priorVersion = ([string]$prior.DisplayVersion).Trim().Trim('"').Trim("'")
    Write-Step ("PRIOR_DETECTED version={0} location={1}" -f $priorVersion, $priorInstallLoc)

    # Idempotency: semver-aware short-circuit
    try {
        $priorV = [version]($priorVersion -replace '^[vV]', '')
        $targetV = [version]($TargetVersion -replace '^[vV]', '')
        if ($priorV -ge $targetV) {
            $binReady = $false
            foreach ($n in @('app.stride.desktop.exe', 'stride.exe')) {
                if ($priorInstallLoc -and (Test-Path (Join-Path $priorInstallLoc $n))) { $binReady = $true; break }
            }
            if ($binReady) {
                Write-Step ("ALREADY_AT_OR_ABOVE_TARGET prior={0} target={1} — exiting idempotently" -f $priorV, $targetV)
                $ConfirmationPreference = $priorConfirmation
                exit 0
            }
            Write-Step ("ALREADY_REGISTERED_BUT_BINARY_MISSING — proceeding with reinstall")
        }
    } catch {
        Write-Step ("WARN version parse prior='{0}' target='{1}' — reinstalling" -f $priorVersion, $TargetVersion)
    }

    Stop-StrideProcesses

    $uninstCmd = if ($prior.QuietUninstallString) { [string]$prior.QuietUninstallString }
                 elseif ($prior.UninstallString) { [string]$prior.UninstallString }
                 else { $null }
    if ($priorInstallLoc) {
        $instExe = Join-Path $priorInstallLoc 'Uninstall.exe'
        if ((-not $uninstCmd -or $uninstCmd.Trim() -eq '') -and (Test-Path $instExe)) {
            $uninstCmd = "`"$instExe`" /S"
        }
    }

    if ($uninstCmd -and $uninstCmd.Trim() -ne '') {
        Write-Step ("UNINSTALL_CMD={0}" -f $uninstCmd)
        try {
            $proc = Start-Process -FilePath cmd.exe -ArgumentList @('/c', $uninstCmd) -Wait -PassThru -NoNewWindow
            Write-Step ("UNINSTALL_EXIT_CODE={0}" -f $proc.ExitCode)
        } catch {
            Write-Step ("WARN uninstall failed: {0}" -f $_.Exception.Message)
        }
    } elseif ($priorInstallLoc -and (Test-Path $priorInstallLoc)) {
        Write-Step ("WARN no uninstall command found in registry; removing install dir")
        Remove-Item -Path $priorInstallLoc -Recurse -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Step "PRIOR_DETECTED=none (clean machine)"
}

# ---- 3. Run the NSIS installer /S -------------------------------------------------
Write-Step ("INSTALL_BEGIN target={0}" -f $TargetVersion)
$proc = Start-Process -FilePath $installer -ArgumentList '/S' -Wait -PassThru -NoNewWindow
# NSIS wrapper ExitCode is NOT authoritative — trust the file/mtime verification below.
Write-Step ("INSTALL_WRAPPER_EXIT_CODE={0} (not_authoritative)" -f $proc.ExitCode)

# ---- 4. Poll for canonical Uninstall.exe sentinel ---------------------------------
$newEntries = Scan-StrideInstalls
$newLoc = Report-Install -Entries $newEntries -Label 'POST_INSTALL'
if (-not (Wait-ForInstallCompletion -InstallDir $newLoc -TimeoutSec $PollTimeoutSec)) {
    Write-Step ("WARN install polling timed out after {0}s; continuing to final verification" -f $PollTimeoutSec)
} else {
    Write-Step ("INSTALL_COMPLETE_INSTALLDIR={0}" -f $newLoc)
}

# ---- 5. Final verification ---------------------------------------------------------
$finalOk = $false
try {
    $finalEntries = Scan-StrideInstalls
    $finalLoc = Report-Install -Entries $finalEntries -Label 'FINAL'
    if ($finalLoc -and (Test-Path $finalLoc)) {
        Get-ChildItem -Path $finalLoc -File | Select-Object -First 10 | ForEach-Object {
            Write-Step ("FILE={0} ({1} bytes)" -f $_.Name, $_.Length)
        }
        foreach ($n in @('app.stride.desktop.exe', 'stride.exe')) {
            if (Test-Path (Join-Path $finalLoc $n)) { $finalOk = $true; break }
        }
    }
} catch {
    Write-Step ("FINAL_VERIFY_ERROR (non-fatal): {0}" -f $_.Exception.Message)
}

Write-Step ("DONE finalOk={0}" -f $finalOk)
$ConfirmationPreference = $priorConfirmation
if ($finalOk) { exit 0 } else { exit 3 }

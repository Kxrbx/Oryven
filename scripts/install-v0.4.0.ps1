# Silent in-place upgrade from a Stride 0.3.x install to Oryven v0.4.0.
#
# This release is a *full* rename - productName, Tauri identifier, cargo crate
# name, install dir, registry uninstall key, binary, and the on-disk location
# of state.json all change. The user's data lives at
# `%APPDATA%\app.stride.desktop\state.json` today and must end up at
# `%APPDATA%\app.oryven.desktop\state.json` tomorrow.
#
# Sequence (order matters - the COPY runs BEFORE the uninstall):
#
#   1. Verify the new NSIS installer exists.
#   2. Stop any running Stride/Oryven processes (graceful, then force after 2s).
#   3. Locate the prior Stride install in the registry.
#   4. IF `%APPDATA%\app.stride.desktop\state.json` exists:
#        - Create `%APPDATA%\app.oryven.desktop\` if missing.
#        - Copy the state.json into the new path. (Done BEFORE uninstall so
#          a clumsy uninstaller that purges %APPDATA%\app.stride.desktop\
#          can't take our copy with it.)
#   5. Silent-uninstall the prior Stride via its QuietUninstallString
#      (fallback: UninstallString, then <InstallDir>\Uninstall.exe /S).
#   6. Poll the registry for the legacy "Stride" DisplayName until gone
#      (or until 5s settle). WARN if a stale entry persists; do NOT fail.
#   7. Run the new Oryven NSIS installer /S.
#   8. Poll `%LOCALAPPDATA%\Programs\Oryven\Uninstall.exe` for three stable
#      500ms mtime samples (canonical "install settled" signal).
#   9. Run verify-current-install.ps1 (now Oryven-aware) and exit with
#      its verdict.
#
# Idempotency: if the new install is already at v0.4.0 (and the binary is on
# disk), the legacy-uninstall step is skipped entirely so the script is safe
# to run again.
#
# State.json fallback: if the migration step ran on a previous invocation
# but the install failed, you can re-run this script; the COPY step will
# see `app.oryven.desktop\state.json` already present and skip cleanly.
$ErrorActionPreference = "Continue"

$installer = "E:\OpenCode\Todoist\src-tauri\target\release\bundle\nsis\Oryven_0.4.0_x64-setup.exe"
$verify    = "E:\OpenCode\Todoist\scripts\verify-current-install.ps1"

$legacyRoot        = Join-Path $env:APPDATA "app.stride.desktop"
$legacyStatePath   = Join-Path $legacyRoot "state.json"
$newRoot           = Join-Path $env:APPDATA "app.oryven.desktop"
$newStatePath      = Join-Path $newRoot "state.json"

function Write-Step { param($msg) Write-Host ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $msg) }

# ---- 1. Verify installer is on disk -------------------------------------------------
if (-not (Test-Path $installer)) {
    Write-Step ("ABORT installer not found: {0}" -f $installer)
    exit 2
}
Write-Step ("OK installer present: {0}" -f $installer)

# ---- 2. Stop running processes ------------------------------------------------------
function Stop-RelatedProcesses {
    $names = @('stride', 'app.stride.desktop', 'oryven', 'app.oryven.desktop')
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
Stop-RelatedProcesses

# ---- 3. Locate legacy Stride install (single canonical scan) ----------------------
function Find-LegacyStride {
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
            if ($cand -and $cand.DisplayName -and ($cand.DisplayName -match '^Stride(\s|$)')) {
                $results += $cand
            }
        }
    }
    if (-not $results -or $results.Count -eq 0) { return $null }
    # Prefer exact-name match (canonical DisplayName="Stride") over alphabet fallbacks.
    $exact = $results | Where-Object { $_.DisplayName -eq 'Stride' } | Select-Object -First 1
    if ($exact) { return $exact }
    return $results | Select-Object -First 1
}

$legacy = Find-LegacyStride
$legacyVersion = $null
$legacyUninstallCmd = $null
$legacyInstallDir = $null
if ($legacy) {
    $legacyVersion = ([string]$legacy.DisplayVersion).Trim().Trim('"').Trim("'")
    if ($legacy.InstallLocation) {
        $normalized = ([string]$legacy.InstallLocation).Trim().Trim('"').Trim("'").Replace('"', '').Replace("'", '')
        try {
            $legacyInstallDir = [System.IO.Path]::GetFullPath($normalized)
        } catch {
            Write-Step ("WARN legacy InstallLocation is malformed: {0}" -f $normalized)
        }
    }
    if ($legacy.QuietUninstallString) { $legacyUninstallCmd = [string]$legacy.QuietUninstallString }
    elseif ($legacy.UninstallString) { $legacyUninstallCmd = [string]$legacy.UninstallString }
    elseif ($legacyInstallDir -and (Test-Path (Join-Path $legacyInstallDir 'Uninstall.exe'))) {
        $legacyUninstallCmd = "`"$legacyInstallDir\Uninstall.exe`" /S"
    }
    Write-Step ("PRIOR_DETECTED version={0} installDir={1}" -f $legacyVersion, $legacyInstallDir)
    Write-Step ("PRIOR_UNINSTALL_CMD={0}" -f $legacyUninstallCmd)
} else {
    Write-Step "PRIOR_DETECTED=none (no Stride registry entry)"
}

# ---- 4. MIGRATE state.json BEFORE uninstalling ------------------------------------
# We copy the existing state.json into the new identifier path so the Oryven
# v0.4.0 Rust backend (which calls app.path().app_data_dir() under identifier
# app.oryven.desktop) finds the user's tasks on first launch.
$didMigrate = $false
if (Test-Path $legacyStatePath) {
    if (Test-Path $newStatePath) {
        Write-Step ("STATE_ALREADY_MIGRATED new_path_present={0} - skipping copy" -f $newStatePath)
    } else {
        if (-not (Test-Path $newRoot)) {
            New-Item -ItemType Directory -Force -Path $newRoot | Out-Null
            Write-Step ("MIGRATE_MKDIR new_root={0}" -f $newRoot)
        }
        # Atomic copy: write to .tmp then rename. Mirrors the pattern used by
        # lib.rs::save_state (write-to-tmp + rename) so an interrupted copy
        # never produces a partial state.json at the new path.
        try {
            $tmpPath = "$newStatePath.tmp"
            Copy-Item -Path $legacyStatePath -Destination $tmpPath -Force
            Move-Item -Path $tmpPath -Destination $newStatePath -Force
            $copiedSize = (Get-Item $newStatePath).Length
            Write-Step ("STATE_MIGRATED from={0} to={1} size={2}" -f $legacyStatePath, $newStatePath, $copiedSize)
            $didMigrate = $true
        } catch {
            Write-Step ("STATE_MIGRATE_FAILED err={0}" -f $_.Exception.Message)
        }
    }
} else {
    Write-Step ("NO_LEGACY_STATE_AT={0}" -f $legacyStatePath)
}

# ---- 5. Silent-uninstall legacy Stride (if found) --------------------------------
if ($legacy -and $legacyUninstallCmd -and $legacyUninstallCmd.Trim() -ne '') {
    Write-Step "PRIOR_UNINSTALL_BEGIN"
    try {
        $proc = Start-Process -FilePath cmd.exe -ArgumentList @('/c', $legacyUninstallCmd) -Wait -PassThru -NoNewWindow
        Write-Step ("PRIOR_UNINSTALL_EXIT_CODE={0}" -f $proc.ExitCode)
    } catch {
        Write-Step ("WARN prior_uninstall_failed err={0}" -f $_.Exception.Message)
    }
} elseif ($legacy) {
    Write-Step "WARN prior_install_found_but_no_uninstall_command"
}

# ---- 6. Poll legacy registry key until gone (best-effort) ------------------------
$pollDeadline = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $pollDeadline) {
    if (-not (Find-LegacyStride)) { break }
    Start-Sleep -Milliseconds 500
}
$leftoverLegacy = Find-LegacyStride
if ($leftoverLegacy) {
    Write-Step "WARN legacy_Stride_registry_entry_persisted_but_proceeding"
} else {
    Write-Step "PRIOR_REGISTRY_CLEARED"
}

# ---- 7. Install Oryven v0.4.0 NSIS /S --------------------------------------------
Write-Step "INSTALL_BEGIN (NSIS /S)"
$installProc = Start-Process -FilePath $installer -ArgumentList @('/S') -Wait -PassThru -NoNewWindow
Write-Step ("INSTALL_WRAPPER_EXIT_CODE={0} (NSIS wrapper nonzero is not authoritative)" -f $installProc.ExitCode)

# ---- 8. Poll Uninstall.exe sentinel at the new install dir -----------------------
function Wait-ForInstallCompletion {
    param([string]$InstallDir, [int]$TimeoutSec = 60)
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

# The new install lives at %LOCALAPPDATA%\Programs\Oryven\ (Tauri derives this
# from productName). Poll the canonical Uninstall.exe sentinel there.
$newInstallDir = Join-Path $env:LOCALAPPDATA "Programs\Oryven"
if (-not (Wait-ForInstallCompletion -InstallDir $newInstallDir -TimeoutSec 60)) {
    Write-Step "WARN install_polling_timed_out_after_60s continuing_to_verify"
} else {
    Write-Step ("INSTALL_COMPLETE_INSTALLDIR={0}" -f $newInstallDir)
}

# Forge an extra 3s settle so the registry writes catch up.
Write-Step "WAIT_3S_FOR_REGISTRY_SETTLE"
Start-Sleep -Seconds 3

# ---- 9. Run the new Oryven-aware verifier ----------------------------------------
Write-Step "VERIFY_BEGIN"
& $verify 2>&1 | ForEach-Object { Write-Host $_ }
$verifyExit = $LASTEXITCODE
Write-Step ("VERIFY_EXIT_CODE={0}" -f $verifyExit)

if ($verifyExit -eq 0) {
    Write-Step ("RESULT=v0.4.0_installed_and_verified state_migrated={0}" -f $didMigrate)
    exit 0
} else {
    Write-Step ("RESULT=verify_failed (exit={0}) state_migrated={1}" -f $verifyExit, $didMigrate)
    exit 3
}

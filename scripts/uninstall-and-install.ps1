# Generic uninstall-then-install orchestrator for Oryven (v1+).
#
# This supersedes the versioned install-v0.4.0.ps1 once v0.4.0+ is broadly
# in the wild. Behaviour is generic: it stops running processes, locates
# the prior Oryven install (if any), uninstalls it silently, runs the new
# NSIS installer /S, polls the new install's Uninstall.exe sentinel for
# settle, then runs verify-current-install.ps1.
#
# Parameters:
#   -TargetVersion <x.y.z>   Override the version to install (defaults to
#                            reading from package.json - the single source
#                            of truth for "what's the current version").
#   -SkipUninstall          Don't uninstall the prior version (use when
#                            you trust NSIS /S to overwrite in place).
#   -FreshInstall           Don't even scan for a prior install - assume
#                            a fresh machine. Skip uninstall silently.
#   -NoVerify               Skip the post-install verification call.
#
# Idempotent: running this on a machine that's already at $TargetVersion
# is a no-op (NSIS /S over a same-version install re-stamps the registry
# metadata but doesn't otherwise change anything, and verify-current-install
# passes).

[CmdletBinding()]
param(
    [string]$TargetVersion = '',
    [switch]$SkipUninstall,
    [switch]$FreshInstall,
    [switch]$NoVerify
)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent $PSScriptRoot
$verify      = Join-Path $projectRoot "scripts\verify-current-install.ps1"

function Write-Step { param($msg) Write-Host ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $msg) }

# ---- 1. Resolve target version --------------------------------------------------
if (-not $TargetVersion) {
    $pkgJson = Get-Content -Raw -Path (Join-Path $projectRoot "package.json")
    $match = [regex]::Match($pkgJson, '"version"\s*:\s*"([^"]+)"')
    if ($match.Success) {
        $TargetVersion = $match.Groups[1].Value
        Write-Step ("OK TargetVersion={0} (from package.json)" -f $TargetVersion)
    } else {
        Write-Step "ABORT no TargetVersion resolved (and package.json has no version)"
        exit 2
    }
}
$installer = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis\Oryven_${TargetVersion}_x64-setup.exe"

# ---- 2. Verify installer is on disk ----------------------------------------------
if (-not (Test-Path $installer)) {
    Write-Step ("ABORT installer not found: {0}" -f $installer)
    exit 2
}
Write-Step ("OK installer present: {0}" -f $installer)

# ---- 3. Stop running Oryven processes -------------------------------------------
function Stop-OryvenProcesses {
    $names = @('oryven', 'app.oryven.desktop')
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
Stop-OryvenProcesses

# ---- 4. Locate prior Oryven install (skip if -FreshInstall) ------------------
function Find-PriorOryven {
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
            if ($cand -and $cand.DisplayName -and ($cand.DisplayName -match '^oryven(\s|$)')) {
                $results += $cand
            }
        }
    }
    if (-not $results -or $results.Count -eq 0) { return $null }
    $exact = $results | Where-Object { $_.DisplayName -eq 'Oryven' } | Select-Object -First 1
    if ($exact) { return $exact }
    return $results | Select-Object -First 1
}

$prior = $null
$priorUninstallCmd = $null
$priorInstallDir = $null
if (-not $FreshInstall) {
    $prior = Find-PriorOryven
    if ($prior) {
        $priorVersion = ([string]$prior.DisplayVersion).Trim().Trim('"').Trim("'")
        if ($prior.InstallLocation) {
            $normalized = ([string]$prior.InstallLocation).Trim().Trim('"').Trim("'").Replace('"', '').Replace("'", '')
            try {
                $priorInstallDir = [System.IO.Path]::GetFullPath($normalized)
            } catch {
                Write-Step ("WARN prior InstallLocation is malformed: {0}" -f $normalized)
            }
        }
        if ($prior.QuietUninstallString) { $priorUninstallCmd = [string]$prior.QuietUninstallString }
        elseif ($prior.UninstallString)  { $priorUninstallCmd = [string]$prior.UninstallString }
        elseif ($priorInstallDir -and (Test-Path (Join-Path $priorInstallDir 'Uninstall.exe'))) {
            $priorUninstallCmd = "`"$priorInstallDir\Uninstall.exe`" /S"
        }
        Write-Step ("PRIOR_DETECTED version={0} installDir={1}" -f $priorVersion, $priorInstallDir)
        Write-Step ("PRIOR_UNINSTALL_CMD={0}" -f $priorUninstallCmd)

        # Idempotency: if the prior install is AT or ABOVE the target version AND the
        # binary is on disk, treat as no-op.
        try {
            $priorV = [version]($priorVersion -replace '^[vV]', '')
            $targetV = [version]($TargetVersion -replace '^[vV]', '')
            if ($priorV -ge $targetV) {
                $binReady = $false
                foreach ($n in @('app.oryven.desktop.exe', 'oryven.exe')) {
                    if ($priorInstallDir -and (Test-Path (Join-Path $priorInstallDir $n))) { $binReady = $true; break }
                }
                if ($binReady) {
                    Write-Step ("ALREADY_AT_OR_ABOVE_TARGET prior={0} target={1} - exiting idempotently" -f $priorV, $targetV)
                    exit 0
                }
            }
        } catch {
            Write-Step ("WARN version parse prior='{0}' target='{1}' - proceeding with reinstall" -f $priorVersion, $TargetVersion)
        }
    } else {
        Write-Step "PRIOR_DETECTED=none (clean machine or no Oryven registry entry)"
    }
}

# ---- 5. Uninstall prior (unless -SkipUninstall or -FreshInstall) -------------
if (-not $FreshInstall -and -not $SkipUninstall) {
    if ($prior -and $priorUninstallCmd -and $priorUninstallCmd.Trim() -ne '') {
        Write-Step "PRIOR_UNINSTALL_BEGIN"
        try {
            $proc = Start-Process -FilePath cmd.exe -ArgumentList @('/c', $priorUninstallCmd) -Wait -PassThru -NoNewWindow
            Write-Step ("PRIOR_UNINSTALL_EXIT_CODE={0}" -f $proc.ExitCode)
        } catch {
            Write-Step ("WARN prior_uninstall_failed err={0}" -f $_.Exception.Message)
        }
    } elseif ($priorInstallDir -and (Test-Path $priorInstallDir)) {
        Write-Step "WARN no uninstall command found in registry; removing install dir"
        Remove-Item -Path $priorInstallDir -Recurse -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Step "PRIOR_UNINSTALL_SKIPPED (FreshInstall or SkipUninstall)"
}

# ---- 6. Run NSIS /S silent install ---------------------------------------------
Write-Step ("INSTALL_BEGIN version={0}" -f $TargetVersion)
$installProc = Start-Process -FilePath $installer -ArgumentList @('/S') -Wait -PassThru -NoNewWindow
Write-Step ("INSTALL_WRAPPER_EXIT_CODE={0} (NSIS wrapper nonzero is not authoritative)" -f $installProc.ExitCode)

# ---- 7. Poll Uninstall.exe sentinel at InstallLocation -----------------------
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

# Tauri's NSIS installs at %LOCALAPPDATA%\Programs\Oryven\ in the v1+ era.
$newInstallDir = Join-Path $env:LOCALAPPDATA "Programs\Oryven"
if (-not (Wait-ForInstallCompletion -InstallDir $newInstallDir -TimeoutSec 60)) {
    Write-Step "WARN install_polling_timed_out_after_60s continuing_to_verify"
} else {
    Write-Step ("INSTALL_COMPLETE_INSTALLDIR={0}" -f $newInstallDir)
}

# Settle window: NSIS writes registry last, give the OS a moment.
Write-Step "WAIT_3S_FOR_REGISTRY_SETTLE"
Start-Sleep -Seconds 3

# ---- 8. Verify (unless -NoVerify) ---------------------------------------------
if (-not $NoVerify) {
    # ABORT early if the verifier isn't present - on a partial checkout, `& $verify`
    # produces nothing, $LASTEXITCODE is unset, and we'd misreport RESULT=verify_failed
    # with an exit 3 that has nothing to do with the actual install.
    if (-not (Test-Path $verify)) {
        Write-Step ("ABORT verifier missing: {0}" -f $verify)
        exit 4
    }
    Write-Step "VERIFY_BEGIN"
    & $verify 2>&1 | ForEach-Object { Write-Host $_ }
    $verifyExit = $LASTEXITCODE
    Write-Step ("VERIFY_EXIT_CODE={0}" -f $verifyExit)
    if ($verifyExit -eq 0) {
        Write-Step ("RESULT=installed_and_verified target={0}" -f $TargetVersion)
        exit 0
    } else {
        Write-Step ("RESULT=verify_failed (exit={0})" -f $verifyExit)
        exit 3
    }
} else {
    Write-Step ("NO_VERIFY_SKIPPED target={0}" -f $TargetVersion)
    exit 0
}

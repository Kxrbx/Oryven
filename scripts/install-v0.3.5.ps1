# Silent in-place upgrade from the prior installed version to v0.3.5 for Stride.
# Adds a native `title` hover preview to the TodayWidget button so users see
# the "N due \u00b7 M done \u00b7 K open" breakdown alongside the big-numeral pair.
# Pure UX polish; persisted state.json is preserved verbatim.
$ErrorActionPreference = "Continue"

$installer = "E:\OpenCode\Todoist\src-tauri\target\release\bundle\nsis\Stride_0.3.5_x64-setup.exe"
$verify    = "E:\OpenCode\Todoist\scripts\verify-current-install.ps1"

function Write-Step { param($msg) Write-Host ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $msg) }

if (-not (Test-Path $installer)) {
    Write-Step ("ABORT installer not found: {0}" -f $installer)
    exit 2
}
Write-Step ("OK installer present: {0}" -f $installer)

# Launch NSIS /S silent install and wait for it. NSIS /S returns the wrapper
# exit code, but the wrapper nonzero is *not* authoritative (real status comes
# from the registry after the install settles).
Write-Step "INSTALL_BEGIN (NSIS /S)"
$proc = Start-Process -FilePath $installer -ArgumentList @('/S') -Wait -PassThru -NoNewWindow
Write-Step ("INSTALL_WRAPPER_EXIT_CODE={0} (NSIS wrapper nonzero is not authoritative)" -f $proc.ExitCode)

# Settle window: NSIS writes registry last, give the OS a moment.
Write-Step "WAIT_5S_FOR_SETTLE"
Start-Sleep -Seconds 5

# Verify the install.
Write-Step "VERIFY_BEGIN"
& $verify 2>&1 | ForEach-Object { Write-Host $_ }
$verifyExit = $LASTEXITCODE
Write-Step ("VERIFY_EXIT_CODE={0}" -f $verifyExit)

if ($verifyExit -eq 0) {
    Write-Step "RESULT=v0.3.5_installed_and_verified"
    exit 0
} else {
    Write-Step ("RESULT=verify_failed (exit={0})" -f $verifyExit)
    exit 3
}

# Detect existing Oryven install on this machine. Read-only.
# Mirrors the (now-retired) detect-stride-install.ps1 but for Oryven.
# Use this to diagnose where Oryven is installed, what's in the registry,
# and whether anything is still running. No side effects, no registry writes.

$ErrorActionPreference = "Continue"
$oryvenFound = 0

Write-Host ""
Write-Host "=== Filesystem scan ==="
$roots = @(
  (Join-Path $env:LOCALAPPDATA "Programs"),
  $env:APPDATA,
  (Join-Path $env:USERPROFILE "Applications"),
  $env:ProgramFiles,
  ${env:ProgramFiles(x86)}
)
foreach ($r in $roots) {
  if (-not (Test-Path $r)) { continue }
  # Exact-name match on "Oryven" so unrelated apps like "Oryven Demo" or a
  # future "Oryven Cloud" don't false-match at the dir level. The registry
  # section below uses the same discipline.
  $oryvenDirs = Get-ChildItem -Path $r -Directory |
    Where-Object { $_.Name -eq 'Oryven' -or $_.Name -eq 'app.oryven.desktop' }
  foreach ($d in $oryvenDirs) {
    Write-Host "FOUND DIR: $($d.FullName)"
    $oryvenFound++
  }
  Get-ChildItem -Path $r -File -Recurse -Filter "oryven.exe" -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "FOUND EXE: $($_.FullName)" }
}

Write-Host ""
Write-Host "=== State file ==="
$statePath = Join-Path $env:APPDATA "app.oryven.desktop\state.json"
if (Test-Path $statePath) {
  $stateFile = Get-Item $statePath
  Write-Host ("STATE: {0} (size={1} bytes, mtime={2:o})" -f $statePath, $stateFile.Length, $stateFile.LastWriteTimeUtc)
} else {
  Write-Host "STATE: not found (expected on a clean machine; expected after a fresh Oryven launch)"
}

Write-Host ""
Write-Host "=== Registry scan (HKCU + HKLM Uninstall keys) ==="
$regRoots = @(
  "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
  "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
)
foreach ($rr in $regRoots) {
  if (-not (Test-Path $rr)) { continue }
  Get-ChildItem -Path $rr -ErrorAction SilentlyContinue | ForEach-Object {
    $props = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue
    $name = $props.DisplayName
    $ver = $props.DisplayVersion
    $pub = $props.Publisher
    $uninst = $props.UninstallString
    $quninst = $props.QuietUninstallString
    # Name match is exact-or-prefix: DisplayName eq 'Oryven' OR matches
    # '^Oryven \d' style (e.g. "Oryven 2.0"). The PSPath catch catches GUID-keyed
    # installs whose DisplayName might be set differently.
    if ($name -and (
        $_.PSPath -match "app.oryven" -or
        $_.PSPath -match "\\Oryven$" -or
        ($name -eq 'Oryven') -or
        ($name -match '^Oryven\s\d')
      )) {
      Write-Host "REG: $($_.PSPath)"
      Write-Host "  DisplayName       = $name"
      Write-Host "  DisplayVersion    = $ver"
      Write-Host "  Publisher         = $pub"
      Write-Host "  UninstallString   = $uninst"
      Write-Host "  QuietUninstall    = $quninst"
    }
  }
}

Write-Host ""
Write-Host "=== Start menu shortcuts ==="
$startMenus = @(
  (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
  (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs")
)
foreach ($sm in $startMenus) {
  if (-not (Test-Path $sm)) { continue }
  Get-ChildItem -Path $sm -Recurse -Filter "Oryven*" -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "STARTMENU: $($_.FullName)" }
}

Write-Host ""
Write-Host "=== Running processes ==="
Get-Process -Name "oryven", "app.oryven.desktop" -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host ("RUNNING: pid={0} path={1}" -f $_.Id, $_.Path)
}
if ($null -eq (Get-Process -Name "oryven", "app.oryven.desktop" -ErrorAction SilentlyContinue)) {
  Write-Host "(no oryven.exe processes running)"
}

Write-Host ""
Write-Host "=== Legacy Stride detection (diagnostic only) ==="
# Detects any stale Stride install that's still on the machine - useful for
# diagnosing whether a v0.4.0 migration left remnants behind. The directory
# filter is exact-name (not the loose "Stride*" prefix) so we don't false-match
# unrelated installs like "Stride Learning". The state-file probe is also exact
# because %APPDATA%\app.stride.desktop\ is the path Tauri's identifier derives.
$strideRoots = @(
  (Join-Path $env:LOCALAPPDATA "Programs"),
  (Join-Path $env:APPDATA "app.stride.desktop")
)
$legacyStride = 0
$legacyState = $false
foreach ($r in $strideRoots) {
  if (-not (Test-Path $r)) { continue }
  if ($r.EndsWith("Programs")) {
    # Programs/ doesn't have app.stride.desktop dirs; only the install-dir.
    Get-ChildItem -Path $r -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -eq 'Stride' } |
      ForEach-Object { Write-Host "LEGACY_DIR: $($_.FullName)"; $legacyStride++ }
  } else {
    # This is the %APPDATA%\app.stride.desktop path itself.
    if (Test-Path (Join-Path $r "state.json")) {
      Write-Host "LEGACY_STATE: $r\state.json"
      $legacyState = $true
    }
  }
}

Write-Host ""
Write-Host "=== Summary ==="
Write-Host ("SUMMARY oryven_found={0} legacy_stride_dirs={1} legacy_state.json={2}" -f $oryvenFound, $legacyStride, $(if ($legacyState) {'true'} else {'false'}))
Write-Host "Done."

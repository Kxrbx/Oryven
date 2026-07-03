# Detect existing Stride install on this machine. Read-only.
$ErrorActionPreference = "Continue"

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
  Get-ChildItem -Path $r -Directory -Filter "Stride*" -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "FOUND DIR: $($_.FullName)" }
  Get-ChildItem -Path $r -Directory -Filter "app.stride.desktop" -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "FOUND DIR: $($_.FullName)" }
  Get-ChildItem -Path $r -File -Recurse -Filter "stride.exe" -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "FOUND EXE: $($_.FullName)" }
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
    if ($name -and ($name -match "Stride" -or $_.PSPath -match "app.stride")) {
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
  Get-ChildItem -Path $sm -Recurse -Filter "Stride*" -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "STARTMENU: $($_.FullName)" }
}

Write-Host ""
Write-Host "=== Running processes ==="
Get-Process -Name "stride" -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "RUNNING: pid=$($_.Id) path=$($_.Path)"
}
if ($null -eq (Get-Process -Name "stride" -ErrorAction SilentlyContinue)) {
  Write-Host "(no Stride.exe processes running)"
}

Write-Host ""
Write-Host "=== Summary ==="
Write-Host "Done."

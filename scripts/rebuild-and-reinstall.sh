#!/usr/bin/env bash
# Rebuild + reinstall + flush icon cache + verify, all in one pass.
set +e
cd "E:/OpenCode/Todoist"

echo "=== STEP 1: Pre-build fingerprint ==="
powershell -NoProfile -Command "& {
  \$preState = Join-Path \$env:APPDATA 'app.oryven.desktop\state.json'
  if (Test-Path \$preState) {
    Write-Host ('PRE_state_json  size=' + (Get-Item \$preState).Length + '  md5=' + (Get-FileHash \$preState -Algorithm MD5).Hash)
  } else {
    Write-Host 'PRE_state_json  MISSING'
  }
  \$preExe = 'C:\Users\aavok\AppData\Local\Oryven\oryven.exe'
  if (Test-Path \$preExe) {
    Write-Host ('PRE_exe  size=' + (Get-Item \$preExe).Length + '  sha256=' + (Get-FileHash \$preExe -Algorithm SHA256).Hash)
  } else {
    Write-Host 'PRE_exe  MISSING'
  }
}"

echo
echo "=== STEP 2: Stop running app to release EXE lock ==="
powershell -NoProfile -Command "& {
  \$procs = Get-Process -Name 'oryven','app.oryven.desktop' -ErrorAction SilentlyContinue
  if (\$procs) {
    \$procs | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host ('Stopped: ' + (\$procs.Name -join ', '))
  } else {
    Write-Host 'No running process'
  }
}"

echo
echo "=== STEP 3: npm run tauri:build ==="
START=$(date +%s)
PATH="/c/Users/aavok/.cargo/bin:$PATH" npm run tauri:build 2>&1 | tail -25
RC=${PIPESTATUS[0]}
ELAPSED=$(( $(date +%s) - START ))
echo "TAURI_BUILD_RC=$RC ELAPSED_SECONDS=$ELAPSED"

echo
echo "=== STEP 4: Build artifacts ==="
for f in src-tauri/target/release/bundle/nsis/*.exe src-tauri/target/release/bundle/msi/*.msi; do
  if [ -f "$f" ]; then
    echo "$(basename "$f")  size=$(wc -c < "$f")  sha256=$(sha256sum "$f" | cut -d' ' -f1)"
  fi
done

echo
echo "=== STEP 5: NSIS /S reinstall (preserves state.json) ==="
NSIS=$(ls -t src-tauri/target/release/bundle/nsis/*-setup-*.exe 2>/dev/null | head -1)
if [ -n "$NSIS" ]; then
  echo "Installer: $NSIS"
  powershell -NoProfile -Command "& { & '$NSIS' /S }"
  echo "NSIS_RC=$?"
  # Give the installer time to write files
  sleep 3
else
  echo "ERROR: NSIS installer not found"
  exit 1
fi

echo
echo "=== STEP 6: Verify state.json preserved ==="
powershell -NoProfile -Command "& {
  \$postState = Join-Path \$env:APPDATA 'app.oryven.desktop\state.json'
  if (Test-Path \$postState) {
    Write-Host ('POST_state_json  size=' + (Get-Item \$postState).Length + '  md5=' + (Get-FileHash \$postState -Algorithm MD5).Hash)
  } else {
    Write-Host 'POST_state_json  MISSING'
  }
  \$postExe = 'C:\Users\aavok\AppData\Local\Oryven\oryven.exe'
  if (Test-Path \$postExe) {
    Write-Host ('POST_exe  size=' + (Get-Item \$postExe).Length + '  sha256=' + (Get-FileHash \$postExe -Algorithm SHA256).Hash)
  } else {
    Write-Host 'POST_exe  MISSING'
  }
}"

echo
echo "=== STEP 7: Aggressive icon cache flush ==="
powershell -NoProfile -Command "& {
  # Stop explorer
  Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  # Run ie4uinit to clear icon cache
  & ie4uinit.exe -ClearIconCache 2>&1 | Out-Null
  Start-Sleep -Seconds 1
  # Delete IconCache.db
  \$iconCache = Join-Path \$env:LOCALAPPDATA 'IconCache.db'
  if (Test-Path \$iconCache) { Remove-Item \$iconCache -Force; Write-Host 'Deleted IconCache.db' }
  \$iconCache2 = Join-Path \$env:LOCALAPPDATA 'Microsoft\Windows\Explorer\IconCacheToDelete'
  if (Test-Path \$iconCache2) { Remove-Item \$iconCache2 -Force -Recurse; Write-Host 'Deleted Explorer IconCacheToDelete' }
  # Delete thumbcache
  Get-ChildItem -Path \$env:LOCALAPPDATA -Filter 'thumbcache_*.db' -ErrorAction SilentlyContinue | ForEach-Object { Remove-Item \$_.FullName -Force; Write-Host ('Deleted ' + \$_.Name) }
  Start-Sleep -Seconds 1
  # Restart explorer
  Start-Process explorer
  Write-Host 'Icon cache flushed and explorer restarted'
}"

echo
echo "=== STEP 8: Verify installed EXE icon matches new bundle icon ==="
sleep 2
powershell -NoProfile -Command "& {
  \$installedExe = 'C:\Users\aavok\AppData\Local\Oryven\oryven.exe'
  if (-not (Test-Path \$installedExe)) { Write-Host 'installed_exe  MISSING'; exit 1 }
  Write-Host ('installed_exe  size=' + (Get-Item \$installedExe).Length + '  sha256=' + (Get-FileHash \$installedExe -Algorithm SHA256).Hash)
  # Extract icon from installed EXE
  \$tempIco = Join-Path \$env:TEMP 'extracted-icon.ico'
  if (Test-Path \$tempIco) { Remove-Item \$tempIco -Force }
  # Use System.Drawing.Icon.ExtractAssociatedIcon to get the icon
  Add-Type -AssemblyName System.Drawing
  \$icon = [System.Drawing.Icon]::ExtractAssociatedIcon(\$installedExe)
  if (\$icon) {
    \$stream = [System.IO.File]::Create(\$tempIco)
    \$icon.Save(\$stream)
    \$stream.Close()
    Write-Host ('Extracted icon to: ' + \$tempIco)
    Write-Host ('extracted_icon  size=' + (Get-Item \$tempIco).Length + '  sha256=' + (Get-FileHash \$tempIco -Algorithm SHA256).Hash)
  } else {
    Write-Host 'ERROR: Could not extract icon from installed EXE'
  }
  # Compare with bundle icon
  \$bundleIco = 'E:\OpenCode\Todoist\src-tauri\icons\icon.ico'
  if (Test-Path \$bundleIco) {
    Write-Host ('bundle_icon  size=' + (Get-Item \$bundleIco).Length + '  sha256=' + (Get-FileHash \$bundleIco -Algorithm SHA256).Hash)
  }
}"

echo
echo "=== STEP 9: Final verification (icon shape from installed EXE) ==="
powershell -NoProfile -Command "& {
  Add-Type -AssemblyName System.Drawing
  \$installedExe = 'C:\Users\aavok\AppData\Local\Oryven\oryven.exe'
  \$icon = [System.Drawing.Icon]::ExtractAssociatedIcon(\$installedExe)
  if (\$icon) {
    \$bmp = \$icon.ToBitmap()
    Write-Host ('Installed icon: ' + \$bmp.Width + 'x' + \$bmp.Height)
    foreach (\$pt in @(@{x=0;y=0;name='TL'},{x=\$bmp.Width-1;y=0;name='TR'},{x=0;y=\$bmp.Height-1;name='BL'},{x=\$bmp.Width-1;y=\$bmp.Height-1;name='BR'},{x=[int](\$bmp.Width/2);y=[int](\$bmp.Height/2);name='CTR'})) {
      \$p = \$bmp.GetPixel(\$pt.x, \$pt.y)
      \$op = if (\$p.A -gt 0) {'OPAQUE'} else {'TRANSPARENT'}
      Write-Host ('  ' + \$pt.name + ' (' + \$pt.x + ',' + \$pt.y + ')  A=' + \$p.A + ' -> ' + \$op)
    }
  }
}"

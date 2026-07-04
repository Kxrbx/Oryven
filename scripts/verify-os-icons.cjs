// Data-level verification of all Windows icon surfaces for Oryven.
// More robust: PowerShell computes sha256 directly (no file read race).
const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");
const crypto = require("crypto");

const EXE = "C:\\Users\\aavok\\AppData\\Local\\Oryven\\oryven.exe";
const BUNDLE_DIR = "E:\\OpenCode\\Todoist\\src-tauri\\icons";
const TEMP_DIR = "C:\\Users\\aavok\\AppData\\Local\\Temp";
const TEMP_ICO = path.join(TEMP_DIR, "verify-extracted-icon.ico");
const TEMP_PS = path.join(TEMP_DIR, "verify-icons.ps1");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function runPS(scriptLines) {
  // Write the PS script to a .ps1 file and execute it. This avoids
  // all the quoting issues with -Command.
  fs.writeFileSync(TEMP_PS, scriptLines.join("\n"), "utf8");
  let out;
  try {
    out = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${TEMP_PS}"`,
      { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, timeout: 30000 }
    );
  } finally {
    try { fs.unlinkSync(TEMP_PS); } catch {}
  }
  return out;
}

console.log("=== STEP 1: Bundle icons (source of truth) ===");
const bundleIcons = {};
for (const f of fs.readdirSync(BUNDLE_DIR)) {
  const full = path.join(BUNDLE_DIR, f);
  try {
    const buf = fs.readFileSync(full);
    bundleIcons[f] = { size: buf.length, sha256: sha256(buf) };
    console.log(`  ${f}  size=${buf.length}  sha256=${sha256(buf).slice(0, 16)}...`);
  } catch (e) {
    console.log(`  ${f}  READ_ERROR: ${e.message.slice(0, 100)}`);
  }
}

console.log("\n=== STEP 2: Extract icon from installed EXE ===");
try { fs.unlinkSync(TEMP_ICO); } catch {}

// Use PowerShell to: extract icon, save to file, compute sha256, report pixel data.
// All in one shot — no file read race.
const ps1 = [
  `Add-Type -AssemblyName System.Drawing`,
  `$exe = "${EXE}"`,
  `Write-Host "EXE_SIZE=" (Get-Item $exe).Length`,
  `Write-Host "EXE_SHA256=" (Get-FileHash $exe -Algorithm SHA256).Hash`,
  `$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exe)`,
  `if (-not $icon) { Write-Host "EXTRACT_ICO_FAILED"; exit 1 }`,
  `$icoPath = "${TEMP_ICO}"`,
  `if (Test-Path $icoPath) { Remove-Item $icoPath -Force }`,
  `$stream = [System.IO.File]::Create($icoPath)`,
  `$icon.Save($stream)`,
  `$stream.Close()`,
  `Write-Host "EXTRACT_ICO_OK"`,
  `Write-Host "EXTRACT_ICO_SHA256=" (Get-FileHash $icoPath -Algorithm SHA256).Hash`,
  `Write-Host "EXTRACT_ICO_SIZE=" (Get-Item $icoPath).Length`,
  `$bmp = $icon.ToBitmap()`,
  `Write-Host "ICON_SIZE=" $bmp.Width "x" $bmp.Height`,
  `$points = @(`,
  `  @{x=0; y=0; name="TL"},`,
  `  @{x=$bmp.Width-1; y=0; name="TR"},`,
  `  @{x=0; y=$bmp.Height-1; name="BL"},`,
  `  @{x=$bmp.Width-1; y=$bmp.Height-1; name="BR"},`,
  `  @{x=[int]($bmp.Width/2); y=[int]($bmp.Height/2); name="CTR"}`,
  `)`,
  `foreach ($pt in $points) {`,
  `  $p = $bmp.GetPixel($pt.x, $pt.y)`,
  `  $op = if ($p.A -gt 0) {"OPAQUE"} else {"TRANSPARENT"}`,
  `  Write-Host ("PIXEL=" + $pt.name + " " + $pt.x + "," + $pt.y + " A=" + $p.A + " " + $op)`,
  `}`,
  `$trans = 0; $total = 0`,
  `for ($y = 0; $y -lt $bmp.Height; $y += 4) {`,
  `  for ($x = 0; $x -lt $bmp.Width; $x += 4) {`,
  `    $p = $bmp.GetPixel($x, $y)`,
  `    $total++`,
  `    if ($p.A -eq 0) { $trans++ }`,
  `  }`,
  `}`,
  `Write-Host ("TRANSPARENT_PCT=" + [math]::Round(100 * $trans / $total, 1))`,
];

let psOut;
try {
  psOut = runPS(ps1);
} catch (e) {
  console.log("PowerShell extract failed:", (e.message || "").slice(0, 500));
  process.exit(1);
}
console.log(psOut.trim());

// Parse the output
const lines = psOut.split(/\r?\n/);
const kv = {};
for (const line of lines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    const k = m[1];
    const v = m[2].trim();
    if (!(k in kv)) kv[k] = v;
  }
}
const pixels = [];
for (const line of lines) {
  const m = line.match(/^PIXEL=(\S+)\s+(\d+),(\d+)\s+A=(\d+)\s+(\w+)/);
  if (m) pixels.push({ name: m[1], x: +m[2], y: +m[3], a: +m[4], state: m[5] });
}

console.log("\n=== STEP 3: Compare EXE icon to bundle icon ===");
if (kv.EXTRACT_ICO_SHA256 && bundleIcons["icon.ico"]) {
  const match = kv.EXTRACT_ICO_SHA256 === bundleIcons["icon.ico"].sha256;
  console.log(`  EXE icon sha256:    ${kv.EXTRACT_ICO_SHA256}`);
  console.log(`  Bundle icon sha256: ${bundleIcons["icon.ico"].sha256}`);
  console.log(`  MATCH: ${match ? "YES" : "NO (icons differ!)"}`);
} else {
  console.log(`  EXE icon sha256: ${kv.EXTRACT_ICO_SHA256 || "MISSING"}`);
  console.log(`  Bundle icon sha256: ${bundleIcons["icon.ico"] ? bundleIcons["icon.ico"].sha256 : "MISSING"}`);
  console.log("  Could not compare");
}

console.log("\n=== STEP 4: Pixel check (mark fills the tile?) ===");
let cornersOpaque = 0;
let centerTransparent = false;
for (const p of pixels) {
  if (p.name !== "CTR" && p.state === "OPAQUE") cornersOpaque++;
  if (p.name === "CTR" && p.state === "TRANSPARENT") centerTransparent = true;
  console.log(`  ${p.name} (${p.x},${p.y})  A=${p.a}  ${p.state}`);
}
const allCornersOpaque = cornersOpaque === 4;
console.log(`  All 4 corners OPAQUE: ${allCornersOpaque ? "YES (mark fills the tile)" : "NO (mark is letterboxed!)"}`);
console.log(`  Center TRANSPARENT:   ${centerTransparent ? "YES (O has a hole)" : "NO (mark is solid!)"}`);
console.log(`  Overall transparent:  ${kv.TRANSPARENT_PCT || "?"}%`);

console.log("\n=== STEP 5: Start Menu .lnk file icon reference ===");
const lnkScript = [
  `$shell = New-Object -ComObject WScript.Shell`,
  `$found = $false`,
  `$startMenuPaths = @(`,
  `  (Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs"),`,
  `  "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs"`,
  `)`,
  `foreach ($p in $startMenuPaths) {`,
  `  if (Test-Path $p) {`,
  `    $lnks = Get-ChildItem -Path $p -Filter "*Oryven*" -Recurse -ErrorAction SilentlyContinue`,
  `    foreach ($lnk in $lnks) {`,
  `      $found = $true`,
  `      Write-Host ("LNK_PATH=" + $lnk.FullName)`,
  `      $shortcut = $shell.CreateShortcut($lnk.FullName)`,
  `      Write-Host ("LNK_TARGET=" + $shortcut.TargetPath)`,
  `      Write-Host ("LNK_ICON_LOCATION=" + $shortcut.IconLocation)`,
  `      Write-Host ("LNK_LAST_WRITE=" + $lnk.LastWriteTime)`,
  `    }`,
  `  }`,
  `}`,
  `if (-not $found) { Write-Host "LNK_PATH=NO_ORYVEN_SHORTCUTS_FOUND" }`,
];
try {
  const lnkOut = runPS(lnkScript);
  console.log(lnkOut.trim());
} catch (e) {
  console.log("Start Menu .lnk check failed:", (e.message || "").slice(0, 300));
}

console.log("\n=== STEP 6: Windows icon cache state ===");
const cacheScript = [
  `$paths = @(`,
  `  (Join-Path $env:LOCALAPPDATA "IconCache.db"),`,
  `  (Join-Path $env:LOCALAPPDATA "Microsoft\\Windows\\Explorer\\iconcache_*.db"),`,
  `  (Join-Path $env:LOCALAPPDATA "Microsoft\\Windows\\Explorer\\IconCacheToDelete")`,
  `)`,
  `$found = $false`,
  `foreach ($p in $paths) {`,
  `  $matches = Get-ChildItem -Path $p -ErrorAction SilentlyContinue`,
  `  foreach ($m in $matches) {`,
  `    Write-Host ("CACHE_FILE=" + $m.FullName + " size=" + $m.Length + " lastWrite=" + $m.LastWriteTime)`,
  `    $found = $true`,
  `  }`,
  `}`,
  `if (-not $found) { Write-Host "CACHE_FILE=NO_ICON_CACHE_FILES_FOUND (cache is clean)" }`,
  `Write-Host ("EXPLORER_RUNNING=" -f $(if (Get-Process -Name explorer -ErrorAction SilentlyContinue) {"YES"} else {"NO"}))`,
];
try {
  const cacheOut = runPS(cacheScript);
  console.log(cacheOut.trim());
} catch (e) {
  console.log("Icon cache check failed:", (e.message || "").slice(0, 300));
}

console.log("\n=== STEP 7: Launch app and check window icon ===");
const launchScript = [
  `$procsBefore = @(Get-Process -Name "oryven" -ErrorAction SilentlyContinue)`,
  `if ($procsBefore) { $procsBefore | Stop-Process -Force; Start-Sleep -Seconds 1 }`,
  `Start-Process "${EXE}"`,
  `Start-Sleep -Seconds 4`,
  `$procs = @(Get-Process -Name "oryven" -ErrorAction SilentlyContinue)`,
  `if ($procs.Count -gt 0) {`,
  `  Write-Host ("APP_PID=" + $procs[0].Id)`,
  `  Write-Host ("APP_START_TIME=" + $procs[0].StartTime)`,
  `  Write-Host ("APP_TITLE=" + $procs[0].MainWindowTitle)`,
  `  Write-Host ("APP_HWND=" + $procs[0].MainWindowHandle)`,
  `  # Extract the window's icon via SendMessage WM_GETICON`,
  `  Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern bool DestroyIcon(IntPtr hIcon);
  [DllImport("user32.dll")]
  public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
}
"@`,
  `  $hwnd = $procs[0].MainWindowHandle`,
  `  if ($hwnd -ne 0) {`,
  `    $WM_GETICON = 0x007F`,
  `    $ICON_BIG = 1`,
  `    $hIcon = [Win32]::SendMessage($hwnd, $WM_GETICON, $ICON_BIG, [IntPtr]::Zero)`,
  `    if ($hIcon -ne [IntPtr]::Zero) {`,
  `      $img = [System.Drawing.Image]::FromHicon($hIcon)`,
  `      Write-Host ("WINDOW_ICON_SIZE=" + $img.Width + "x" + $img.Height)`,
  `      # Check corners`,
  `      $points = @(@{x=0;y=0;name="TL"},@{x=$img.Width-1;y=0;name="TR"},@{x=0;y=$img.Height-1;name="BL"},@{x=$img.Width-1;y=$img.Height-1;name="BR"},@{x=[int]($img.Width/2);y=[int]($img.Height/2);name="CTR"})`,
  `      foreach ($pt in $points) {`,
  `        $p = $img.GetPixel($pt.x, $pt.y)`,
  `        $op = if ($p.A -gt 0) {"OPAQUE"} else {"TRANSPARENT"}`,
  `        Write-Host ("WINDOW_ICON_PIXEL=" + $pt.name + " " + $pt.x + "," + $pt.y + " " + $op)`,
  `      }`,
  `      [Win32]::DestroyIcon($hIcon) | Out-Null`,
  `    } else {`,
  `      Write-Host "WINDOW_ICON=NO_HICON_RETURNED"`,
  `    }`,
  `  } else {`,
  `    Write-Host "WINDOW_ICON=NO_MAIN_WINDOW_HANDLE"`,
  `  }`,
  `  $procs | Stop-Process -Force`,
  `  Write-Host "APP_STOPPED"`,
  `} else {`,
  `  Write-Host "APP_LAUNCH_FAILED"`,
  `}`,
];
try {
  const launchOut = runPS(launchScript);
  console.log(launchOut.trim());
} catch (e) {
  console.log("App launch check failed:", (e.message || "").slice(0, 500));
}

console.log("\n=== STEP 8: Visual checklist for user ===");
console.log("All data-level checks complete. Please verify on your screen:");
console.log("  1. TASKBAR: pinned Oryven icon (right-click taskbar Oryven > properties)");
console.log("  2. START MENU TILE: open Start > scroll to Oryven (large tile)");
console.log("  3. START MENU ENTRY: same location, text label");
console.log("  4. CONTEXT MENU: right-click oryven.exe in File Explorer");
console.log("All 4 should show: stylized blue O, fills the entire square tile (no transparent corners).");

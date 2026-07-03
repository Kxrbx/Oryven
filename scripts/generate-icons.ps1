# Generates the brand mark as multiple PNG sizes + a multi-resolution ICO for Tauri.
# Oryven: filled circle with smaller dark hole, on a transparent background.
# Inner-hole ratio (0.30) matches the in-app brand SVG (Sidebar.tsx +
# Settings -> About markup use rOuter=6, rInner=2.5 in a 16x16 viewBox - an
# inner_d/outer_d ~= 0.42) so the EXE resources, MSI tile, and taskbar
# pinned tile read as the exact same mark at every size.

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

function New-Mark([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $rOuter = [int]($size * 0.70)
  $pad = [int](($size - $rOuter) / 2)
  $brushOuter = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 139, 149, 247))
  $g.FillEllipse($brushOuter, $pad, $pad, $rOuter, $rOuter)
  # Inner-hole diameter is ~60% of the outer disc, matching the 0.42 ratio
  # of the in-app <circle r="2.5"> inside <circle r="6"> brand-mark motif.
  $rInner = [int]($size * 0.30)
  $padInner = [int]($size * 0.30 / 2)
  $brushInner = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 16, 20))
  $g.FillEllipse($brushInner, $padInner, $padInner, $rInner, $rInner)
  # Clean up GDI+ resources so PowerShell doesn't leak handles per regen.
  $g.Dispose()
  $brushOuter.Dispose()
  $brushInner.Dispose()
  $bmp
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# Multi-resolution ICO builder. PNG-in-ICO is supported on Vista+, so we don't
# need to round-trip through BMP. Concatenates six PNG sizes (16, 32, 48, 64,
# 128, 256) into a single icon.ico so taskbar pinned tile, Start Menu, MSI
# tile, and mid-DPI Explorer renderers all see a sharp mark.
function Save-MultiResIco([int[]]$sizes, [string]$path) {
  $stages = @()
  foreach ($size in $sizes) {
    $ms = New-Object System.IO.MemoryStream
    $bmp = New-Mark $size
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $stages += [pscustomobject]@{
      Size  = $size
      Bytes = $ms.ToArray()
    }
    $ms.Dispose()
  }
  $fs = [System.IO.File]::Create($path)
  try {
    $bw = New-Object System.IO.BinaryWriter $fs
    # ICONDIR header: 6 bytes
    $bw.Write([uint16]0)         # reserved
    $bw.Write([uint16]1)         # type = ICO
    $bw.Write([uint16]$stages.Count)
    # Data offset starts after the header + 16-byte directory entries.
    $dataOffset = 6 + ($stages.Count * 16)
    # ICONDIRENTRY: 16 bytes per stage
    foreach ($stage in $stages) {
      # Width/height byte is 0 for 256 because the field is one byte.
      $w = if ($stage.Size -ge 256) { [byte]0 } else { [byte]$stage.Size }
      $h = $w
      $bw.Write($w)                          # width
      $bw.Write($h)                          # height
      $bw.Write([byte]0)                     # palette color count (0 = none)
      $bw.Write([byte]0)                     # reserved
      $bw.Write([uint16]1)                   # color planes
      $bw.Write([uint16]32)                  # bits per pixel
      $bw.Write([uint32]$stage.Bytes.Length) # bytes in resource
      $bw.Write([uint32]$dataOffset)         # image data offset
      $dataOffset += $stage.Bytes.Length
    }
    # Payload: PNG bytes for each stage, in declared order.
    foreach ($stage in $stages) {
      $bw.Write($stage.Bytes)
    }
    $bw.Flush()
  } finally {
    $fs.Dispose()
  }
}

$dir = Join-Path $PSScriptRoot "..\src-tauri\icons"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

# Tauri reads these three PNGs directly from tauri.conf.json's "icon" list.
Save-Png (New-Mark 32)  (Join-Path $dir "32x32.png")
Save-Png (New-Mark 128) (Join-Path $dir "128x128.png")
Save-Png (New-Mark 256) (Join-Path $dir "128x128@2x.png")  # @2x = 256 base

# icon.ico is multi-resolution so it renders sharply across every Windows
# context (Start Menu, taskbar pinned tile, MSI tile, Explorer mid-icon).
Save-MultiResIco @(16, 32, 48, 64, 128, 256) (Join-Path $dir "icon.ico")

# --- Post-regen assertions ----------------------------------------------------
$expected = @("32x32.png", "128x128.png", "128x128@2x.png", "icon.ico")
$missing = @()
foreach ($f in $expected) {
  if (-not (Test-Path (Join-Path $dir $f))) { $missing += $f }
}
if ($missing.Count -gt 0) {
  Write-Error ("ASSERT_FAILED missing={0}" -f ($missing -join ', '))
  exit 1
}
# Sanity bands - flag the regen if a future tweak produces wildly different
# byte sizes (e.g. an empty bitmap stashed by a script refactor regression).
$size32  = (Get-Item (Join-Path $dir "32x32.png")).Length
$size128 = (Get-Item (Join-Path $dir "128x128.png")).Length
$size256 = (Get-Item (Join-Path $dir "128x128@2x.png")).Length
$sizeIco = (Get-Item (Join-Path $dir "icon.ico")).Length
$problems = @()
if ($size32  -lt 200 -or $size32  -gt 4096)  { $problems += "32x32.png=$size32" }
if ($size128 -lt 600 -or $size128 -gt 8192)  { $problems += "128x128.png=$size128" }
if ($size256 -lt 2000 -or $size256 -gt 32768){ $problems += "128x128@2x.png=$size256" }
# A multi-res ico with six PNGs at 16-256 should be at least ~6KB.
if ($sizeIco -lt 6000)                        { $problems += "icon.ico=$sizeIco (expected multi-res >6KB)" }
if ($problems.Count -gt 0) {
  Write-Error ("ASSERT_FAILED size_out_of_band {0}" -f ($problems -join ', '))
  exit 1
}

Write-Host ("Icons written to {0}" -f $dir)
foreach ($f in $expected) {
  $info = Get-Item (Join-Path $dir $f)
  Write-Host ("  {0,16}  {1,7} bytes" -f $info.Name, $info.Length)
}
Write-Host "ASSERT_OK"

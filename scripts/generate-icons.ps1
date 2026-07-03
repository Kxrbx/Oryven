# Generates the brand mark as multiple PNG sizes + ICO for Tauri.
# Stride: filled circle with smaller dark hole, on a transparent background.

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
  $rInner = [int]($size * 0.26)
  $padInner = [int](($size - $rInner) / 2)
  $brushInner = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 16, 20))
  $g.FillEllipse($brushInner, $padInner, $padInner, $rInner, $rInner)
  $bmp
}

$dir = Join-Path $PSScriptRoot "..\src-tauri\icons"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

$base = New-Mark 512
$base.Save((Join-Path $dir "128x128@2x.png"), [System.Drawing.Imaging.ImageFormat]::Png)

( New-Mark 32 ).Save((Join-Path $dir "32x32.png"),    [System.Drawing.Imaging.ImageFormat]::Png)
( New-Mark 128 ).Save((Join-Path $dir "128x128.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# Convert the 256 base to ICO via System.Drawing.Icon.
$ico = New-Mark 256
$hIcon = $ico.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = New-Object System.IO.FileStream (Join-Path $dir "icon.ico"), Create
$icon.Save($fs)
$fs.Close()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($hIcon) | Out-Null

Write-Host "Icons written to $dir"
Get-ChildItem $dir | ForEach-Object { Write-Host ("  {0,12}  {1} bytes" -f $_.Name, $_.Length) }

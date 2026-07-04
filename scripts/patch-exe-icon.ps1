# Patches the icon resource of an EXE using the native Windows API.
# Reads an ICO file, parses it, and calls BeginUpdateResource /
# UpdateResource / EndUpdateResource to embed it into the target EXE.
#
# Usage: powershell -ExecutionPolicy Bypass -File patch-exe-icon.ps1

param(
  [Parameter(Mandatory=$true)] [string] $ExePath,
  [Parameter(Mandatory=$true)] [string] $IcoPath,
  [int] $IconGroupId = 32512
)

$ErrorActionPreference = "Stop"

# P/Invoke declarations
Add-Type @"
using System;
using System.Runtime.InteropServices;

public class WinRes {
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  public static extern IntPtr BeginUpdateResource(string pFileName, [MarshalAs(UnmanagedType.Bool)] bool bDeleteExistingResources);

  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool UpdateResource(IntPtr hUpdate, IntPtr lpType, IntPtr lpName, ushort wLanguage, byte[] lpData, uint cbData);

  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool EndUpdateResource(IntPtr hUpdate, [MarshalAs(UnmanagedType.Bool)] bool fDiscard);

  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern uint FormatMessage(uint dwFlags, IntPtr lpSource, uint dwMessageId, uint dwLanguageId, System.Text.StringBuilder lpBuffer, uint nSize, IntPtr Arguments);

  public static IntPtr MAKEINTRESOURCE(int i) { return new IntPtr(i); }
}
"@ -ErrorAction SilentlyContinue

if (-not ("WinRes" -as [type])) {
  Write-Error "Failed to load WinRes type"
  exit 1
}

function Format-LastError {
  param([int] $Code)
  $sb = New-Object System.Text.StringBuilder 512
  [void][WinRes]::FormatMessage(0x1300, [IntPtr]::Zero, $Code, 0, $sb, $sb.Capacity, [IntPtr]::Zero)
  return $sb.ToString().Trim()
}

# Read the ICO file
Write-Host "Reading ICO: $IcoPath"
$icoBytes = [System.IO.File]::ReadAllBytes($IcoPath)
$icoLen = $icoBytes.Length
Write-Host ("ICO size: " + $icoLen + " bytes")

# Parse ICONDIR header (6 bytes): reserved(2) + type(2) + count(2)
if ($icoLen -lt 6) { Write-Error "ICO too small"; exit 1 }
$reserved = [BitConverter]::ToUInt16($icoBytes, 0)
$icoType = [BitConverter]::ToUInt16($icoBytes, 2)
$iconCount = [BitConverter]::ToUInt16($icoBytes, 4)
Write-Host ("ICO type: " + $icoType + " (1=icon), count: " + $iconCount)
if ($icoType -ne 1) { Write-Error "Not an icon file (type=$icoType)"; exit 1 }

# Parse ICONDIRENTRY entries (16 bytes each)
$entries = @()
$entryOffset = 6
for ($i = 0; $i -lt $iconCount; $i++) {
  if ($icoLen -lt ($entryOffset + 16)) { Write-Error "ICO truncated at entry $i"; exit 1 }
  $w = $icoBytes[$entryOffset]
  $h = $icoBytes[$entryOffset + 1]
  $colors = $icoBytes[$entryOffset + 2]
  $resv = $icoBytes[$entryOffset + 3]
  $planes = [BitConverter]::ToUInt16($icoBytes, $entryOffset + 4)
  $bitCount = [BitConverter]::ToUInt16($icoBytes, $entryOffset + 6)
  $size = [BitConverter]::ToUInt32($icoBytes, $entryOffset + 8)
  $dataOffset = [BitConverter]::ToUInt32($icoBytes, $entryOffset + 12)
  Write-Host ("  Entry $i : " + $w + "x" + $h + " colors=" + $colors + " planes=" + $planes + " bitCount=" + $bitCount + " size=" + $size + " offset=" + $dataOffset)
  $entries += [pscustomobject]@{
    Width = $w; Height = $h; Colors = $colors; Reserved = $resv
    Planes = $planes; BitCount = $bitCount; Size = $size; DataOffset = $dataOffset
  }
  $entryOffset += 16
}

# Build GRPICONDIR (6 bytes header + 14 bytes per entry)
$grpDirSize = 6 + 14 * $iconCount
$grpDir = New-Object byte[] $grpDirSize
# Header: reserved=0, type=1, count=N
[BitConverter]::GetBytes([uint16]0).CopyTo($grpDir, 0)
[BitConverter]::GetBytes([uint16]1).CopyTo($grpDir, 2)
[BitConverter]::GetBytes([uint16]$iconCount).CopyTo($grpDir, 4)

# Assign icon IDs starting from 1 (RT_ICON resources use numeric IDs)
for ($i = 0; $i -lt $iconCount; $i++) {
  $e = $entries[$i]
  $iconId = $i + 1
  $off = 6 + 14 * $i
  $grpDir[$off] = $e.Width
  $grpDir[$off + 1] = $e.Height
  $grpDir[$off + 2] = $e.Colors
  $grpDir[$off + 3] = $e.Reserved
  [BitConverter]::GetBytes([uint16]$e.Planes).CopyTo($grpDir, $off + 4)
  [BitConverter]::GetBytes([uint16]$e.BitCount).CopyTo($grpDir, $off + 6)
  [BitConverter]::GetBytes([uint32]$e.Size).CopyTo($grpDir, $off + 8)
  [BitConverter]::GetBytes([uint16]$iconId).CopyTo($grpDir, $off + 12)
}

# Begin update
Write-Host ""
Write-Host "BeginUpdateResource: $ExePath"
$hUpdate = [WinRes]::BeginUpdateResource($ExePath, $false)
if ($hUpdate -eq [IntPtr]::Zero) {
  $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Write-Error ("BeginUpdateResource failed: " + $err + " " + (Format-LastError $err))
  exit 1
}
Write-Host ("hUpdate=" + $hUpdate)

$RT_ICON = [WinRes]::MAKEINTRESOURCE(1)
$RT_GROUP_ICON = [WinRes]::MAKEINTRESOURCE(14)

# Delete existing icons in the group (best effort: delete RT_GROUP_ICON and a range of RT_ICON)
Write-Host "Deleting existing icon group ($IconGroupId)..."
$null = [WinRes]::UpdateResource($hUpdate, $RT_GROUP_ICON, [WinRes]::MAKEINTRESOURCE($IconGroupId), 0, $null, 0)

# Update each icon
for ($i = 0; $i -lt $iconCount; $i++) {
  $e = $entries[$i]
  $iconId = $i + 1
  $data = $icoBytes[$e.DataOffset..($e.DataOffset + $e.Size - 1)]
  Write-Host ("Updating RT_ICON id=" + $iconId + " size=" + $e.Size)
  $ok = [WinRes]::UpdateResource($hUpdate, $RT_ICON, [WinRes]::MAKEINTRESOURCE($iconId), 0, $data, [uint32]$e.Size)
  if (-not $ok) {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [void][WinRes]::EndUpdateResource($hUpdate, $true)
    Write-Error ("UpdateResource (icon $iconId) failed: " + $err + " " + (Format-LastError $err))
    exit 1
  }
}

# Update the group icon
Write-Host ("Updating RT_GROUP_ICON id=" + $IconGroupId + " size=" + $grpDirSize)
$ok = [WinRes]::UpdateResource($hUpdate, $RT_GROUP_ICON, [WinRes]::MAKEINTRESOURCE($IconGroupId), 0, $grpDir, [uint32]$grpDirSize)
if (-not $ok) {
  $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  [void][WinRes]::EndUpdateResource($hUpdate, $true)
  Write-Error ("UpdateResource (group) failed: " + $err + " " + (Format-LastError $err))
  exit 1
}

# Commit
Write-Host "EndUpdateResource (commit)..."
$ok = [WinRes]::EndUpdateResource($hUpdate, $false)
if (-not $ok) {
  $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Write-Error ("EndUpdateResource failed: " + $err + " " + (Format-LastError $err))
  exit 1
}

Write-Host ""
Write-Host "SUCCESS: Patched $ExePath with $iconCount icons from $IcoPath"

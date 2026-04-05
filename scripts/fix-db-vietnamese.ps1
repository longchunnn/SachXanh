param(
  [string]$DbPath = "./db.json"
)

$ErrorActionPreference = 'Stop'

function Convert-MojibakeToUtf8([string]$s) {
  # Interpret the current .NET string as Windows-1252 bytes (common mojibake source), then decode as UTF-8.
  # Windows-1252 is important because mojibake often contains characters like U+203A (›) that are not in ISO-8859-1.
  $cp1252 = [System.Text.Encoding]::GetEncoding(1252)
  $bytes = $cp1252.GetBytes($s)
  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Looks-LikeMojibake([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return $false }

  # Heuristic markers for mojibake produced when UTF-8 Vietnamese text is read as Latin-1/Windows-1252.
  # Keep this file ASCII-only (Windows PowerShell can mis-parse UTF-8 without BOM).
  $markerChars = [char[]]@(
    0x00C2, # Â
    0x00C3, # Ã
    0x00C4, # Ä
    0x00C5, # Å
    0x00C6, # Æ
    0x00E2  # â (from curly quotes mojibake)
  )

  if ($s.IndexOfAny($markerChars) -ge 0) { return $true }

  $a = [char]0x00E1 # á
  $ba = [char]0x00BA # º
  $bb = [char]0x00BB # »
  if ($s.Contains(($a.ToString() + $ba)) -or $s.Contains(($a.ToString() + $bb))) { return $true }

  foreach ($ch in $s.ToCharArray()) {
    $code = [int]$ch
    if ($code -ge 0x0080 -and $code -le 0x009F) { return $true }
  }

  return $false
}

function Fix-String([string]$s) {
  if (-not (Looks-LikeMojibake $s)) { return $s }

  function Count-Markers([string]$t) {
    if ([string]::IsNullOrEmpty($t)) { return 0 }
    $score = 0

    foreach ($ch in $t.ToCharArray()) {
      $code = [int]$ch
      if ($code -ge 0x0080 -and $code -le 0x009F) { $score += 3; continue }
      if ($code -eq 0x00C2 -or $code -eq 0x00C3 -or $code -eq 0x00C4 -or $code -eq 0x00C5 -or $code -eq 0x00C6) { $score += 2; continue }
      if ($code -eq 0x00E2) { $score += 1; continue }
    }

    $a = [char]0x00E1
    $ba = [char]0x00BA
    $bb = [char]0x00BB
    if ($t.Contains(($a.ToString() + $ba))) { $score += 5 }
    if ($t.Contains(($a.ToString() + $bb))) { $score += 5 }

    return $score
  }

  $current = $s

  for ($i = 0; $i -lt 5; $i++) {
    if (-not (Looks-LikeMojibake $current)) { break }

    $before = Count-Markers $current
    $candidate = Convert-MojibakeToUtf8 $current

    if ($candidate -eq $current) { break }
    if ($candidate -match "\uFFFD") { break }

    $after = Count-Markers $candidate
    if ($after -lt $before) {
      $current = $candidate
      continue
    }

    break
  }

  return $current
}

function Fix-Object([object]$value) {
  if ($null -eq $value) { return $null }

  # Strings
  if ($value -is [string]) {
    return Fix-String $value
  }

  # Arrays
  if ($value -is [System.Collections.IEnumerable] -and -not ($value -is [System.Collections.IDictionary]) -and -not ($value -is [string])) {
    $list = New-Object System.Collections.ArrayList
    foreach ($item in $value) {
      [void]$list.Add((Fix-Object $item))
    }
    return ,$list.ToArray()
  }

  # PSObjects (JSON objects)
  if ($value -is [psobject]) {
    foreach ($p in $value.PSObject.Properties) {
      $value.$($p.Name) = Fix-Object $p.Value
    }
    return $value
  }

  return $value
}

if (-not (Test-Path $DbPath)) {
  throw "db.json not found at path: $DbPath"
}

$resolvedDbPath = (Resolve-Path $DbPath)
$jsonRaw = [System.IO.File]::ReadAllText($resolvedDbPath, [System.Text.Encoding]::UTF8)
$data = $jsonRaw | ConvertFrom-Json
$data = Fix-Object $data

$outJson = $data | ConvertTo-Json -Depth 80

# Write as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($resolvedDbPath, $outJson, $utf8NoBom)

Write-Host "Fixed Vietnamese encoding and wrote UTF-8 no-BOM: $DbPath"
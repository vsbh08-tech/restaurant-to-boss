$ErrorActionPreference = "Stop"

try {
  $projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  Set-Location -LiteralPath $projectRoot

  New-Item -ItemType Directory -Force -Path "$env:APPDATA\npm" | Out-Null
  $tokenFilePath = Join-Path $PSScriptRoot "supabase-token.txt"

  if (Test-Path -LiteralPath $tokenFilePath) {
    $token = (Get-Content -LiteralPath $tokenFilePath -Raw).Trim()
    Write-Host "Token loaded from scripts\\supabase-token.txt" -ForegroundColor DarkCyan
  }
  else {
    $token = Read-Host "Paste Supabase Personal Access Token (must start with sbp_)"
  }

  $token = $token.Trim()
  $token = $token.Trim('"', "'")
  $token = $token -replace '\s+', ''
  $token = $token -replace [char]0xFEFF, ''
  $token = $token -replace [char]0x200B, ''
  $token = $token -replace [char]0x200E, ''
  $token = $token -replace [char]0x200F, ''

  if (-not $token.StartsWith("sbp_")) {
    throw "Token must start with sbp_. Deploy aborted."
  }

  $env:SUPABASE_ACCESS_TOKEN = $token

  Write-Host ""
  Write-Host ("Token prefix: {0}; length: {1}" -f $token.Substring(0, [Math]::Min(4, $token.Length)), $token.Length) -ForegroundColor DarkGray
  Write-Host "Deploying import-analytics-csv to project gajsyhkasysyynpbqsuq..." -ForegroundColor Cyan
  Write-Host ""

  npx supabase functions deploy import-analytics-csv --project-ref gajsyhkasysyynpbqsuq

  if ($LASTEXITCODE -ne 0) {
    throw "Deploy command failed."
  }

  Write-Host ""
  Write-Host "If there were no errors above, the function is deployed." -ForegroundColor Green
}
catch {
  Write-Host ""
  Write-Host "Error:" -ForegroundColor Red
  Write-Host $_ -ForegroundColor Red
}
finally {
  Write-Host ""
  Read-Host "Press Enter to close this window"
}

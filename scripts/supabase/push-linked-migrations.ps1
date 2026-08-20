[CmdletBinding()]
param(
  [switch]$DryRun
)

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $repoRoot '.env.local'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw '.env.local is required and must remain untracked.'
}

$passwordLine = Get-Content -LiteralPath $envFile |
  Where-Object { $_ -match '^SUPABASE_DB_PASSWORD=' } |
  Select-Object -First 1
if (-not $passwordLine) {
  throw 'SUPABASE_DB_PASSWORD is required in .env.local.'
}

$env:SUPABASE_DB_PASSWORD = $passwordLine.Substring('SUPABASE_DB_PASSWORD='.Length)
$cliArgs = @('--yes', 'supabase@2.115.0', 'db', 'push', '--linked')
if ($DryRun) { $cliArgs += '--dry-run' }

& npx.cmd @cliArgs
exit $LASTEXITCODE

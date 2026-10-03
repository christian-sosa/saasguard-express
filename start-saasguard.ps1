$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskRuntime = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if (-not (Test-Path -LiteralPath $taskRuntime)) { $taskRuntime = (Get-Command node -ErrorAction Stop).Source }
$taskVersion = & $taskRuntime -p 'process.versions.node'
if ([version]$taskVersion -lt [version]'22.12.0') { throw 'Se necesita Node.js 22.12 o posterior.' }
if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) {
  $taskNpm = Join-Path (Split-Path (Get-Command npm -ErrorAction Stop).Source) 'node_modules/npm/bin/npm-cli.js'
  & $taskRuntime $taskNpm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
}
Write-Host 'SaaSGuard: http://127.0.0.1:4173'
& $taskRuntime 'node_modules/vite/bin/vite.js' --host 127.0.0.1 --port 4173 --strictPort

# Start Noema Garden API + Web (Milestone 1)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = Get-Location }

$NodeDir = "C:\Users\yashuai.wang\AppData\Local\nodejs\node-v22.14.0-win-x64"
if (Test-Path $NodeDir) {
  $env:PATH = "$NodeDir;$env:PATH"
}

$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
  Write-Error "Missing .venv. Run: python -m venv .venv && .\.venv\Scripts\pip install -r apps\api\requirements.txt"
}

Write-Host "Starting API on http://127.0.0.1:8000 ..."
Start-Process -FilePath $Python -ArgumentList @(
  "-m", "uvicorn", "app.main:app",
  "--app-dir", "apps/api",
  "--host", "127.0.0.1",
  "--port", "8000"
) -WorkingDirectory $Root

Write-Host "Starting Web on http://127.0.0.1:5173 ..."
Set-Location $Root
npm run dev:web

param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

# Определяем корень проекта (папка, где лежит этот скрипт)
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Проект: $ProjectRoot" -ForegroundColor Cyan

# ---- BACKEND (FastAPI) ----
$BackendPath = Join-Path $ProjectRoot "backend"
if (-not (Test-Path $BackendPath)) {
    Write-Error "Папка 'backend' не найдена: $BackendPath"
    exit 1
}

Write-Host "Запуск FastAPI (backend)..." -ForegroundColor Green
$VenvPython = Join-Path $ProjectRoot "venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Error "Виртуальное окружение не найдено: $VenvPython"
    exit 1
}
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location `"$BackendPath`"; " +
    "& `"$VenvPython`" -m uvicorn main:app --reload --port $BackendPort"
) | Out-Null

# ---- FRONTEND (npm run server) ----
$FrontendPath = Join-Path $ProjectRoot "frontend"
if (-not (Test-Path $FrontendPath)) {
    Write-Error "Папка 'frontend' не найдена: $FrontendPath"
    exit 1
}

Write-Host "Запуск frontend (npm run dev)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location `"$FrontendPath`"; " +
    "npm run dev -- --host 127.0.0.1 --port $FrontendPort"
) | Out-Null

Write-Host ""
Write-Host "Серверы запущены в отдельных окнах PowerShell." -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:$BackendPort" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:$FrontendPort" -ForegroundColor Yellow



param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

# Определяем корень проекта (папка, где лежит этот скрипт)
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Проект: $ProjectRoot" -ForegroundColor Cyan

function Test-PortInUse {
    param([Parameter(Mandatory=$true)][int]$Port)
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        $listener.Stop()
        return $false
    } catch {
        return $true
    } finally {
        if ($listener) {
            try { $listener.Stop() } catch {}
        }
    }
}

function Get-ListeningPidsByPort {
    param([Parameter(Mandatory=$true)][int]$Port)
    try {
        $cons = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
        return @($cons | Select-Object -ExpandProperty OwningProcess -Unique)
    } catch {
        return @()
    }
}

function Restart-ServiceOnPort {
    param(
        [Parameter(Mandatory=$true)][int]$Port,
        [Parameter(Mandatory=$true)][string]$Name
    )
    $pids = Get-ListeningPidsByPort -Port $Port
    if ($pids.Count -gt 0) {
        Write-Host "$Name уже запущен на порту $Port. Останавливаю PID: $($pids -join ', ')" -ForegroundColor Yellow
        foreach ($procId in $pids) {
            try { Stop-Process -Id $procId -Force -ErrorAction Stop } catch {}
            try { taskkill /PID $procId /T /F | Out-Null } catch {}
        }
        $attempt = 0
        while ((Test-PortInUse -Port $Port) -and $attempt -lt 8) {
            Start-Sleep -Milliseconds 600
            $attempt++
            $left = Get-ListeningPidsByPort -Port $Port
            foreach ($leftPid in $left) {
                try { taskkill /PID $leftPid /T /F | Out-Null } catch {}
            }
        }
    }
}

function Wait-BackendReady {
    param(
        [Parameter(Mandatory=$true)][int]$Port,
        [int]$TimeoutSeconds = 25
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Method GET "http://127.0.0.1:$Port/" -TimeoutSec 2
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                return $true
            }
        } catch {}
        Start-Sleep -Milliseconds 700
    }
    return $false
}

# ---- BACKEND (FastAPI) ----
$BackendPath = Join-Path $ProjectRoot "backend"
if (-not (Test-Path $BackendPath)) {
    Write-Error "Папка 'backend' не найдена: $BackendPath"
    exit 1
}

Restart-ServiceOnPort -Port $BackendPort -Name "Backend"
if (Test-PortInUse -Port $BackendPort) {
    if (Wait-BackendReady -Port $BackendPort -TimeoutSeconds 4) {
        Write-Host "Порт $BackendPort занят и не освободился, но backend отвечает. Использую текущий процесс." -ForegroundColor Yellow
    } else {
        Write-Error "Порт $BackendPort занят и не освободился. Backend не запущен."
        exit 1
    }
} else {
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
    Write-Host "Ожидание готовности backend..." -ForegroundColor DarkCyan
    if (Wait-BackendReady -Port $BackendPort -TimeoutSeconds 25) {
        Write-Host "Backend готов к запросам." -ForegroundColor Green
    } else {
        Write-Host "Backend пока не ответил на health-check, продолжаю запуск frontend." -ForegroundColor Yellow
    }
}

# ---- FRONTEND (npm run server) ----
$FrontendPath = Join-Path $ProjectRoot "frontend"
if (-not (Test-Path $FrontendPath)) {
    Write-Error "Папка 'frontend' не найдена: $FrontendPath"
    exit 1
}

Restart-ServiceOnPort -Port $FrontendPort -Name "Frontend"
if (Test-PortInUse -Port $FrontendPort) {
    Write-Error "Порт $FrontendPort занят и не освободился. Frontend не запущен."
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



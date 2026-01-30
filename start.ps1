# Script para iniciar el sistema completo
# Inicia el backend y el frontend automáticamente

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Sistema de Gestión de Impresiones" -ForegroundColor Cyan
Write-Host "  Iniciando servicios..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que Node.js está instalado
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js detectado: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "✗ Node.js no está instalado" -ForegroundColor Red
    Write-Host "  Instala Node.js desde: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Verificar que PostgreSQL está corriendo
Write-Host ""
Write-Host "Verificando PostgreSQL..." -ForegroundColor Yellow
$env:PGPASSWORD = "1234"
$pgTest = & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d impresiones_db -c "SELECT 1;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ PostgreSQL conectado" -ForegroundColor Green
}
else {
    Write-Host "✗ No se pudo conectar a PostgreSQL" -ForegroundColor Red
    Write-Host "  Verifica que PostgreSQL esté corriendo" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "Iniciando servicios..." -ForegroundColor Cyan
Write-Host ""

# Iniciar backend en una nueva ventana de PowerShell
Write-Host "[1/2] Iniciando Backend API (Puerto 3000)..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend API' -ForegroundColor Green; npm start"

# Esperar un momento para que el backend inicie
Start-Sleep -Seconds 3

# Iniciar frontend en otra ventana de PowerShell
Write-Host "[2/2] Iniciando Frontend (Puerto 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; Write-Host 'Frontend React' -ForegroundColor Green; npm run dev"

# Esperar un momento
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ✓ SERVICIOS INICIADOS" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend API:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Frontend:" -ForegroundColor Cyan
Write-Host "  http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Para detener los servicios:" -ForegroundColor Yellow
Write-Host "  Cierra las ventanas de PowerShell que se abrieron" -ForegroundColor White
Write-Host ""

# Abrir el navegador automáticamente
Write-Host "Abriendo navegador..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "¡Listo! El sistema está funcionando." -ForegroundColor Green
Write-Host ""
Read-Host "Presiona Enter para cerrar esta ventana"

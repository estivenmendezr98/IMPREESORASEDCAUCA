# ============================================================================
# Script de Configuración de Base de Datos - Versión Mejorada
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Configuración de Base de Datos" -ForegroundColor Cyan
Write-Host "  Sistema de Gestión de Impresiones" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Buscar instalación de PostgreSQL
$pgVersions = @("18", "17", "16", "15", "14", "13")
$psqlPath = $null

foreach ($version in $pgVersions) {
    $testPath = "C:\Program Files\PostgreSQL\$version\bin\psql.exe"
    if (Test-Path $testPath) {
        $psqlPath = $testPath
        Write-Host "[OK] PostgreSQL $version encontrado" -ForegroundColor Green
        break
    }
}

if (-not $psqlPath) {
    Write-Host "[ERROR] No se encontró PostgreSQL instalado" -ForegroundColor Red
    Write-Host "Verifica que PostgreSQL esté instalado en: C:\Program Files\PostgreSQL\" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""

# Solicitar contraseña del usuario postgres
$securePassword = Read-Host "Ingresa la contraseña del usuario postgres" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
Write-Host ""

# Configurar variable de entorno para la contraseña
$env:PGPASSWORD = $password

try {
    # Verificar conexión
    Write-Host "[1/4] Verificando conexión a PostgreSQL..." -ForegroundColor Yellow
    $testConnection = & $psqlPath -U postgres -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo conectar a PostgreSQL. Verifica que la contraseña sea correcta y que el servicio esté corriendo."
    }
    Write-Host "[OK] Conexión exitosa" -ForegroundColor Green
    Write-Host ""

    # Crear base de datos
    Write-Host "[2/4] Creando base de datos impresiones_db..." -ForegroundColor Yellow
    
    # Eliminar base de datos si existe
    & $psqlPath -U postgres -c "DROP DATABASE IF EXISTS impresiones_db;" 2>&1 | Out-Null
    
    # Crear nueva base de datos
    $createDb = & $psqlPath -U postgres -c "CREATE DATABASE impresiones_db;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo crear la base de datos"
    }
    Write-Host "[OK] Base de datos creada" -ForegroundColor Green
    Write-Host ""

    # Ejecutar script de configuración
    Write-Host "[3/4] Ejecutando script de configuración..." -ForegroundColor Yellow
    $scriptPath = Join-Path $PSScriptRoot "setup_impresiones_db.sql"
    
    if (-not (Test-Path $scriptPath)) {
        throw "No se encontró el archivo setup_impresiones_db.sql en: $scriptPath"
    }
    
    $executeScript = & $psqlPath -U postgres -d impresiones_db -f $scriptPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $executeScript -ForegroundColor Red
        throw "Error al ejecutar el script de configuración"
    }
    Write-Host "[OK] Script ejecutado correctamente" -ForegroundColor Green
    Write-Host ""

    # Verificar instalación
    Write-Host "[4/4] Verificando instalación..." -ForegroundColor Yellow
    & $psqlPath -U postgres -d impresiones_db -c "\dt"
    Write-Host ""

    # Mensaje de éxito
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  CONFIGURACIÓN COMPLETADA EXITOSAMENTE" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Base de datos: " -NoNewline
    Write-Host "impresiones_db" -ForegroundColor Cyan
    Write-Host "Usuario: " -NoNewline
    Write-Host "postgres" -ForegroundColor Cyan
    Write-Host "Puerto: " -NoNewline
    Write-Host "5432" -ForegroundColor Cyan
    Write-Host "Host: " -NoNewline
    Write-Host "localhost" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Cadena de conexión:" -ForegroundColor Yellow
    Write-Host "postgresql://postgres:***@localhost:5432/impresiones_db" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Tablas creadas:" -ForegroundColor Yellow
    Write-Host "  - users" -ForegroundColor Cyan
    Write-Host "  - prints_raw" -ForegroundColor Cyan
    Write-Host "  - prints_monthly" -ForegroundColor Cyan
    Write-Host "  - import_log" -ForegroundColor Cyan
    Write-Host "  - printers" -ForegroundColor Cyan
    Write-Host "  - user_printer_assignments" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Datos de prueba insertados:" -ForegroundColor Yellow
    Write-Host "  - 3 usuarios demo" -ForegroundColor Cyan
    Write-Host "  - 6 impresoras de ejemplo" -ForegroundColor Cyan
    Write-Host "  - Datos de impresiones de ejemplo" -ForegroundColor Cyan
    Write-Host ""
    
    # Mostrar consultas de prueba
    Write-Host "Consultas de prueba:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ver usuarios:" -ForegroundColor White
    Write-Host "  & '$psqlPath' -U postgres -d impresiones_db -c 'SELECT * FROM users;'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Ver impresoras:" -ForegroundColor White
    Write-Host "  & '$psqlPath' -U postgres -d impresiones_db -c 'SELECT * FROM printers;'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Estadísticas del dashboard:" -ForegroundColor White
    Write-Host "  & '$psqlPath' -U postgres -d impresiones_db -c 'SELECT * FROM dashboard_stats();'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "[ERROR] $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifica que:" -ForegroundColor Yellow
    Write-Host "  1. El servicio de PostgreSQL está corriendo" -ForegroundColor Yellow
    Write-Host "  2. La contraseña es correcta" -ForegroundColor Yellow
    Write-Host "  3. El usuario postgres existe" -ForegroundColor Yellow
    Write-Host ""
} finally {
    # Limpiar la contraseña de la memoria
    $env:PGPASSWORD = $null
    $password = $null
}

Write-Host ""
Read-Host "Presiona Enter para salir"

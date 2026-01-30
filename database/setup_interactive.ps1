# ============================================================================
# Guía Paso a Paso para Crear la Base de Datos
# ============================================================================
# Ejecuta estos comandos uno por uno en PowerShell
# ============================================================================

Write-Host @"
============================================
  CONFIGURACIÓN DE BASE DE DATOS
  Guía Paso a Paso
============================================

Sigue estos pasos para crear la base de datos:

PASO 1: Crear la base de datos
-------------------------------
Ejecuta este comando (te pedirá la contraseña de postgres):

& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -c "CREATE DATABASE impresiones_db;"


PASO 2: Ejecutar el script de configuración
--------------------------------------------
Ejecuta este comando (te pedirá la contraseña de postgres):

& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d impresiones_db -f "$PSScriptRoot\setup_impresiones_db.sql"


PASO 3: Verificar la instalación
---------------------------------
Ejecuta este comando para ver las tablas creadas:

& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d impresiones_db -c "\dt"


PASO 4: Ver datos de prueba
----------------------------
Ver usuarios:
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d impresiones_db -c "SELECT * FROM users;"

Ver impresoras:
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d impresiones_db -c "SELECT * FROM printers;"

Ver estadísticas:
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d impresiones_db -c "SELECT * FROM dashboard_stats();"

============================================
"@

Write-Host ""
Write-Host "¿Quieres que ejecute estos pasos automáticamente? (S/N): " -NoNewline -ForegroundColor Yellow
$respuesta = Read-Host

if ($respuesta -eq "S" -or $respuesta -eq "s") {
    Write-Host ""
    Write-Host "Iniciando configuración automática..." -ForegroundColor Green
    Write-Host ""
    
    $psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
    
    # Solicitar contraseña
    Write-Host "Ingresa la contraseña del usuario postgres:" -ForegroundColor Yellow
    $password = Read-Host -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    
    # Configurar variable de entorno
    $env:PGPASSWORD = $plainPassword
    
    try {
        # Paso 1: Crear base de datos
        Write-Host ""
        Write-Host "[1/3] Creando base de datos..." -ForegroundColor Cyan
        & $psqlPath -U postgres -c "DROP DATABASE IF EXISTS impresiones_db;" 2>&1 | Out-Null
        & $psqlPath -U postgres -c "CREATE DATABASE impresiones_db;"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Base de datos creada exitosamente" -ForegroundColor Green
        } else {
            throw "Error al crear la base de datos"
        }
        
        # Paso 2: Ejecutar script
        Write-Host ""
        Write-Host "[2/3] Ejecutando script de configuración..." -ForegroundColor Cyan
        $scriptPath = Join-Path $PSScriptRoot "setup_impresiones_db.sql"
        & $psqlPath -U postgres -d impresiones_db -f $scriptPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Script ejecutado exitosamente" -ForegroundColor Green
        } else {
            throw "Error al ejecutar el script"
        }
        
        # Paso 3: Verificar
        Write-Host ""
        Write-Host "[3/3] Verificando instalación..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Tablas creadas:" -ForegroundColor Yellow
        & $psqlPath -U postgres -d impresiones_db -c "\dt"
        
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "  ✓ CONFIGURACIÓN COMPLETADA" -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Base de datos: impresiones_db" -ForegroundColor Cyan
        Write-Host "Usuario: postgres" -ForegroundColor Cyan
        Write-Host "Puerto: 5432" -ForegroundColor Cyan
        Write-Host "Host: localhost" -ForegroundColor Cyan
        Write-Host ""
        
    } catch {
        Write-Host ""
        Write-Host "ERROR: $_" -ForegroundColor Red
        Write-Host ""
    } finally {
        # Limpiar contraseña
        $env:PGPASSWORD = $null
        $plainPassword = $null
    }
} else {
    Write-Host ""
    Write-Host "Ejecuta los comandos manualmente siguiendo la guía anterior." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Presiona Enter para salir"

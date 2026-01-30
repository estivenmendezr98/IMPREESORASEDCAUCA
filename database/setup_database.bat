@echo off
REM ============================================================================
REM Script de Configuración Automática de la Base de Datos impresiones_db
REM ============================================================================
REM Este script crea la base de datos y ejecuta el script de configuración
REM Asegúrate de tener PostgreSQL instalado antes de ejecutar este script
REM ============================================================================

echo ============================================
echo   Configuracion de Base de Datos
echo   Sistema de Gestion de Impresiones
echo ============================================
echo.

REM Verificar si psql está disponible
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] PostgreSQL no esta instalado o no esta en el PATH
    echo.
    echo Por favor instala PostgreSQL primero:
    echo https://www.postgresql.org/download/windows/
    echo.
    echo O agrega PostgreSQL al PATH de Windows:
    echo C:\Program Files\PostgreSQL\15\bin
    echo.
    pause
    exit /b 1
)

echo [OK] PostgreSQL encontrado
echo.

REM Solicitar contraseña del usuario postgres
set /p PGPASSWORD="Ingresa la contrasena del usuario postgres: "
echo.

REM Exportar la contraseña como variable de entorno
set PGPASSWORD=%PGPASSWORD%

echo [1/4] Verificando conexion a PostgreSQL...
psql -U postgres -c "SELECT version();" >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo conectar a PostgreSQL
    echo Verifica que:
    echo   1. El servicio de PostgreSQL esta corriendo
    echo   2. La contrasena es correcta
    echo   3. El usuario postgres existe
    echo.
    pause
    exit /b 1
)
echo [OK] Conexion exitosa
echo.

echo [2/4] Creando base de datos impresiones_db...
psql -U postgres -c "DROP DATABASE IF EXISTS impresiones_db;" >nul 2>nul
psql -U postgres -c "CREATE DATABASE impresiones_db;"
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo crear la base de datos
    pause
    exit /b 1
)
echo [OK] Base de datos creada
echo.

echo [3/4] Ejecutando script de configuracion...
psql -U postgres -d impresiones_db -f "%~dp0setup_impresiones_db.sql"
if %errorlevel% neq 0 (
    echo [ERROR] Error al ejecutar el script de configuracion
    pause
    exit /b 1
)
echo [OK] Script ejecutado correctamente
echo.

echo [4/4] Verificando instalacion...
psql -U postgres -d impresiones_db -c "\dt"
echo.

echo ============================================
echo   CONFIGURACION COMPLETADA EXITOSAMENTE
echo ============================================
echo.
echo Base de datos: impresiones_db
echo Usuario: postgres
echo Puerto: 5432
echo Host: localhost
echo.
echo Cadena de conexion:
echo postgresql://postgres:TU_CONTRASENA@localhost:5432/impresiones_db
echo.
echo Tablas creadas:
echo   - users
echo   - prints_raw
echo   - prints_monthly
echo   - import_log
echo   - printers
echo   - user_printer_assignments
echo.
echo Datos de prueba insertados:
echo   - 3 usuarios demo
echo   - 6 impresoras de ejemplo
echo   - Datos de impresiones de ejemplo
echo.
echo ============================================

REM Limpiar la contraseña de la memoria
set PGPASSWORD=

echo.
echo Presiona cualquier tecla para salir...
pause >nul

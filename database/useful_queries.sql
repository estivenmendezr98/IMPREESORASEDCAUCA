-- ============================================================================
-- CONSULTAS ÚTILES PARA LA BASE DE DATOS impresiones_db
-- ============================================================================
-- Este archivo contiene consultas SQL útiles para administrar y consultar
-- la base de datos del sistema de gestión de impresiones
-- ============================================================================

-- ============================================================================
-- CONSULTAS BÁSICAS
-- ============================================================================

-- Ver todos los usuarios
SELECT * FROM users ORDER BY full_name;

-- Ver todas las impresoras
SELECT * FROM printers ORDER BY office, name;

-- Ver impresiones del mes actual
SELECT 
    u.full_name,
    pm.print_total,
    pm.copy_total,
    pm.scan_total
FROM prints_monthly pm
JOIN users u ON pm.user_id = u.id
WHERE pm.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND pm.month = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY pm.print_total DESC;

-- Ver historial de importaciones
SELECT 
    file_name,
    imported_at,
    rows_processed,
    rows_success,
    rows_failed
FROM import_log
ORDER BY imported_at DESC
LIMIT 10;

-- ============================================================================
-- CONSULTAS DE ESTADÍSTICAS
-- ============================================================================

-- Estadísticas generales del dashboard
SELECT * FROM dashboard_stats();

-- Totales por usuario (todos los usuarios)
SELECT * FROM total_by_user('{}');

-- Totales de un usuario específico
SELECT * FROM total_by_user('{"target_user_id": "demo-admin-001"}');

-- Detalle mensual de un usuario para el año actual
SELECT * FROM monthly_detail('demo-admin-001', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);

-- Detalle mensual de un usuario para un año específico
SELECT * FROM monthly_detail('demo-admin-001', 2024);

-- ============================================================================
-- CONSULTAS DE IMPRESORAS
-- ============================================================================

-- Todas las impresoras con conteo de usuarios
SELECT * FROM printers_by_office();

-- Impresoras de una oficina específica
SELECT * FROM printers_by_office('Oficina Central');

-- Usuarios asignados a una impresora (reemplaza el UUID con uno real)
SELECT * FROM users_by_printer('UUID_DE_LA_IMPRESORA');

-- Impresoras asignadas a un usuario
SELECT * FROM printers_by_user('demo-admin-001');

-- ============================================================================
-- CONSULTAS DE ANÁLISIS
-- ============================================================================

-- Top 10 usuarios con más impresiones
SELECT 
    u.full_name,
    u.office,
    u.department,
    SUM(pm.print_total) as total_impresiones,
    SUM(pm.copy_total) as total_copias
FROM users u
JOIN prints_monthly pm ON u.id = pm.user_id
GROUP BY u.id, u.full_name, u.office, u.department
ORDER BY total_impresiones DESC
LIMIT 10;

-- Impresiones por oficina
SELECT 
    u.office,
    COUNT(DISTINCT u.id) as num_usuarios,
    SUM(pm.print_total) as total_impresiones,
    SUM(pm.copy_total) as total_copias,
    SUM(pm.scan_total) as total_escaneos
FROM users u
JOIN prints_monthly pm ON u.id = pm.user_id
GROUP BY u.office
ORDER BY total_impresiones DESC;

-- Impresiones por departamento
SELECT 
    u.department,
    COUNT(DISTINCT u.id) as num_usuarios,
    SUM(pm.print_total) as total_impresiones,
    AVG(pm.print_total) as promedio_impresiones
FROM users u
JOIN prints_monthly pm ON u.id = pm.user_id
GROUP BY u.department
ORDER BY total_impresiones DESC;

-- Tendencia mensual de impresiones (últimos 6 meses)
SELECT 
    pm.year,
    pm.month,
    SUM(pm.print_total) as total_impresiones,
    SUM(pm.copy_total) as total_copias,
    COUNT(DISTINCT pm.user_id) as usuarios_activos
FROM prints_monthly pm
WHERE pm.year >= EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '6 months')
GROUP BY pm.year, pm.month
ORDER BY pm.year DESC, pm.month DESC;

-- Comparación mes actual vs mes anterior
WITH current_month AS (
    SELECT 
        SUM(print_total) as prints,
        SUM(copy_total) as copies
    FROM prints_monthly
    WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
      AND month = EXTRACT(MONTH FROM CURRENT_DATE)
),
previous_month AS (
    SELECT 
        SUM(print_total) as prints,
        SUM(copy_total) as copies
    FROM prints_monthly
    WHERE year = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
      AND month = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
)
SELECT 
    cm.prints as impresiones_mes_actual,
    pm.prints as impresiones_mes_anterior,
    cm.prints - pm.prints as diferencia_impresiones,
    ROUND((cm.prints::NUMERIC - pm.prints::NUMERIC) / NULLIF(pm.prints, 0) * 100, 2) as porcentaje_cambio
FROM current_month cm, previous_month pm;

-- ============================================================================
-- CONSULTAS DE MANTENIMIENTO
-- ============================================================================

-- Ver tamaño de las tablas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Contar registros en cada tabla
SELECT 
    'users' as tabla, COUNT(*) as registros FROM users
UNION ALL
SELECT 'prints_raw', COUNT(*) FROM prints_raw
UNION ALL
SELECT 'prints_monthly', COUNT(*) FROM prints_monthly
UNION ALL
SELECT 'import_log', COUNT(*) FROM import_log
UNION ALL
SELECT 'printers', COUNT(*) FROM printers
UNION ALL
SELECT 'user_printer_assignments', COUNT(*) FROM user_printer_assignments;

-- Ver índices de una tabla
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'prints_monthly';

-- ============================================================================
-- OPERACIONES DE INSERCIÓN
-- ============================================================================

-- Insertar un nuevo usuario
INSERT INTO users (id, email, full_name, office, department, status)
VALUES ('nuevo-usuario-001', 'nuevo@empresa.com', 'Nuevo Usuario', 'Oficina Central', 'IT', 'Normal');

-- Insertar una nueva impresora
INSERT INTO printers (name, ip_address, model, office, status, location_details)
VALUES ('Nueva Impresora', '192.168.1.200', 'HP LaserJet', 'Oficina Central', 'Active', 'Piso 3');

-- Asignar impresora a usuario
INSERT INTO user_printer_assignments (user_id, printer_id, is_primary, notes)
VALUES (
    'nuevo-usuario-001',
    (SELECT id FROM printers WHERE ip_address = '192.168.1.200'),
    true,
    'Impresora principal del usuario'
);

-- ============================================================================
-- OPERACIONES DE ACTUALIZACIÓN
-- ============================================================================

-- Actualizar información de usuario
UPDATE users
SET office = 'Nueva Oficina',
    department = 'Nuevo Departamento'
WHERE id = 'nuevo-usuario-001';

-- Cambiar estado de impresora
UPDATE printers
SET status = 'Maintenance'
WHERE ip_address = '192.168.1.200';

-- Actualizar impresora principal de un usuario
UPDATE user_printer_assignments
SET is_primary = false
WHERE user_id = 'nuevo-usuario-001';

UPDATE user_printer_assignments
SET is_primary = true
WHERE user_id = 'nuevo-usuario-001'
  AND printer_id = (SELECT id FROM printers WHERE ip_address = '192.168.1.200');

-- ============================================================================
-- OPERACIONES DE ELIMINACIÓN
-- ============================================================================

-- Eliminar asignación de impresora
DELETE FROM user_printer_assignments
WHERE user_id = 'nuevo-usuario-001'
  AND printer_id = (SELECT id FROM printers WHERE ip_address = '192.168.1.200');

-- Eliminar impresora (también elimina asignaciones por CASCADE)
DELETE FROM printers
WHERE ip_address = '192.168.1.200';

-- Eliminar usuario (también elimina datos relacionados por CASCADE)
DELETE FROM users
WHERE id = 'nuevo-usuario-001';

-- Limpiar datos antiguos (más de 2 años)
DELETE FROM prints_raw
WHERE report_timestamp < CURRENT_DATE - INTERVAL '2 years';

-- ============================================================================
-- CONSULTAS DE BACKUP Y RESTORE
-- ============================================================================

-- Exportar datos de usuarios a CSV (ejecutar desde psql)
-- \copy users TO 'c:/backup/users.csv' WITH CSV HEADER;

-- Exportar datos de impresoras a CSV
-- \copy printers TO 'c:/backup/printers.csv' WITH CSV HEADER;

-- Importar datos de usuarios desde CSV
-- \copy users FROM 'c:/backup/users.csv' WITH CSV HEADER;

-- ============================================================================
-- CONSULTAS DE DIAGNÓSTICO
-- ============================================================================

-- Ver usuarios sin datos de impresión
SELECT u.*
FROM users u
LEFT JOIN prints_monthly pm ON u.id = pm.user_id
WHERE pm.id IS NULL;

-- Ver impresoras sin usuarios asignados
SELECT p.*
FROM printers p
LEFT JOIN user_printer_assignments upa ON p.id = upa.printer_id
WHERE upa.id IS NULL;

-- Ver usuarios con múltiples impresoras primarias (error de datos)
SELECT user_id, COUNT(*) as num_primarias
FROM user_printer_assignments
WHERE is_primary = true
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Ver duplicados en prints_monthly (no debería haber)
SELECT user_id, year, month, COUNT(*)
FROM prints_monthly
GROUP BY user_id, year, month
HAVING COUNT(*) > 1;

-- ============================================================================
-- FIN DEL ARCHIVO
-- ============================================================================

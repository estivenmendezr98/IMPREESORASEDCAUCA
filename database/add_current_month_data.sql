-- Script para agregar datos del mes actual (Diciembre 2025)
-- Esto hará que las estadísticas del dashboard muestren valores

-- Agregar datos mensuales para diciembre 2025
INSERT INTO prints_monthly (user_id, year, month, print_total, print_color, print_mono, copy_total, copy_color, copy_mono, scan_total, fax_total)
VALUES 
  ('demo-admin-001', 2025, 12, 450, 180, 270, 320, 120, 200, 85, 15),
  ('demo-user-001', 2025, 12, 280, 100, 180, 190, 70, 120, 45, 8),
  ('demo-user-002', 2025, 12, 310, 120, 190, 210, 80, 130, 55, 12)
ON CONFLICT (user_id, year, month) DO UPDATE SET
  print_total = EXCLUDED.print_total,
  print_color = EXCLUDED.print_color,
  print_mono = EXCLUDED.print_mono,
  copy_total = EXCLUDED.copy_total,
  copy_color = EXCLUDED.copy_color,
  copy_mono = EXCLUDED.copy_mono,
  scan_total = EXCLUDED.scan_total,
  fax_total = EXCLUDED.fax_total,
  updated_at = now();

-- Agregar algunos datos raw para diciembre 2025
INSERT INTO prints_raw (user_id, report_timestamp, account_status, print_total, print_color, print_mono, copy_total, copy_color, copy_mono, scan_total, fax_total)
VALUES 
  ('demo-admin-001', '2025-12-01 10:00:00', 'Normal', 150, 60, 90, 100, 40, 60, 30, 5),
  ('demo-admin-001', '2025-12-15 14:30:00', 'Normal', 300, 120, 180, 220, 80, 140, 55, 10),
  ('demo-user-001', '2025-12-05 09:15:00', 'Normal', 100, 35, 65, 70, 25, 45, 20, 3),
  ('demo-user-001', '2025-12-20 16:45:00', 'Normal', 180, 65, 115, 120, 45, 75, 25, 5),
  ('demo-user-002', '2025-12-10 11:20:00', 'Normal', 120, 45, 75, 80, 30, 50, 25, 4),
  ('demo-user-002', '2025-12-22 13:00:00', 'Normal', 190, 75, 115, 130, 50, 80, 30, 8);

-- Verificar los datos insertados
SELECT 
  'Datos mensuales de diciembre 2025' as descripcion,
  COUNT(*) as registros,
  SUM(print_total) as total_impresiones,
  SUM(copy_total) as total_copias
FROM prints_monthly 
WHERE year = 2025 AND month = 12;

-- Ver estadísticas del dashboard
SELECT * FROM dashboard_stats();

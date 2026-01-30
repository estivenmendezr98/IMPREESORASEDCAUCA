# Diagrama de la Base de Datos: impresiones_db

## Esquema de Relaciones

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SISTEMA DE GESTIÓN DE IMPRESIONES               │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│     USERS        │
├──────────────────┤
│ id (PK)          │◄──────────┐
│ status           │           │
│ email            │           │
│ full_name        │           │
│ office           │           │
│ department       │           │
│ created_at       │           │
│ updated_at       │           │
└──────────────────┘           │
        ▲                      │
        │                      │
        │                      │
        │                      │
┌───────┴──────────┐    ┌──────┴─────────────┐
│  PRINTS_RAW      │    │  PRINTS_MONTHLY    │
├──────────────────┤    ├────────────────────┤
│ id (PK)          │    │ id (PK)            │
│ user_id (FK)     │    │ user_id (FK)       │
│ report_timestamp │    │ year               │
│ account_status   │    │ month              │
│ print_total      │    │ print_total        │
│ print_color      │    │ print_color        │
│ print_mono       │    │ print_mono         │
│ copy_total       │    │ copy_total         │
│ copy_color       │    │ copy_color         │
│ copy_mono        │    │ copy_mono          │
│ scan_total       │    │ scan_total         │
│ fax_total        │    │ fax_total          │
│ import_batch_id  │    │ print_total_diff   │
│ created_at       │    │ copy_total_diff    │
└──────────────────┘    │ scan_total_diff    │
                        │ fax_total_diff     │
                        │ created_at         │
                        │ updated_at         │
                        └────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    IMPORT_LOG                                 │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ file_name                                                     │
│ batch_id                                                      │
│ imported_at                                                   │
│ rows_processed                                                │
│ rows_success                                                  │
│ rows_failed                                                   │
│ error_details (JSONB)                                         │
│ imported_by                                                   │
│ created_at                                                    │
│ updated_at                                                    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────┐
│    PRINTERS      │
├──────────────────┤
│ id (PK)          │◄──────────┐
│ name             │           │
│ ip_address       │           │
│ model            │           │
│ office           │           │
│ status           │           │
│ location_details │           │
│ created_at       │           │
│ updated_at       │           │
└──────────────────┘           │
        ▲                      │
        │                      │
        │                      │
        │                      │
        │    ┌─────────────────┴──────────────────┐
        │    │  USER_PRINTER_ASSIGNMENTS          │
        │    ├────────────────────────────────────┤
        │    │ id (PK)                            │
        │    │ user_id (FK) ──────────────────────┼──► USERS
        └────┼─ printer_id (FK)                   │
             │ assigned_at                        │
             │ assigned_by                        │
             │ is_primary                         │
             │ notes                              │
             └────────────────────────────────────┘
```

## Relaciones

### 1. USERS → PRINTS_RAW (1:N)
- Un usuario puede tener múltiples registros de impresión raw
- Relación: `prints_raw.user_id` → `users.id`
- Eliminación: CASCADE (si se elimina un usuario, se eliminan sus registros)

### 2. USERS → PRINTS_MONTHLY (1:N)
- Un usuario puede tener múltiples registros mensuales
- Relación: `prints_monthly.user_id` → `users.id`
- Eliminación: CASCADE

### 3. USERS ↔ PRINTERS (N:M)
- Relación muchos a muchos a través de `user_printer_assignments`
- Un usuario puede usar múltiples impresoras
- Una impresora puede ser usada por múltiples usuarios
- Relación: `user_printer_assignments.user_id` → `users.id`
- Relación: `user_printer_assignments.printer_id` → `printers.id`
- Eliminación: CASCADE en ambas direcciones

## Índices Optimizados

```
PRINTS_RAW:
  - idx_prints_raw_user_timestamp (user_id, report_timestamp)

PRINTS_MONTHLY:
  - idx_prints_monthly_user_date (user_id, year, month)
  - UNIQUE constraint (user_id, year, month)

IMPORT_LOG:
  - idx_import_log_batch (batch_id)

USERS:
  - idx_users_status (status)

PRINTERS:
  - idx_printers_office (office)
  - idx_printers_status (status)
  - idx_printers_ip (ip_address)
  - UNIQUE constraint (ip_address)

USER_PRINTER_ASSIGNMENTS:
  - idx_user_printer_user (user_id)
  - idx_user_printer_printer (printer_id)
  - UNIQUE constraint (user_id, printer_id)
```

## Funciones RPC

### 1. dashboard_stats()
Retorna estadísticas generales del sistema:
- Total de usuarios
- Usuarios activos en el mes actual
- Total de impresiones del mes
- Total de copias del mes
- Fecha de última importación

### 2. total_by_user(params jsonb)
Retorna totales acumulados por usuario:
- Total de impresiones
- Total de copias
- Total de escaneos
- Total de faxes
- Última actividad

**Parámetros:**
```json
{
  "target_user_id": "usuario-id" // opcional
}
```

### 3. monthly_detail(target_user_id text, target_year integer)
Retorna detalle mensual de un usuario específico:
- Datos por mes (1-12)
- Totales de impresiones, copias, escaneos
- Diferencias vs mes anterior

### 4. printers_by_office(target_office text)
Retorna impresoras agrupadas por oficina:
- Información completa de la impresora
- Conteo de usuarios asignados

### 5. users_by_printer(target_printer_id uuid)
Retorna usuarios asignados a una impresora:
- Información del usuario
- Si es impresora primaria
- Fecha de asignación
- Notas

### 6. printers_by_user(target_user_id text)
Retorna impresoras asignadas a un usuario:
- Información de la impresora
- Si es impresora primaria
- Fecha de asignación

## Triggers Automáticos

Todas las tablas con campo `updated_at` tienen un trigger que actualiza automáticamente este campo en cada UPDATE:

- `update_users_updated_at`
- `update_prints_monthly_updated_at`
- `update_printers_updated_at`
- `update_import_log_updated_at`

## Flujo de Datos

```
┌─────────────────┐
│  Importación    │
│  de CSV         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  IMPORT_LOG     │      │  USERS           │
│  (registro)     │      │  (crear/update)  │
└─────────────────┘      └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  PRINTS_RAW      │
                         │  (datos brutos)  │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  PRINTS_MONTHLY  │
                         │  (agregación)    │
                         └──────────────────┘
```

## Tipos de Datos Especiales

### JSONB (error_details en import_log)
Almacena detalles de errores en formato JSON:
```json
{
  "errors": [
    {
      "row": 15,
      "field": "print_total",
      "error": "Invalid number format"
    }
  ]
}
```

### UUID
Usado para IDs únicos en:
- prints_raw.id
- prints_monthly.id
- import_log.id
- printers.id
- user_printer_assignments.id

### TIMESTAMPTZ
Timestamps con zona horaria en todos los campos de fecha/hora

## Restricciones (Constraints)

### CHECK Constraints
```sql
-- En PRINTERS
status CHECK (status IN ('Active', 'Inactive', 'Maintenance'))
```

### UNIQUE Constraints
```sql
-- En PRINTERS
UNIQUE(ip_address)

-- En PRINTS_MONTHLY
UNIQUE(user_id, year, month)

-- En USER_PRINTER_ASSIGNMENTS
UNIQUE(user_id, printer_id)
```

### FOREIGN KEY Constraints
Todas las relaciones tienen ON DELETE CASCADE para mantener integridad referencial.

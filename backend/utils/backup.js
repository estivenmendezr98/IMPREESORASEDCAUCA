
export const generateDatabaseExport = async (pool) => {
    const client = await pool.connect();
    try {
        let sqlContent = '';
        let totalRecords = 0;

        sqlContent += `-- =====================================================\n`;
        sqlContent += `-- EXPORTACIÓN COMPLETA BASE DE DATOS SEDCAUCA\n`;
        sqlContent += `-- Sistema de Gestión de Impresiones\n`;
        sqlContent += `-- Fecha: ${new Date().toISOString()}\n`;
        sqlContent += `-- =====================================================\n\n`;

        // 1. Esquema
        sqlContent += `-- =====================================================\n`;
        sqlContent += `-- ESQUEMA DE BASE DE DATOS\n`;
        sqlContent += `-- =====================================================\n\n`;

        // Función update timestamp
        sqlContent += `CREATE OR REPLACE FUNCTION update_updated_at_column()\n`;
        sqlContent += `RETURNS TRIGGER AS $$\n`;
        sqlContent += `BEGIN\n`;
        sqlContent += `    NEW.updated_at = now();\n`;
        sqlContent += `    RETURN NEW;\n`;
        sqlContent += `END;\n`;
        sqlContent += `$$ language 'plpgsql';\n\n`;

        const tableSchemas = {
            users: `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    status text DEFAULT 'Normal'::text NOT NULL,
    email text,
    full_name text,
    office text,
    department text,
    role text DEFAULT 'user'::text,
    password_hash text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);`,
            prints_raw: `CREATE TABLE IF NOT EXISTS prints_raw (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    report_timestamp timestamptz NOT NULL,
    account_status text,
    print_total integer DEFAULT 0,
    print_color integer DEFAULT 0,
    print_mono integer DEFAULT 0,
    copy_total integer DEFAULT 0,
    copy_color integer DEFAULT 0,
    copy_mono integer DEFAULT 0,
    scan_total integer DEFAULT 0,
    fax_total integer DEFAULT 0,
    import_batch_id uuid,
    created_at timestamptz DEFAULT now()
);`,
            prints_monthly: `CREATE TABLE IF NOT EXISTS prints_monthly (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    print_total integer DEFAULT 0,
    print_color integer DEFAULT 0,
    print_mono integer DEFAULT 0,
    copy_total integer DEFAULT 0,
    copy_color integer DEFAULT 0,
    copy_mono integer DEFAULT 0,
    scan_total integer DEFAULT 0,
    fax_total integer DEFAULT 0,
    print_total_diff integer DEFAULT 0,
    copy_total_diff integer DEFAULT 0,
    scan_total_diff integer DEFAULT 0,
    fax_total_diff integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, year, month)
);`,
            printers: `CREATE TABLE IF NOT EXISTS printers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    ip_address text UNIQUE NOT NULL,
    model text NOT NULL,
    office text,
    status text DEFAULT 'Active'::text CHECK (status IN ('Active', 'Inactive', 'Maintenance')),
    location_details text,
    serial text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);`,
            user_printer_assignments: `CREATE TABLE IF NOT EXISTS user_printer_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    printer_id uuid NOT NULL,
    assigned_at timestamptz DEFAULT now(),
    assigned_by uuid,
    is_primary boolean DEFAULT false,
    notes text,
    UNIQUE(user_id, printer_id)
);`,
            import_log: `CREATE TABLE IF NOT EXISTS import_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name text NOT NULL,
    batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    imported_at timestamptz DEFAULT now(),
    rows_processed integer DEFAULT 0,
    rows_success integer DEFAULT 0,
    rows_failed integer DEFAULT 0,
    error_details jsonb,
    imported_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);`
        };

        for (const [tableName, schema] of Object.entries(tableSchemas)) {
            sqlContent += `-- Tabla: ${tableName}\n${schema}\n\n`;
        }

        // 2. Datos
        sqlContent += `-- =====================================================\n`;
        sqlContent += `-- DATOS\n`;
        sqlContent += `-- =====================================================\n\n`;

        const tables = Object.keys(tableSchemas);

        for (const tableName of tables) {
            const { rows } = await client.query(`SELECT * FROM ${tableName} ORDER BY created_at ASC`);

            if (rows.length > 0) {
                totalRecords += rows.length;
                sqlContent += `-- Datos de tabla: ${tableName} (${rows.length} registros)\n`;
                sqlContent += `DELETE FROM ${tableName};\n`;

                const columns = Object.keys(rows[0]);
                const columnsList = columns.join(', ');

                for (const row of rows) {
                    const values = columns.map(col => {
                        const val = row[col];
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                        if (typeof val === 'boolean') return val ? 'true' : 'false';
                        if (val instanceof Date) return `'${val.toISOString()}'`;
                        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                        return val;
                    }).join(', ');
                    sqlContent += `INSERT INTO ${tableName} (${columnsList}) VALUES (${values});\n`;
                }
                sqlContent += '\n';
            }
        }

        return { sqlContent, totalRecords };

    } finally {
        client.release();
    }
};

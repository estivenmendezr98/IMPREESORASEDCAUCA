
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

        // 1. Obtener lista de tablas
        const resTables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);
        const tables = resTables.rows.map(r => r.table_name);

        // 2. Funciones y Triggers (Simplificado - Solo la función de update timestamp por ahora si es standard)
        // Idealmente podríamos hacer queries a pg_proc pero es complejo reconstruir el DDL. 
        // Mantenemos la función helper genérica.
        sqlContent += `-- =====================================================\n`;
        sqlContent += `-- FUNCIONES DE UTILIDAD\n`;
        sqlContent += `-- =====================================================\n\n`;

        sqlContent += `CREATE OR REPLACE FUNCTION update_updated_at_column()\n`;
        sqlContent += `RETURNS TRIGGER AS $$\n`;
        sqlContent += `BEGIN\n`;
        sqlContent += `    NEW.updated_at = now();\n`;
        sqlContent += `    RETURN NEW;\n`;
        sqlContent += `END;\n`;
        sqlContent += `$$ language 'plpgsql';\n\n`;

        // 3. Esquema de Tablas (DDL Dinámico básico o estático mejorado)
        // Para "totalmente completo", lo mejor es usar pg_dump, pero en node puro 
        // reconstruir DDL perfecto es difícil. Mantendremos el schema hardcoded 
        // PERO agregaremos lógica para advertir si hay tablas nuevas no mapeadas.

        // Mapeo manual para asegurar restricciones correctas que information_schema no da fácil (PKs, FKs, Checks)
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
    status text DEFAULT 'completed',
    total_rows integer DEFAULT 0,
    error_details jsonb,
    imported_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);`
        };

        sqlContent += `-- =====================================================\n`;
        sqlContent += `-- ESQUEMA DE TABLAS\n`;
        sqlContent += `-- =====================================================\n\n`;

        for (const tableName of tables) {
            if (tableSchemas[tableName]) {
                sqlContent += `-- Tabla: ${tableName}\n${tableSchemas[tableName]}\n\n`;
            } else {
                sqlContent += `-- ADVERTENCIA: Tabla '${tableName}' detectada pero sin definición de esquema manual.\n`;
                // Intento genérico de dump (menos preciso)
                sqlContent += `-- Por seguridad se omite el CREATE TABLE automático para evitar errores de tipos.\n\n`;
            }
        }

        // 4. Datos (Iterar sobre TODAS las tablas encontradas, no solo las hardcoded)
        sqlContent += `-- =====================================================\n`;
        sqlContent += `-- DATOS DE TABLAS\n`;
        sqlContent += `-- =====================================================\n\n`;

        // Orden de inserción para respetar FKs (simple: users primero)
        const sortedTables = tables.sort((a, b) => {
            if (a === 'users') return -1;
            if (b === 'users') return 1;
            return 0;
        });

        for (const tableName of sortedTables) {
            // Determinar columna de ordenamiento
            let orderCol = 'created_at';
            // Verificar si la columna existe antes de ordenar
            const resCol = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = 'created_at'
            `, [tableName]);

            if (resCol.rowCount === 0) {
                if (tableName === 'user_printer_assignments') orderCol = 'assigned_at';
                else orderCol = null; // Sin orden
            }

            const query = orderCol
                ? `SELECT * FROM ${tableName} ORDER BY ${orderCol} ASC`
                : `SELECT * FROM ${tableName}`;

            const { rows } = await client.query(query);

            if (rows.length > 0) {
                totalRecords += rows.length;
                sqlContent += `-- Datos de tabla: ${tableName} (${rows.length} registros)\n`;

                // Generar DELETE para limpiar tabla antes de insertar
                sqlContent += `DELETE FROM ${tableName};\n`;

                const columns = Object.keys(rows[0]);
                const columnsList = columns.map(c => `"${c}"`).join(', '); // Quote identifiers

                for (const row of rows) {
                    const values = columns.map(col => {
                        const val = row[col];
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                        if (typeof val === 'boolean') return val ? 'true' : 'false';
                        if (val instanceof Date) return `'${val.toISOString()}'`;
                        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                        // Arrays en postgres
                        if (Array.isArray(val)) return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
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

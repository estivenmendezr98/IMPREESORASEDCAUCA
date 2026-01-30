const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function setupTestData() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('📝 Creando usuario de prueba...');
        await client.query(
            'INSERT INTO users (id, status, full_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET full_name = $3',
            ['test-delete-imports', 'Normal', 'Usuario de Prueba para Eliminar']
        );

        console.log('📊 Creando registro de importación...');
        await client.query(
            `INSERT INTO import_log (file_name, batch_id, imported_by, rows_processed, rows_success, rows_failed) 
       VALUES ($1, gen_random_uuid(), $2, 10, 10, 0)`,
            ['test_file.csv', 'test-delete-imports']
        );

        await client.query('COMMIT');
        console.log('✅ Usuario de prueba creado con registro de importación');

        // Verificar que se creó
        const logs = await pool.query('SELECT * FROM import_log WHERE imported_by = $1', ['test-delete-imports']);
        console.log(`📋 Registros de import_log encontrados: ${logs.rows.length}`);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

setupTestData();

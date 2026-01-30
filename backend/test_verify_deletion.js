const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function verifyDeletion() {
    try {
        const logs = await pool.query('SELECT * FROM import_log WHERE imported_by = $1', ['test-delete-imports']);
        console.log(`📋 Registros de import_log después de eliminar: ${logs.rows.length}`);

        if (logs.rows.length === 0) {
            console.log('✅ ÉXITO: Los registros de import_log fueron eliminados correctamente');
        } else {
            console.log('❌ ERROR: Los registros de import_log NO fueron eliminados');
            console.log('Registros encontrados:', logs.rows);
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await pool.end();
    }
}

verifyDeletion();

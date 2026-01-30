import pg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pg;
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'impresiones_db',
    user: 'postgres',
    password: '1234'
});

async function test() {
    console.log('🧪 Iniciando prueba de eliminación de importación...');

    const batchId = '00000000-0000-0000-0000-000000000000';
    const userId = 'demo-admin-001';

    try {
        // 1. Insertar datos de prueba
        console.log('📝 Insertando datos de prueba...');
        await pool.query('INSERT INTO import_log (file_name, batch_id, imported_at, rows_processed, rows_success) VALUES ($1, $2, NOW(), 1, 1)', ['test.csv', batchId]);

        // Simular que ya hay datos en monthly para este usuario (para ver si resta)
        const initialResult = await pool.query('SELECT print_total FROM prints_monthly WHERE user_id = $1 AND year = 2024 AND month = 12', [userId]);
        const initialPrints = initialResult.rows[0]?.print_total || 0;
        console.log(`📊 Impresiones iniciales del mes: ${initialPrints}`);

        await pool.query(`
            INSERT INTO prints_raw (user_id, report_timestamp, print_total, import_batch_id)
            VALUES ($1, '2024-12-01 10:00:00+00', 100, $2)
        `, [userId, batchId]);

        await pool.query(`
            UPDATE prints_monthly SET print_total = print_total + 100
            WHERE user_id = $1 AND year = 2024 AND month = 12
        `, [userId]);

        const midResult = await pool.query('SELECT print_total FROM prints_monthly WHERE user_id = $1 AND year = 2024 AND month = 12', [userId]);
        console.log(`📊 Impresiones tras inserción (+100): ${midResult.rows[0].print_total}`);

        // 2. Llamar a la API para borrar
        console.log('📡 Llamando a la API de eliminación...');
        const response = await fetch(`http://localhost:3000/api/imports/${batchId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        console.log('✅ Respuesta API:', result);

        // 3. Verificar resultados
        const finalMonthly = await pool.query('SELECT print_total FROM prints_monthly WHERE user_id = $1 AND year = 2024 AND month = 12', [userId]);
        console.log(`📊 Impresiones finales (debería ser ${initialPrints}): ${finalMonthly.rows[0].print_total}`);

        const rawCount = await pool.query('SELECT count(*) FROM prints_raw WHERE import_batch_id = $1', [batchId]);
        const logCount = await pool.query('SELECT count(*) FROM import_log WHERE batch_id = $1', [batchId]);

        console.log(`🔍 Registros raw restantes: ${rawCount.rows[0].count}`);
        console.log(`🔍 Logs restantes: ${logCount.rows[0].count}`);

        if (finalMonthly.rows[0].print_total == initialPrints && rawCount.rows[0].count == 0 && logCount.rows[0].count == 0) {
            console.log('✨ PRUEBA EXITOSA ✨');
        } else {
            console.error('❌ PRUEBA FALLIDA');
        }

    } catch (error) {
        console.error('❌ Error durante la prueba:', error);
    } finally {
        await pool.end();
    }
}

test();

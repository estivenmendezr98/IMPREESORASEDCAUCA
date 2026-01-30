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

const API_URL = 'http://localhost:3000/api';

async function deepTest() {
    console.log('🚀 Iniciando PRUEBAS PROFUNDAS de eliminación de importaciones...');

    const userId = 'deep-test-user-' + Date.now();
    const batch1 = '00000000-0000-0000-0000-000000000001';
    const batch2 = '00000000-0000-0000-0000-000000000002';

    try {
        // PREPARACIÓN: Crear usuario de prueba
        console.log(`👤 Creando usuario de prueba: ${userId}`);
        await pool.query('INSERT INTO users (id, full_name, status) VALUES ($1, $2, $3)', [userId, 'Deep Test User', 'Normal']);

        // ESCENARIO 1: Múltiples importaciones en el mismo mes
        console.log('\n--- Escenario 1: Múltiples importaciones en el mismo mes ---');

        // Import 1: 100 impresiones en Dic 2024
        console.log('📥 Importando Lote 1 (100 impresiones)...');
        await pool.query('INSERT INTO import_log (file_name, batch_id, imported_at, rows_processed, rows_success) VALUES ($1, $2, NOW(), 1, 1)', ['file1.csv', batch1]);
        await pool.query(`INSERT INTO prints_raw (user_id, report_timestamp, print_total, import_batch_id) VALUES ($1, '2024-12-01 10:00:00+00', 100, $2)`, [userId, batch1]);
        await pool.query(`INSERT INTO prints_monthly (user_id, year, month, print_total) VALUES ($1, 2024, 12, 100) ON CONFLICT (user_id, year, month) DO UPDATE SET print_total = prints_monthly.print_total + 100`, [userId]);

        // Import 2: 50 impresiones en Dic 2024
        console.log('📥 Importando Lote 2 (50 impresiones)...');
        await pool.query('INSERT INTO import_log (file_name, batch_id, imported_at, rows_processed, rows_success) VALUES ($1, $2, NOW(), 1, 1)', ['file2.csv', batch2]);
        await pool.query(`INSERT INTO prints_raw (user_id, report_timestamp, print_total, import_batch_id) VALUES ($1, '2024-12-02 10:00:00+00', 50, $2)`, [userId, batch2]);
        await pool.query(`INSERT INTO prints_monthly (user_id, year, month, print_total) VALUES ($1, 2024, 12, 50) ON CONFLICT (user_id, year, month) DO UPDATE SET print_total = prints_monthly.print_total + 50`, [userId]);

        let res = await pool.query('SELECT print_total FROM prints_monthly WHERE user_id = $1 AND year = 2024 AND month = 12', [userId]);
        console.log(`📊 Total mensual (esperado 150): ${res.rows[0].print_total}`);

        // Borrar Lote 1
        console.log('🗑️ Eliminando Lote 1 (100 impressions)...');
        await fetch(`${API_URL}/imports/${batch1}`, { method: 'DELETE' });

        res = await pool.query('SELECT print_total FROM prints_monthly WHERE user_id = $1 AND year = 2024 AND month = 12', [userId]);
        console.log(`📊 Total mensual tras borrar Lote 1 (esperado 50): ${res.rows[0].print_total}`);

        if (res.rows[0].print_total != 50) throw new Error('Escenario 1 fallido');

        // ESCENARIO 2: Importación que abarca múltiples meses
        console.log('\n--- Escenario 2: Importación que abarca múltiples meses ---');
        const batchMulti = '00000000-0000-0000-0000-000000000003';

        // Import 3: 200 en Nov, 300 en Oct
        console.log('📥 Importando Lote Multi-Mes (200 Nov, 300 Oct)...');
        await pool.query('INSERT INTO import_log (file_name, batch_id, imported_at, rows_processed, rows_success) VALUES ($1, $2, NOW(), 2, 2)', ['multi.csv', batchMulti]);

        await pool.query(`INSERT INTO prints_raw (user_id, report_timestamp, print_total, import_batch_id) VALUES ($1, '2024-11-01 10:00:00+00', 200, $2)`, [userId, batchMulti]);
        await pool.query(`INSERT INTO prints_monthly (user_id, year, month, print_total) VALUES ($1, 2024, 11, 200) ON CONFLICT (user_id, year, month) DO UPDATE SET print_total = prints_monthly.print_total + 200`, [userId]);

        await pool.query(`INSERT INTO prints_raw (user_id, report_timestamp, print_total, import_batch_id) VALUES ($1, '2024-10-01 10:00:00+00', 300, $2)`, [userId, batchMulti]);
        await pool.query(`INSERT INTO prints_monthly (user_id, year, month, print_total) VALUES ($1, 2024, 10, 300) ON CONFLICT (user_id, year, month) DO UPDATE SET print_total = prints_monthly.print_total + 300`, [userId]);

        let resNov = await pool.query('SELECT print_total FROM prints_monthly WHERE user_id = $1 AND year = 2024 AND month = 11', [userId]);
        let resOct = await pool.query('SELECT print_total FROM prints_monthly WHERE user_id = $1 AND year = 2024 AND month = 10', [userId]);
        console.log(`📊 Total Nov (200): ${resNov.rows[0].print_total}, Total Oct (300): ${resOct.rows[0].print_total}`);

        // Borrar Lote Multi
        console.log('🗑️ Eliminando Lote Multi-Mes...');
        await fetch(`${API_URL}/imports/${batchMulti}`, { method: 'DELETE' });

        resNov = await pool.query('SELECT print_total FROM prints_monthly WHERE user_id = $1 AND year = 2024 AND month = 11', [userId]);
        resOct = await pool.query('SELECT print_total FROM prints_monthly WHERE user_id = $1 AND year = 2024 AND month = 10', [userId]);
        console.log(`📊 Total Nov (esperado 0): ${resNov.rows[0]?.print_total || 0}, Total Oct (esperado 0): ${resOct.rows[0]?.print_total || 0}`);

        if ((resNov.rows[0]?.print_total || 0) != 0 || (resOct.rows[0]?.print_total || 0) != 0) throw new Error('Escenario 2 fallido');

        // ESCENARIO 3: Prevención de valores negativos
        console.log('\n--- Escenario 3: Prevención de valores negativos ---');
        const batchEdge = '00000000-0000-0000-0000-000000000004';

        // Simular que alguien borró datos de monthly manualmente pero el raw aún existe
        console.log('📥 Preparando lote con raw > monthly...');
        await pool.query('INSERT INTO import_log (file_name, batch_id, imported_at, rows_processed, rows_success) VALUES ($1, $2, NOW(), 1, 1)', ['edge.csv', batchEdge]);
        await pool.query(`INSERT INTO prints_raw (user_id, report_timestamp, print_total, import_batch_id) VALUES ($1, '2024-09-01 10:00:00+00', 1000, $2)`, [userId, batchEdge]);
        await pool.query(`INSERT INTO prints_monthly (user_id, year, month, print_total) VALUES ($1, 2024, 09, 100) ON CONFLICT (user_id, year, month) DO UPDATE SET print_total = 100`, [userId]);

        console.log('🗑️ Eliminando lote (intentando restar 1000 de 100)...');
        await fetch(`${API_URL}/imports/${batchEdge}`, { method: 'DELETE' });

        let resSep = await pool.query('SELECT print_total FROM prints_monthly WHERE user_id = $1 AND year = 2024 AND month = 09', [userId]);
        console.log(`📊 Total Sep (esperado 0, no -900): ${resSep.rows[0].print_total}`);

        if (resSep.rows[0].print_total != 0) throw new Error('Escenario 3 fallido');

        // LIMPIEZA
        console.log('\n🧹 Limpiando datos de prueba...');
        await pool.query('DELETE FROM prints_monthly WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        await pool.query('DELETE FROM import_log WHERE file_name IN ($1, $2, $3, $4)', ['file1.csv', 'file2.csv', 'multi.csv', 'edge.csv']);

        console.log('\n✨ TODAS LAS PRUEBAS PROFUNDAS PASARON EXITOSAMENTE ✨');

    } catch (error) {
        console.error('\n❌ ERROR EN LAS PRUEBAS:', error.message);
    } finally {
        await pool.end();
    }
}

deepTest();

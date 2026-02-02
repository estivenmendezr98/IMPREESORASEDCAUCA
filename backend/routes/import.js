import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const router = express.Router();
const { Pool } = pg;

// Configuración de PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'impresiones_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

// Configuración de multer para archivos temporales
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos CSV'));
        }
    }
});



import { startImport } from '../services/importLogic.js';

// ... (imports remain)

// POST /api/imports/upload - Importar archivo CSV (Asíncrono)
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
        }

        console.log('📁 Procesando archivo:', req.file.originalname);

        const fileContent = fs.readFileSync(req.file.path, 'utf-8');
        const { customDate } = req.body;

        const { batchId, totalRows } = await startImport(
            pool,
            req.file.originalname,
            fileContent,
            customDate,
            req.file.path
        );

        res.json({
            success: true,
            message: 'Importación iniciada en segundo plano',
            batchId: batchId,
            totalRows: totalRows
        });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }
        console.error('❌ Error iniciando importación:', error);
        res.status(500).json({
            success: false,
            error: 'Error iniciando importación',
            details: error.message
        });
    }
});



// GET /api/imports/status/:batchId - Verificar estado de importación
router.get('/status/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await pool.query(
            'SELECT batch_id, status, rows_processed, rows_success, rows_failed, total_rows, error_details FROM import_log WHERE batch_id = $1',
            [batchId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Batch no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error obteniendo estado de importación:', error);
        res.status(500).json({ error: 'Error verificando estado' });
    }
});

// GET /api/imports/log - Obtener historial de importaciones
router.get('/log', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = `
            SELECT i.*, u.full_name as importer_name, u.email as importer_email
            FROM import_log i
            LEFT JOIN users u ON i.imported_by = u.id
        `;
        const params = [];

        if (startDate && endDate) {
            query += ' WHERE i.imported_at >= $1 AND i.imported_at <= $2';
            params.push(startDate, endDate);
        }

        query += ' ORDER BY i.imported_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo log de importaciones:', error);
        res.status(500).json({ error: 'Error obteniendo historial' });
    }
});

// PUT /api/imports/:batchId/date - Cambiar fecha de una importación
router.put('/:batchId/date', async (req, res) => {
    const { batchId } = req.params;
    const { newDate } = req.body; // YYYY-MM-DD

    if (!newDate) {
        return res.status(400).json({ error: 'Se requiere newDate' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log(`📅 Cambiando fecha de batch ${batchId} a ${newDate}`);

        // 1. Actualizar fecha en import_log (solo informativo/ordenamiento)
        // Se usa la hora actual o se mantiene la hora original de importación?
        // Mantengamos la hora de importación pero con la nueva fecha para consistencia visual
        await client.query(`
            UPDATE import_log 
            SET imported_at = ($2::date + (imported_at::time)) 
            WHERE batch_id = $1
        `, [batchId, newDate]);


        // 2. Actualizar report_timestamp en prints_raw
        // Esto cambia la fecha de los datos, manteniendo la hora original del reporte
        const updateRawResult = await client.query(`
            UPDATE prints_raw
            SET report_timestamp = ($2::date + (report_timestamp::time))
            WHERE import_batch_id = $1
        `, [batchId, newDate]);

        console.log(`✅ Actualizados ${updateRawResult.rowCount} registros en prints_raw`);


        // 3. Recalcular Estadísticas (Monthly)
        // Como daily_stats no existe, regeneramos prints_monthly directamente desde prints_raw

        console.log('🔄 Regenerando estadísticas mensuales...');

        await client.query('TRUNCATE TABLE prints_monthly RESTART IDENTITY');

        // Regenerar prints_monthly desde prints_raw agrupando por usuario y mes
        await client.query(`
            INSERT INTO prints_monthly(
            user_id, year, month,
            print_total, print_color, print_mono,
            copy_total, copy_color, copy_mono,
            scan_total, fax_total
        )
            SELECT 
                user_id,
            EXTRACT(YEAR FROM report_timestamp):: integer as year,
            EXTRACT(MONTH FROM report_timestamp):: integer as month,
            SUM(print_total) as print_total,
            SUM(print_color) as print_color,
            SUM(print_mono) as print_mono,
            SUM(copy_total) as copy_total,
            SUM(copy_color) as copy_color,
            SUM(copy_mono) as copy_mono,
            SUM(scan_total) as scan_total,
            SUM(fax_total) as fax_total
            FROM prints_raw
            GROUP BY user_id, EXTRACT(YEAR FROM report_timestamp), EXTRACT(MONTH FROM report_timestamp)
            `);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Fecha actualizada y estadísticas regeneradas',
            recordsUpdated: updateRawResult.rowCount
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error cambiando fecha:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// DELETE /api/imports/:batchId - Eliminar una importación y revertir sus datos
router.delete('/:batchId', async (req, res) => {
    const { batchId } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verificar si está en proceso
        const checkStatus = await client.query('SELECT status FROM import_log WHERE batch_id = $1', [batchId]);
        if (checkStatus.rows.length > 0 && checkStatus.rows[0].status === 'processing') {
            // Permitimos, pero logueamos advertencia.
            console.warn(`⚠️ Eliminando batch ${batchId} que está en estado 'processing'.`);
        }

        console.log(`🗑️ Iniciando reversión de importación: ${batchId}`);

        // 1. Obtener todos los registros raw de este batch para saber qué restar
        const rawRecordsResult = await client.query(
            'SELECT user_id, report_timestamp, print_total, print_color, print_mono, copy_total, copy_color, copy_mono, scan_total, fax_total FROM prints_raw WHERE import_batch_id = $1',
            [batchId]
        );

        const records = rawRecordsResult.rows;

        // 2. Por cada registro, restar los valores en prints_monthly
        for (const record of records) {
            const date = new Date(record.report_timestamp);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;

            await client.query(`
                UPDATE prints_monthly SET
                    print_total = GREATEST(0, print_total - $1),
            print_color = GREATEST(0, print_color - $2),
            print_mono = GREATEST(0, print_mono - $3),
            copy_total = GREATEST(0, copy_total - $4),
            copy_color = GREATEST(0, copy_color - $5),
            copy_mono = GREATEST(0, copy_mono - $6),
            scan_total = GREATEST(0, scan_total - $7),
            fax_total = GREATEST(0, fax_total - $8),
            updated_at = NOW()
                WHERE user_id = $9 AND year = $10 AND month = $11
            `, [
                record.print_total, record.print_color, record.print_mono,
                record.copy_total, record.copy_color, record.copy_mono,
                record.scan_total, record.fax_total,
                record.user_id, year, month
            ]);
        }

        // 3. Eliminar registros de prints_raw
        const deleteRawResult = await client.query(
            'DELETE FROM prints_raw WHERE import_batch_id = $1',
            [batchId]
        );

        // 4. Eliminar el log de importación
        const deleteLogResult = await client.query(
            'DELETE FROM import_log WHERE batch_id = $1',
            [batchId]
        );

        await client.query('COMMIT');

        console.log(`✅ Importación ${batchId} eliminada.`);

        res.json({
            success: true,
            message: 'Importación eliminada y datos revertidos correctamente',
            rawDeleted: deleteRawResult.rowCount
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error eliminando importación:', error);
        res.status(500).json({
            success: false,
            error: 'Error eliminando importación',
            details: error.message
        });
    } finally {
        client.release();
    }
});

// GET /api/imports/batch/:id - Obtener detalles de un lote
router.get('/batch/:id', async (req, res) => {
    try {
        const batchId = req.params.id;

        const query = `
            SELECT 
                pr.user_id,
            pr.print_total,
            pr.copy_total,
            pr.scan_total,
            pr.report_timestamp,
            u.office,
            u.full_name
            FROM prints_raw pr
            LEFT JOIN users u ON pr.user_id = u.id
            WHERE pr.import_batch_id = $1
            ORDER BY pr.user_id
            `;

        const result = await pool.query(query, [batchId]);

        const data = result.rows.map(row => ({
            user_id: row.user_id,
            print_total: row.print_total,
            copy_total: row.copy_total,
            scan_total: row.scan_total,
            report_timestamp: row.report_timestamp,
            users: {
                full_name: row.full_name,
                office: row.office
            }
        }));

        res.json(data);
    } catch (error) {
        console.error('Error obteniendo detalles del batch:', error);
        res.status(500).json({ error: 'Error obteniendo detalles' });
    }
});

export default router;

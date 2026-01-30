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

// Función para parsear fecha en formato español (d/M/yyyy H:mm:ss a. m./p. m.)
// Función para parsear fecha en formato español (d/M/yyyy H:mm:ss a. m./p. m.)
function parseSpanishDate(dateStr) {
    try {
        if (!dateStr) return new Date();

        // Limpiar caracteres invisibles y normalizar espacios
        let cleanDate = dateStr.trim().replace(/\s+/g, ' ');

        // Manejar formatos DD/MM/YYYY o YYYY/MM/DD o YYYY-MM-DD
        // Si no tiene hora, asumiremos 12:00:00 para evitar problemas de dia
        if (!cleanDate.includes(':') && !cleanDate.includes(' ')) {
            cleanDate += ' 12:00:00';
        }

        let meridiem = null;
        if (/p\.?\s*m\.?/i.test(cleanDate)) {
            meridiem = 'PM';
            cleanDate = cleanDate.replace(/p\.?\s*m\.?/i, '').trim();
        } else if (/a\.?\s*m\.?/i.test(cleanDate)) {
            meridiem = 'AM';
            cleanDate = cleanDate.replace(/a\.?\s*m\.?/i, '').trim();
        }

        const parts = cleanDate.split(' ');
        const datePart = parts[0];
        const timePart = parts[1] || '12:00:00';

        // Intentar parsear fecha d/m/y
        let day, month, year;
        if (datePart.includes('/')) {
            const dateBits = datePart.split('/');
            // Asumimos d/m/y si el primer bit es <= 31 y el segundo <= 12
            if (parseInt(dateBits[0]) > 31) {
                // Probablemente y/m/d
                [year, month, day] = dateBits.map(n => parseInt(n));
            } else {
                [day, month, year] = dateBits.map(n => parseInt(n));
            }
        } else if (datePart.includes('-')) {
            const dateBits = datePart.split('-');
            if (dateBits[0].length === 4) {
                [year, month, day] = dateBits.map(n => parseInt(n));
            } else {
                [day, month, year] = dateBits.map(n => parseInt(n));
            }
        }

        const timeBits = timePart.split(':');
        let hour = parseInt(timeBits[0]) || 0;
        const minutes = parseInt(timeBits[1]) || 0;
        const seconds = parseInt(timeBits[2]) || 0;

        if (meridiem === 'PM' && hour !== 12) hour += 12;
        if (meridiem === 'AM' && hour === 12) hour = 0;

        if (isNaN(day) || isNaN(month) || isNaN(year)) {
            console.warn('⚠️ Fecha inválida detectada (usando actual):', dateStr);
            return new Date();
        }

        return new Date(year, month - 1, day, hour, minutes, seconds);
    } catch (error) {
        console.error('Error parseando fecha:', dateStr, error);
        return new Date();
    }
}

// Función para limpiar y convertir valores numéricos
function cleanNumber(value) {
    if (!value || value === '""' || value === '') return 0;
    const cleaned = value.replace(/"/g, '').trim();
    return parseInt(cleaned) || 0;
}

// Función para limpiar strings
function cleanString(value) {
    if (!value) return '';
    return value.replace(/"/g, '').trim();
}

// POST /api/imports/upload - Importar archivo CSV
router.post('/upload', upload.single('file'), async (req, res) => {
    const client = await pool.connect();

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
        }

        console.log('📁 Procesando archivo:', req.file.originalname);

        // Leer archivo
        const fileContent = fs.readFileSync(req.file.path, 'utf-8');

        // Parsear CSV con separador de punto y coma
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            delimiter: ';',
            relax_column_count: true,
            bom: true // Manejar BOM de UTF-8
        });

        console.log(`📊 Registros encontrados: ${records.length}`);

        // Generar batch ID para esta importación
        const batchId = crypto.randomUUID();
        const fileName = req.file.originalname;

        let rowsProcessed = 0;
        let rowsSuccess = 0;
        let rowsFailed = 0;
        const errors = [];

        // NO usar transacción para todo el loop - cada registro es independiente
        // Esto evita que un error en un registro aborte toda la transacción

        const { customDate } = req.body;
        console.log(`📊 Date strategy: ${customDate ? 'Custom Date (' + customDate + ')' : 'From CSV timestamp'}`);

        for (const [index, record] of records.entries()) {
            try {
                rowsProcessed++;

                // Extraer datos del registro
                const userId = cleanString(record['ID de la cuenta']);
                const accountStatus = cleanString(record['Estado de la cuenta']);
                const printTotal = cleanNumber(record['Imprimir (total)']);
                const printColor = cleanNumber(record['Imprimir (a todo color)']);
                const printMono = cleanNumber(record['Imprimir (blanco y negro)']);
                const copyTotal = cleanNumber(record['Copia (total)']);
                const copyColor = cleanNumber(record['Copia (a todo color)']);
                const copyMono = cleanNumber(record['Copia (blanco y negro)']);
                const scanTotal = cleanNumber(record['Escanear (total)']);
                const faxTotal = cleanNumber(record['Recibir FAX']);

                // Determinamos la fecha: customDate (si existe) o la del CSV
                let timestamp;
                if (customDate) {
                    // Ajuste para evitar problemas de zona horaria con fechas YYYY-MM-DD
                    // Al usar new Date('2025-01-01') en UTC puede dar día anterior local.
                    // Pero para reportes de mes, lo importante es el año/mes.
                    // Usaremos la fecha tal cual + hora 12:00 para estar seguros en el dia.
                    timestamp = new Date(customDate + 'T12:00:00');
                } else {
                    timestamp = parseSpanishDate(cleanString(record['Marca de tiempo']));
                }

                // Validar que tengamos al menos un user_id
                if (!userId) {
                    errors.push({ row: index + 2, error: 'ID de cuenta vacío' });
                    rowsFailed++;
                    continue;
                }

                // 1. Crear o actualizar usuario
                await client.query(`
          INSERT INTO users (id, status, created_at, updated_at)
          VALUES ($1, $2, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = NOW()
        `, [userId, accountStatus || 'Normal']);

                // 2. Insertar datos raw
                await client.query(`
          INSERT INTO prints_raw (
            user_id, report_timestamp, account_status,
            print_total, print_color, print_mono,
            copy_total, copy_color, copy_mono,
            scan_total, fax_total,
            import_batch_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        `, [
                    userId, timestamp, accountStatus,
                    printTotal, printColor, printMono,
                    copyTotal, copyColor, copyMono,
                    scanTotal, faxTotal,
                    batchId
                ]);

                // 3. Actualizar datos mensuales
                const year = timestamp.getFullYear();
                const month = timestamp.getMonth() + 1;

                await client.query(`
          INSERT INTO prints_monthly (
            user_id, year, month,
            print_total, print_color, print_mono,
            copy_total, copy_color, copy_mono,
            scan_total, fax_total,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          ON CONFLICT (user_id, year, month) DO UPDATE SET
            print_total = prints_monthly.print_total + EXCLUDED.print_total,
            print_color = prints_monthly.print_color + EXCLUDED.print_color,
            print_mono = prints_monthly.print_mono + EXCLUDED.print_mono,
            copy_total = prints_monthly.copy_total + EXCLUDED.copy_total,
            copy_color = prints_monthly.copy_color + EXCLUDED.copy_color,
            copy_mono = prints_monthly.copy_mono + EXCLUDED.copy_mono,
            scan_total = prints_monthly.scan_total + EXCLUDED.scan_total,
            fax_total = prints_monthly.fax_total + EXCLUDED.fax_total,
            updated_at = NOW()
        `, [
                    userId, year, month,
                    printTotal, printColor, printMono,
                    copyTotal, copyColor, copyMono,
                    scanTotal, faxTotal
                ]);

                rowsSuccess++;
            } catch (error) {
                console.error(`Error en fila ${index + 2}:`, error.message);
                errors.push({ row: index + 2, error: error.message });
                rowsFailed++;
            }
        }

        // 4. Registrar importación en log
        // Si hay customDate, usamos esa fecha para el log (para que aparezca en el calendario correcto)
        // Si no, usamos fecha actual
        const logDate = customDate ? new Date(customDate + 'T12:00:00') : new Date();

        await client.query(`
      INSERT INTO import_log (
        file_name, batch_id, imported_at,
        rows_processed, rows_success, rows_failed,
        error_details, created_at, updated_at
      ) VALUES ($1, $2, $7, $3, $4, $5, $6, NOW(), NOW())
    `, [
            fileName, batchId,
            rowsProcessed, rowsSuccess, rowsFailed,
            JSON.stringify(errors.slice(0, 100)), // Limitar errores guardados
            logDate
        ]);

        // Eliminar archivo temporal
        fs.unlinkSync(req.file.path);

        console.log(`✅ Importación completada: ${rowsSuccess}/${rowsProcessed} registros`);

        res.json({
            success: true,
            message: 'Importación completada',
            stats: {
                fileName,
                batchId,
                rowsProcessed,
                rowsSuccess,
                rowsFailed,
                errors: errors.slice(0, 10) // Devolver solo primeros 10 errores
            }
        });

    } catch (error) {
        // Eliminar archivo temporal si existe
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('❌ Error en importación:', error);
        res.status(500).json({
            success: false,
            error: 'Error procesando archivo CSV',
            details: error.message
        });
    } finally {
        client.release();
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

// DELETE /api/imports/:batchId - Eliminar una importación y revertir sus datos
router.delete('/:batchId', async (req, res) => {
    const { batchId } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log(`🗑️ Iniciando reversión de importación: ${batchId}`);

        // 1. Obtener todos los registros raw de este batch para saber qué restar
        const rawRecordsResult = await client.query(
            'SELECT user_id, report_timestamp, print_total, print_color, print_mono, copy_total, copy_color, copy_mono, scan_total, fax_total FROM prints_raw WHERE import_batch_id = $1',
            [batchId]
        );

        const records = rawRecordsResult.rows;
        console.log(`📊 Encontrados ${records.length} registros para revertir`);

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

        console.log(`✅ Importación ${batchId} eliminada. Raw eliminados: ${deleteRawResult.rowCount}`);

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

        // Transformar para matchear lo que espera el frontend
        const data = result.rows.map(row => ({
            user_id: row.user_id,
            print_total: row.print_total,
            copy_total: row.copy_total,
            scan_total: row.scan_total,
            report_timestamp: row.report_timestamp,
            // Estructura anidada simulada si es necesario, pero podemos devolver plano
            // El componente CalendarView original esperaba: users!inner(full_name, office)
            // Adaptaremos el frontend para usar propiedades planas o reconstruir objeto.
            // Para simplificar, devolvemos plano y en el frontend mapeamos.
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

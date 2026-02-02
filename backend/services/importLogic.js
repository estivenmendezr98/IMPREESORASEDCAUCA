
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import fs from 'fs';

// Helper functions
function parseSpanishDate(dateStr) {
    try {
        if (!dateStr) return new Date();

        let cleanDate = dateStr.trim().replace(/\s+/g, ' ');

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

        let day, month, year;
        if (datePart.includes('/')) {
            const dateBits = datePart.split('/');
            if (parseInt(dateBits[0]) > 31) {
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
            return new Date();
        }

        return new Date(year, month - 1, day, hour, minutes, seconds);
    } catch (error) {
        return new Date();
    }
}

function cleanNumber(value) {
    if (!value || value === '""' || value === '') return 0;
    const cleaned = value.replace(/"/g, '').trim();
    return parseInt(cleaned) || 0;
}

function cleanString(value) {
    if (!value) return '';
    return value.replace(/"/g, '').trim();
}

/**
 * Parses raw CSV content and returns records + totalRows
 */
export function parseCSV(fileContent) {
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ';',
        relax_column_count: true,
        bom: true
    });
    return { records, totalRows: records.length };
}

/**
 * Starts an import process (creates log entry and kicks off async processing)
 * @param {Pool} pool - Database pool
 * @param {string} fileName - Name of the file
 * @param {string} csvContent - Raw CSV content
 * @param {string|null} customDate - Optional custom date (YYYY-MM-DD)
 * @param {string|null} filePath - Optional path to delete after processing
 * @returns {Promise<string>} batchId
 */
export async function startImport(pool, fileName, csvContent, customDate = null, filePath = null) {
    const { records, totalRows } = parseCSV(csvContent);
    const batchId = crypto.randomUUID();
    const client = await pool.connect();

    try {
        const logDate = customDate ? new Date(customDate + 'T12:00:00') : new Date();

        await client.query(`
            INSERT INTO import_log (
                file_name, batch_id, imported_at,
                rows_processed, rows_success, rows_failed, total_rows,
                status, error_details, created_at, updated_at
            ) VALUES ($1, $2, $3, 0, 0, 0, $4, 'processing', '[]', NOW(), NOW())
        `, [fileName, batchId, logDate, totalRows]);

        // Trigger Async Processing (Fire and forget)
        processImportBackground(pool, batchId, records, customDate, filePath);

        return { batchId, totalRows };
    } finally {
        client.release();
    }
}

/**
 * Background processing logic
 */
async function processImportBackground(pool, batchId, records, customDate, filePath) {
    const client = await pool.connect();
    let rowsProcessed = 0;
    let rowsSuccess = 0;
    let rowsFailed = 0;
    const errors = [];
    const UPDATE_INTERVAL = 20;

    try {
        for (const [index, record] of records.entries()) {
            rowsProcessed++;

            try {
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

                let timestamp;
                if (customDate) {
                    timestamp = new Date(customDate + 'T12:00:00');
                } else {
                    timestamp = parseSpanishDate(cleanString(record['Marca de tiempo']));
                }

                if (!userId) {
                    throw new Error('ID de cuenta vacío');
                }

                // 1. Upsert User
                await client.query(`
                    INSERT INTO users (id, status, created_at, updated_at)
                    VALUES ($1, $2, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        updated_at = NOW()
                 `, [userId, accountStatus || 'Normal']);

                // 2. Insert Raw
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

                // 3. Update Monthly
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

            } catch (err) {
                console.error(`Error fila ${index + 2}:`, err.message);
                errors.push({ row: index + 2, error: err.message });
                rowsFailed++;
            }

            if (rowsProcessed % UPDATE_INTERVAL === 0) {
                await client.query(`
                    UPDATE import_log SET
                        rows_processed = $1,
                        rows_success = $2,
                        rows_failed = $3,
                        updated_at = NOW()
                    WHERE batch_id = $4
                 `, [rowsProcessed, rowsSuccess, rowsFailed, batchId]);
            }
        }

        await client.query(`
            UPDATE import_log SET
                rows_processed = $1,
                rows_success = $2,
                rows_failed = $3,
                status = 'completed',
                error_details = $4,
                updated_at = NOW()
            WHERE batch_id = $5
        `, [
            rowsProcessed,
            rowsSuccess,
            rowsFailed,
            JSON.stringify(errors.slice(0, 100)),
            batchId
        ]);

        console.log(`✅ Batch ${batchId} completado. Success: ${rowsSuccess}, Failed: ${rowsFailed}`);

    } catch (fatalError) {
        console.error(`❌ Error fatal en batch ${batchId}:`, fatalError);
        await client.query(`
            UPDATE import_log SET
                status = 'failed',
                error_details = $1,
                updated_at = NOW()
            WHERE batch_id = $2
        `, [JSON.stringify([{ error: fatalError.message }]), batchId]);
    } finally {
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { }
        }
        client.release();
    }
}

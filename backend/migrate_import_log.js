import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar dotenv para leer el archivo .env del directorio actual o padre
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'impresiones_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Iniciando migración de import_log...');

        // Agregar columna status si no existe
        await client.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE import_log ADD COLUMN status TEXT DEFAULT 'completed';
                EXCEPTION
                    WHEN duplicate_column THEN RAISE NOTICE 'column status already exists in import_log.';
                END;
            END;
            $$;
        `);

        // Agregar columna total_rows si no existe
        await client.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE import_log ADD COLUMN total_rows INTEGER DEFAULT 0;
                EXCEPTION
                    WHEN duplicate_column THEN RAISE NOTICE 'column total_rows already exists in import_log.';
                END;
            END;
            $$;
        `);

        console.log('Migración completada exitosamente.');
    } catch (error) {
        console.error('Error durante la migración:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();

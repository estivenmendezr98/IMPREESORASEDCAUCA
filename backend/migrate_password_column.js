import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'impresiones_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Adding password_hash column to users table...');

        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='users' AND column_name='password_hash') THEN
                    ALTER TABLE users ADD COLUMN password_hash TEXT;
                    RAISE NOTICE 'Column added';
                ELSE
                    RAISE NOTICE 'Column already exists';
                END IF;
            END $$;
        `);

        console.log('Migration completed successfully.');
    } catch (e) {
        console.error('Error running migration:', e);
    } finally {
        client.release();
        pool.end();
    }
}

run();


import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'impresiones_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function migrate() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT,
        is_encrypted BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Insert default values if not exists
        await pool.query(`
      INSERT INTO system_config (key, value)
      VALUES 
        ('gmail_label', 'CSV-Imports'),
        ('check_interval_minutes', '15'),
        ('is_active', 'false')
      ON CONFLICT (key) DO NOTHING;
    `);

        console.log('Table system_config created and defaults inserted.');
    } catch (err) {
        console.error('Error creating system_config:', err);
    } finally {
        pool.end();
    }
}

migrate();

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

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration...');

        // Check if column exists
        const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='role';
    `);

        if (res.rows.length === 0) {
            console.log('Adding role column...');
            await client.query("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';");
            console.log('Role column added.');

            // Update existing admin demos
            await client.query("UPDATE users SET role = 'admin' WHERE id LIKE '%admin%';");
            console.log('Updated demo admins.');
        } else {
            console.log('Role column already exists.');
        }

        console.log('Migration complete.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();

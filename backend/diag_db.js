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
        console.log('Connected to DB');

        // Check columns
        const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
        console.log('Columns in users table:', cols.rows.map(r => r.column_name).join(', '));

        const roleColLimit = cols.rows.find(c => c.column_name === 'role');
        if (!roleColLimit) {
            console.error('CRITICAL: role column MISSING!');
        } else {
            console.log('role column exists.');
        }

        // Check Users
        const res = await client.query("SELECT id, full_name, role FROM users WHERE role = 'admin' OR id LIKE '%admin%'");
        console.log('Admin users found:', res.rowCount);
        console.log('Admins:', res.rows);

        if (res.rowCount === 0) {
            console.log('No admins found. Inserting default admin...');
            await client.query(`
        INSERT INTO users (id, email, full_name, office, department, status, role)
        VALUES ('demo-admin-001', 'admin@demo.com', 'Admin Demo', 'Oficina Principal', 'Administración', 'Normal', 'admin')
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
      `);
            console.log('Default admin inserted/updated.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        pool.end();
    }
}

run();

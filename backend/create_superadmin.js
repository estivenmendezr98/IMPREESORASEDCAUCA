import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
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
        console.log('Creating Super Admin...');

        const email = 'estivenmendezr@gmail.com';
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if exists
        const res = await client.query('SELECT * FROM users WHERE email = $1', [email]);

        if (res.rowCount > 0) {
            console.log('User already exists. Updating role and password...');
            await client.query(
                "UPDATE users SET role = 'superadmin', full_name = 'Estiven Mendez', password_hash = $1 WHERE email = $2",
                [hashedPassword, email]
            );
        } else {
            console.log('Inserting new superadmin...');
            await client.query(`
        INSERT INTO users (id, email, full_name, office, department, status, role, password_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [`superadmin-${Date.now()}`, email, 'Estiven Mendez', 'Dirección General', 'Sistemas', 'Normal', 'superadmin', hashedPassword]);
        }

        console.log('Super Admin created/updated successfully.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        pool.end();
    }
}

run();

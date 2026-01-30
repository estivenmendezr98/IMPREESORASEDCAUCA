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

        const email = 'estivenmendezr@gmail.com';
        const fullName = 'Estiven Mendez';

        console.log(`Checking if user ${email} exists...`);
        const res = await client.query('SELECT * FROM users WHERE email = $1', [email]);

        if (res.rows.length > 0) {
            console.log('User exists. Updating role to superadmin...');
            await client.query("UPDATE users SET role = 'superadmin', full_name = $1 WHERE email = $2", [fullName, email]);
            console.log('User updated successfully.');
        } else {
            console.log('User does not exist. Creating new superadmin user...');
            // ID format doesn't strictly matter based on server.js but let's follow convention
            const id = `admin-${Date.now()}`;
            await client.query(
                "INSERT INTO users (id, email, full_name, role, office, department, status) VALUES ($1, $2, $3, 'superadmin', 'Gerencia', 'TI', 'Normal')",
                [id, email, fullName]
            );
            console.log('User created successfully.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        pool.end();
    }
}

run();

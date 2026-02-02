
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

async function checkRoles() {
    try {
        const res = await pool.query('SELECT id, full_name, email, role FROM users');
        console.log('Users and Roles:');
        res.rows.forEach(u => {
            console.log(`${u.full_name} (${u.email}): '${u.role}'`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkRoles();

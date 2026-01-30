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
        console.log('Updating existing users with default password hash...');

        // Default password: "admin123"
        const saltRounds = 10;
        const defaultPassword = 'admin123';
        const hash = await bcrypt.hash(defaultPassword, saltRounds);

        // Update all users who don't have a password hash yet
        const result = await client.query(`
            UPDATE users 
            SET password_hash = $1 
            WHERE password_hash IS NULL
        `, [hash]);

        console.log(`Updated ${result.rowCount} users with default password: ${defaultPassword}`);

    } catch (e) {
        console.error('Error updating passwords:', e);
    } finally {
        client.release();
        pool.end();
    }
}

run();

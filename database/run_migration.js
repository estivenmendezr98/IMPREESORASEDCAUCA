
const fs = require('fs');
const pg = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend .env if it exists
const backendEnvPath = path.resolve(__dirname, '../backend/.env');
if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
} else {
    // Try root .env
    dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const { Pool } = pg;

// Configuration matching server.js defaults
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'impresiones_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD, // This might be empty if relying on peer auth or no password, but ideally set in env
});

async function runMigration() {
    try {
        const sqlPath = path.resolve(__dirname, 'add_serial_column.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Connecting to database...');
        const client = await pool.connect();
        console.log('Connected.');

        console.log('Executing migration...');
        await client.query(sql);
        console.log('Migration executed successfully.');

        client.release();
        process.exit(0);
    } catch (err) {
        console.error('Error running migration:', err);
        process.exit(1);
    }
}

runMigration();

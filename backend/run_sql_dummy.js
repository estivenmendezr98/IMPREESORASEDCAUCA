const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config(); // Loads .env from current dir by default

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function run() {
    try {
        const sqlPath = path.join(__dirname, '../database/create_dummy_user.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Executing SQL...');
        await pool.query(sql);
        console.log('Dummy user created successfully.');
    } catch (err) {
        console.error('Error executing SQL:', err);
    } finally {
        await pool.end();
    }
}

run();

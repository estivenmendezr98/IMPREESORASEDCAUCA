
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

async function checkSchema() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'prints_monthly'
    `);
        console.log('Columns in prints_monthly:');
        res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkSchema();

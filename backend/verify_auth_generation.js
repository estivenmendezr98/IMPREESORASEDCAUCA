
import pg from 'pg';
import dotenv from 'dotenv';
import GmailService from './services/gmail.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'impresiones_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function run() {
    try {
        console.log('Testing GmailService...');
        const service = new GmailService(pool);

        console.log('Initializing...');
        // Mock data
        const clientId = 'test-client-id.apps.googleusercontent.com';
        const clientSecret = 'test-client-secret';

        console.log('Generating Auth URL...');
        const url = await service.generateAuthUrl(clientId, clientSecret);

        console.log('✅ Success! URL generated:');
        console.log(url.substring(0, 50) + '...');

        // Verify Config was saved
        const savedId = await service.getConfig('gmail_client_id');
        console.log('Saved Client ID:', savedId);

    } catch (error) {
        console.error('❌ Failed:', error);
    } finally {
        pool.end();
    }
}

run();

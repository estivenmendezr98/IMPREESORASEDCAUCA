
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
// Since server.js starts the server on import unless handled, we might need a way to export 'app' without listening
// For now, let's assume we can import it or hit the localhost URL if it's running.
// BUT, hitting localhost (E2E style) is safer if we don't want to refactor server.js right now.
// Let's test against the running server for now to minimize code changes.

const BASE_URL = 'http://localhost:3000/api';

describe('Authentication API', () => {
    let token;

    it('should fail login with wrong credentials', async () => {
        const res = await request(BASE_URL)
            .post('/login')
            .send({ email: 'estivenmendezr@gmail.com', password: 'wrongpassword' });

        expect(res.status).toBe(401);
    });

    it('should login successfully with correct credentials', async () => {
        const res = await request(BASE_URL)
            .post('/login')
            .send({ email: 'estivenmendezr@gmail.com', password: 'admin123' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('session');
        expect(res.body.session).toHaveProperty('access_token');
        token = res.body.session.access_token;
    });

    // Note: We haven't implemented middleware verification on ALL routes yet, 
    // but the login logic itself is secured.
    // If we had middleware, we would test protected access here.
});

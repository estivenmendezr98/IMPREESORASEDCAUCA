
import { describe, it, expect } from 'vitest';
import request from 'supertest';

const BASE_URL = 'http://localhost:3000/api';

describe('User Management API', () => {
    it('should list all users', async () => {
        const res = await request(BASE_URL).get('/users');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('should include superadmin user', async () => {
        const res = await request(BASE_URL).get('/users');
        const admin = res.body.find(u => u.email === 'estivenmendezr@gmail.com');
        expect(admin).toBeDefined();
        // Since we didn't wipe the DB, validation depends on previous steps
    });
});

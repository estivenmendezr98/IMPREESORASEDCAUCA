
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

const BASE_URL = 'http://localhost:3000/api';

describe('Reports & Export API', () => {
    let token;

    // Get token first
    beforeAll(async () => {
        const res = await request(BASE_URL)
            .post('/login')
            .send({ email: 'estivenmendezr@gmail.com', password: 'admin123' });
        token = res.body.session.access_token;
    });

    it('should get detailed monthly report', async () => {
        const res = await request(BASE_URL)
            .get('/reports/detailed-monthly?includeInactive=true')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should export CSV correctly', async () => {
        const res = await request(BASE_URL)
            .get('/reports/export?includeInactive=true')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/csv');
        expect(res.headers['content-disposition']).toContain('attachment; filename="reporte_impresiones.csv"');
        expect(res.text).toContain('Nombre,Email,Oficina'); // Check CSV headers roughly
    });
});

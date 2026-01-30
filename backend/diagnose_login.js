// Script de diagnóstico completo del flujo de login
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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

async function diagnoseLogin() {
    const client = await pool.connect();

    try {
        console.log('=== DIAGNÓSTICO DE LOGIN ===\n');

        const email = 'estivenmendezr@gmail.com';
        const password = 'admin123';

        // Paso 1: Verificar que el usuario existe
        console.log('1. Verificando usuario en base de datos...');
        const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            console.log('❌ ERROR: Usuario no encontrado en la base de datos');
            return;
        }

        const user = result.rows[0];
        console.log('✅ Usuario encontrado:');
        console.log('   - ID:', user.id);
        console.log('   - Email:', user.email);
        console.log('   - Nombre:', user.full_name);
        console.log('   - Rol:', user.role);
        console.log('   - Tiene password_hash:', !!user.password_hash);
        console.log('');

        // Paso 2: Verificar password
        console.log('2. Verificando contraseña...');
        if (!user.password_hash) {
            console.log('❌ ERROR: Usuario no tiene password_hash almacenado');
            return;
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            console.log('❌ ERROR: Contraseña incorrecta');
            console.log('   Hash almacenado:', user.password_hash.substring(0, 20) + '...');
            return;
        }

        console.log('✅ Contraseña válida');
        console.log('');

        // Paso 3: Generar JWT
        console.log('3. Generando JWT...');
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role || 'user' },
            process.env.JWT_SECRET || 'fallback_secret_key_change_me',
            { expiresIn: '8h' }
        );

        console.log('✅ JWT generado exitosamente');
        console.log('   Token (primeros 50 chars):', token.substring(0, 50) + '...');
        console.log('');

        // Paso 4: Simular respuesta del servidor
        console.log('4. Simulando respuesta del servidor...');
        const response = {
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                office: user.office,
                department: user.department,
                status: user.status
            },
            session: {
                access_token: token
            }
        };

        console.log('✅ Respuesta del servidor:');
        console.log(JSON.stringify(response, null, 2));
        console.log('');

        // Paso 5: Verificar estructura para frontend
        console.log('5. Verificando estructura para frontend...');
        if (!response.user || !response.session || !response.session.access_token) {
            console.log('❌ ERROR: Estructura de respuesta inválida');
            return;
        }

        console.log('✅ Estructura válida para el frontend');
        console.log('   - response.user existe:', !!response.user);
        console.log('   - response.session existe:', !!response.session);
        console.log('   - response.session.access_token existe:', !!response.session.access_token);
        console.log('');

        // Paso 6: Simular almacenamiento en localStorage
        console.log('6. Simulando almacenamiento en localStorage...');
        const sessionToStore = {
            ...response.session,
            user: response.user
        };

        console.log('✅ Datos que se guardarían en localStorage:');
        console.log(JSON.stringify(sessionToStore, null, 2));
        console.log('');

        console.log('=== DIAGNÓSTICO COMPLETADO EXITOSAMENTE ===');
        console.log('El flujo de login debería funcionar correctamente.');

    } catch (error) {
        console.error('❌ ERROR durante el diagnóstico:', error);
    } finally {
        client.release();
        pool.end();
    }
}

diagnoseLogin();

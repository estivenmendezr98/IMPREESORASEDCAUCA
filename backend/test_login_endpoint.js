// Script para probar el endpoint de login exactamente como lo hace el frontend

async function testLoginEndpoint() {
    console.log('=== PRUEBA DEL ENDPOINT /api/login ===\n');

    const email = 'estivenmendezr@gmail.com';
    const password = 'admin123';

    try {
        console.log('1. Haciendo petición POST a http://localhost:3000/api/login...');
        console.log('   Datos:', { email, password: '***' });

        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        console.log('\n2. Respuesta recibida:');
        console.log('   Status:', response.status, response.statusText);
        console.log('   Headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.log('\n❌ ERROR: Respuesta no exitosa');
            console.log('   Código:', response.status);
            console.log('   Mensaje:', errorText);
            return;
        }

        const data = await response.json();

        console.log('\n3. Datos de la respuesta:');
        console.log(JSON.stringify(data, null, 2));

        console.log('\n4. Validando estructura de la respuesta...');
        if (!data.user) {
            console.log('❌ ERROR: Falta data.user');
            return;
        }
        if (!data.session) {
            console.log('❌ ERROR: Falta data.session');
            return;
        }
        if (!data.session.access_token) {
            console.log('❌ ERROR: Falta data.session.access_token');
            return;
        }

        console.log('✅ Estructura válida');
        console.log('   - Usuario:', data.user.email, '(', data.user.role, ')');
        console.log('   - Token:', data.session.access_token.substring(0, 50) + '...');

        console.log('\n5. Simulando lo que haría el frontend...');
        const sessionToStore = {
            ...data.session,
            user: data.user
        };

        console.log('   Datos a guardar en localStorage:');
        console.log(JSON.stringify(sessionToStore, null, 2));

        console.log('\n=== PRUEBA COMPLETADA EXITOSAMENTE ===');
        console.log('El endpoint /api/login funciona correctamente.');

    } catch (error) {
        console.error('\n❌ ERROR durante la prueba:', error.message);
        console.error('   Stack:', error.stack);
    }
}

testLoginEndpoint();

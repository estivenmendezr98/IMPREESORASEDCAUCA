import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { stringify } from 'csv-stringify/sync';
import { generateDatabaseExport } from './utils/backup.js';
import importRoutes from './routes/import.js';

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'impresiones_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

// Middleware
app.use(cors());
app.use(express.json());

// Verificar conexión a la base de datos
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.stack);
  } else {
    console.log('✅ Conectado a PostgreSQL');
    release();
  }
});

// Crear directorio de uploads si no existe
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// ============================================================================
// RUTAS DE LA API
// ============================================================================

// Rutas de importación
app.use('/api/imports', importRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando correctamente' });
});

// Obtener todos los usuarios (filtrar por rol=user o null para usuarios normales)
app.get('/api/users', async (req, res) => {
  try {
    const { role } = req.query;
    let query = 'SELECT * FROM users';
    const params = [];

    if (role) {
      query += ' WHERE role = $1';
      params.push(role);
    } else {
      // Por defecto, excluir admins y readers para la vista general si no se especifica rol
      // O devolver todos si se quiere. Ajustemos para soportar query params.
    }

    query += ' ORDER BY full_name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // Verify password if hash exists, otherwise checks generic or allows migration if implemented
    let validPassword = false;
    if (user.password_hash) {
      validPassword = await bcrypt.compare(password, user.password_hash);
    } else {
      // Fallback for transition period if any user missed the seed script (unlikely)
      // For security, strictly require hash now that we ran the seed script.
      validPassword = false;
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // Generate real JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET || 'fallback_secret_key_change_me',
      { expiresIn: '8h' }
    );

    // Return the user data
    res.json({ user, session: { access_token: token } });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Obtener administradores (incluye superadmin)
app.get('/api/users/admins', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE role IN ('admin', 'superadmin') ORDER BY full_name");
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo administradores:', error);
    res.status(500).json({ error: 'Error obteniendo administradores' });
  }
});

// Obtener lectores
app.get('/api/users/readers', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE role = 'reader' ORDER BY full_name");
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo lectores:', error);
    res.status(500).json({ error: 'Error obteniendo lectores' });
  }
});

// Crear usuario (con rol)
app.post('/api/users', async (req, res) => {
  try {
    const { email, full_name, password, role, office, department, status } = req.body;

    // Generar ID
    const id = role === 'admin' ? `admin-${Date.now()}` :
      role === 'reader' ? `reader-${Date.now()}` :
        `user-${Date.now()}`;

    // Hash password (default to '123456' if not provided, though frontend should provide it)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password || '123456', saltRounds);

    const result = await pool.query(
      `INSERT INTO users (id, email, full_name, role, office, department, status, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, email, full_name, role || 'user', office || '', department || '', status || 'Normal', passwordHash]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error creando usuario' + error.message });
  }
});

// Eliminar usuario
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error eliminando usuario' });
  }
});

// Obtener totales por usuario (DEBE IR ANTES DE /api/users/:id)
app.get('/api/users/totals', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM total_by_user('{}')");
    // Convertir BIGINT (string) a Number
    const rows = result.rows.map(row => ({
      ...row,
      total_prints: Number(row.total_prints),
      total_copies: Number(row.total_copies),
      total_scans: Number(row.total_scans),
      total_fax: Number(row.total_fax)
    }));
    res.json(rows);
  } catch (error) {
    console.error('Error obteniendo totales:', error);
    res.status(500).json({ error: 'Error obteniendo totales' });
  }
});

// Obtener un usuario por ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ error: 'Error obteniendo usuario' });
  }
});

// Actualizar usuario
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, office, department, status } = req.body;

    const result = await pool.query(
      `UPDATE users 
       SET full_name = $1, email = $2, office = $3, department = $4, status = $5, role = COALESCE($6, role), updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [full_name, email, office, department, status, req.body.role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error actualizando usuario' });
  }
});

// Eliminar usuario
app.delete('/api/users/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Eliminar datos relacionados primero
    await client.query('DELETE FROM prints_raw WHERE user_id = $1', [id]);
    await client.query('DELETE FROM prints_monthly WHERE user_id = $1', [id]);
    await client.query('DELETE FROM user_printer_assignments WHERE user_id = $1', [id]);

    // Eliminar registros de importación del usuario
    await client.query('DELETE FROM import_log WHERE imported_by = $1', [id]);

    // Eliminar usuario
    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

    await client.query('COMMIT');

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado correctamente', user: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error eliminando usuario' });
  } finally {
    client.release();
  }
});

// Obtener datos mensuales de un usuario (todos los años)
app.get('/api/users/:id/monthly-all', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM prints_monthly 
       WHERE user_id = $1 
       ORDER BY year DESC, month DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo datos mensuales del usuario:', error);
    res.status(500).json({ error: 'Error obteniendo datos mensuales' });
  }
});


// ============================================================================
// REPORTING ENDPOINTS
// ============================================================================

// Reporte: Tendencias Mensuales
app.get('/api/reports/trends', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // Por defecto últimos 6 meses si no se envían fechas
    const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString();
    const end = endDate || new Date().toISOString();

    const result = await pool.query(
      `SELECT year, month, print_total, copy_total, scan_total, fax_total 
       FROM prints_monthly 
       WHERE created_at >= $1 AND created_at <= $2 
       ORDER BY year, month`,
      [start, end]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error en reporte tendencias:', error);
    res.status(500).json({ error: 'Error obteniendo tendencias' });
  }
});

// Reporte: Usuarios con actividad (Complejo con joins simulados con json_agg)
app.get('/api/reports/users', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString();
    const end = endDate || new Date().toISOString();

    const query = `
      SELECT 
        u.id, u.full_name, u.office, u.department,
        (
          SELECT COALESCE(json_agg(pm.*), '[]'::json)
          FROM prints_monthly pm
          WHERE pm.user_id = u.id 
          AND pm.created_at >= $1 AND pm.created_at <= $2
        ) as prints_monthly,
        (
          SELECT COALESCE(json_agg(json_build_object('report_timestamp', pr.report_timestamp)), '[]'::json)
          FROM prints_raw pr
          WHERE pr.user_id = u.id
          LIMIT 1 -- Optimizacion: solo necesitamos 1 para saber si hay actividad, o max fecha frontend
        ) as prints_raw
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM prints_monthly pm 
        WHERE pm.user_id = u.id AND pm.created_at >= $1 AND pm.created_at <= $2
      )
    `;

    const result = await pool.query(query, [start, end]);

    // Obtener la ultima fecha real de raw si es necesario (el frontend usa max(...))
    // Para simplificar, obtenemos MAX(report_timestamp) directamente en SQL
    const queryOptimized = `
       SELECT 
        u.id, u.full_name, u.office, u.department,
        COALESCE(
          (SELECT json_agg(pm.*) 
           FROM prints_monthly pm 
           WHERE pm.user_id = u.id AND pm.created_at >= $1 AND pm.created_at <= $2), 
          '[]'::json
        ) as prints_monthly,
        COALESCE(
          (SELECT json_agg(json_build_object('report_timestamp', pr.report_timestamp))
           FROM prints_raw pr 
           WHERE pr.user_id = u.id),
           '[]'::json
        ) as prints_raw
      FROM users u
    `;

    // Usamos queryOptimized pero necesitamos filtrar usuarios que tengan actividad en el rango para el reporte?
    // El frontend filtra después? No, el frontend usa !inner en prints_monthly.
    // Así que solo usuarios con prints_monthly en el rango.

    const finalQuery = `
      SELECT 
        u.id, u.full_name, u.office, u.department,
        (
           SELECT json_agg(pm.*) 
           FROM prints_monthly pm 
           WHERE pm.user_id = u.id AND pm.created_at >= $1 AND pm.created_at <= $2
        ) as prints_monthly,
        (
           SELECT json_agg(json_build_object('report_timestamp', pr.report_timestamp))
           FROM prints_raw pr 
           WHERE pr.user_id = u.id
        ) as prints_raw
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM prints_monthly pm 
        WHERE pm.user_id = u.id AND pm.created_at >= $1 AND pm.created_at <= $2
      )
    `;

    const resultUsers = await pool.query(finalQuery, [start, end]);
    res.json(resultUsers.rows);
  } catch (error) {
    console.error('Error en reporte usuarios:', error);
    res.status(500).json({ error: 'Error obteniendo reporte usuarios' });
  }
});

// Reporte: Totales Globales / Mensuales (para TotalReports)
app.get('/api/reports/detailed-monthly', async (req, res) => {
  try {
    const { startDate, endDate, office, includeInactive } = req.query;
    const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString();
    const end = endDate || new Date().toISOString();

    let query = `
        SELECT 
            pm.print_total, pm.copy_total, pm.scan_total, pm.fax_total, 
            pm.user_id, pm.year, pm.month,
            u.id, u.status, u.office, u.full_name
        FROM prints_monthly pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.created_at >= $1 AND pm.created_at <= $2
      `;

    const params = [start, end];
    let paramCount = 2;

    if (office) {
      paramCount++;
      query += ` AND u.office = $${paramCount}`;
      params.push(office);
    }

    if (includeInactive !== 'true') {
      query += ` AND u.status = 'Normal'`;
    }

    // Para que el frontend lo procese igual, devolvemos estructura plana, 
    // pero el frontend espera { ..., users: { office, ... } }
    // Podemos devolver flat y que el frontend se adapte o devolver json anidado.
    // SQL plano es más rápido, adaptaremos el endpoint para devolver formato esperado.

    const result = await pool.query(query, params);

    // Transformar a formato esperado por frontend (users prop anidada)
    const data = result.rows.map(row => ({
      print_total: row.print_total,
      copy_total: row.copy_total,
      scan_total: row.scan_total,
      fax_total: row.fax_total,
      user_id: row.user_id,
      year: row.year,
      month: row.month,
      users: {
        id: row.id,
        status: row.status,
        office: row.office,
        full_name: row.full_name
      }
    }));

    res.json(data);
  } catch (error) {
    console.error('Error en reporte detallado:', error);
    res.status(500).json({ error: 'Error en reporte detallado' });
  }
});

// CSV Export Endpoint
app.get('/api/reports/export', async (req, res) => {
  try {
    const { startDate, endDate, office, includeInactive } = req.query;
    // Same logic as detailed-monthly
    const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString();
    const end = endDate || new Date().toISOString();

    let query = `
            SELECT 
                u.full_name as "Nombre", 
                u.email as "Email", 
                u.office as "Oficina", 
                u.department as "Departamento",
                pm.year as "Año", 
                pm.month as "Mes",
                pm.print_total as "Impresiones", 
                pm.copy_total as "Copias", 
                pm.scan_total as "Escaneos", 
                pm.fax_total as "Fax",
                (pm.print_total + pm.copy_total + pm.scan_total + pm.fax_total) as "Total Operaciones"
            FROM prints_monthly pm
            JOIN users u ON pm.user_id = u.id
            WHERE pm.created_at >= $1 AND pm.created_at <= $2
        `;

    const params = [start, end];
    let paramCount = 2;

    if (office) {
      paramCount++;
      query += ` AND u.office = $${paramCount}`;
      params.push(office);
    }

    if (includeInactive !== 'true') {
      query += ` AND u.status = 'Normal'`;
    }

    query += ` ORDER BY pm.year DESC, pm.month DESC, u.full_name`;

    const result = await pool.query(query, params);

    // Generate CSV
    const csv = stringify(result.rows, {
      header: true,
      bom: true // Add Byte Order Mark for Excel compatibility
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte_impresiones.csv"');
    res.send(csv);

  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).send('Error generating export');
  }
});

// SQL Database Export Endpoint
app.get('/api/admin/export-sql', async (req, res) => {
  try {
    const { sqlContent, totalRecords } = await generateDatabaseExport(pool);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `sedcauca_database_export_${timestamp}.sql`;

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(sqlContent);
  } catch (error) {
    console.error('Error generating SQL export:', error);
    res.status(500).json({ error: 'Error generating SQL export' });
  }
});


// Obtener estadísticas del dashboard
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dashboard_stats()');
    const row = result.rows[0];
    const stats = {
      ...row,
      total_users: Number(row.total_users),
      active_users: Number(row.active_users),
      total_prints_month: Number(row.total_prints_month),
      total_copies_month: Number(row.total_copies_month)
      // last_import es fecha, no convertir
    };
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// Obtener detalle mensual de un usuario
app.get('/api/users/:id/monthly/:year?', async (req, res) => {
  try {
    const { id, year } = req.params;
    const targetYear = year || new Date().getFullYear();
    const result = await pool.query(
      'SELECT * FROM monthly_detail($1, $2)',
      [id, targetYear]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo detalle mensual:', error);
    res.status(500).json({ error: 'Error obteniendo detalle mensual' });
  }
});

// Obtener todas las impresoras
app.get('/api/printers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM printers ORDER BY office, name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo impresoras:', error);
    res.status(500).json({ error: 'Error obteniendo impresoras' });
  }
});

// Obtener impresoras por oficina
app.get('/api/printers/office/:office?', async (req, res) => {
  try {
    const { office } = req.params;
    const result = await pool.query(
      'SELECT * FROM printers_by_office($1)',
      [office || null]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo impresoras por oficina:', error);
    res.status(500).json({ error: 'Error obteniendo impresoras por oficina' });
  }
});

// Obtener usuarios de una impresora
app.get('/api/printers/:id/users', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM users_by_printer($1)',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo usuarios de impresora:', error);
    res.status(500).json({ error: 'Error obteniendo usuarios de impresora' });
  }
});

// Obtener impresoras de un usuario
app.get('/api/users/:id/printers', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM printers_by_user($1)',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo impresoras de usuario:', error);
    res.status(500).json({ error: 'Error obteniendo impresoras de usuario' });
  }
});

// Obtener datos mensuales
app.get('/api/prints/monthly', async (req, res) => {
  try {
    const { year, month, user_id } = req.query;
    let query = 'SELECT * FROM prints_monthly WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (year) {
      query += ` AND year = $${paramCount}`;
      params.push(year);
      paramCount++;
    }
    if (month) {
      query += ` AND month = $${paramCount}`;
      params.push(month);
      paramCount++;
    }
    if (user_id) {
      query += ` AND user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    query += ' ORDER BY year DESC, month DESC, user_id';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo datos mensuales:', error);
    res.status(500).json({ error: 'Error obteniendo datos mensuales' });
  }
});

// Obtener datos raw
app.get('/api/prints/raw', async (req, res) => {
  try {
    const { user_id, limit } = req.query;
    let query = 'SELECT * FROM prints_raw';
    const params = [];

    if (user_id) {
      query += ' WHERE user_id = $1';
      params.push(user_id);
    }

    query += ' ORDER BY report_timestamp DESC';

    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo datos raw:', error);
    res.status(500).json({ error: 'Error obteniendo datos raw' });
  }
});

// Obtener log de importaciones
app.get('/api/imports/log', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM import_log ORDER BY imported_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo log de importaciones:', error);
    res.status(500).json({ error: 'Error obteniendo log de importaciones' });
  }
});

// ============================================================================
// GESTIÓN DE IMPRESORAS (CRUD)
// ============================================================================

// Crear impresora
app.post('/api/printers', async (req, res) => {
  try {
    const { name, ip_address, model, office, status, location_details, serial } = req.body;

    // Generar UUID si la BD no lo hace automáticamente (asumimos que gen_random_uuid() está en default)
    // O mejor, dejemos que la BD lo maneje si la columna tiene DEFAULT gen_random_uuid()
    // Si no, lo generamos aquí. Asumiremos que la tabla tiene default.

    const result = await pool.query(
      `INSERT INTO printers (name, ip_address, model, office, status, location_details, serial)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, ip_address, model, office, status || 'Active', location_details, serial]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creando impresora:', error);
    res.status(500).json({ error: 'Error creando impresora' });
  }
});

// Actualizar impresora
app.put('/api/printers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ip_address, model, office, status, location_details, serial } = req.body;

    const result = await pool.query(
      `UPDATE printers 
       SET name = $1, ip_address = $2, model = $3, office = $4, status = $5, location_details = $6, serial = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, ip_address, model, office, status, location_details, serial, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Impresora no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando impresora:', error);
    res.status(500).json({ error: 'Error actualizando impresora' });
  }
});

// Eliminar impresora
app.delete('/api/printers/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Eliminar asignaciones primero
    await client.query('DELETE FROM user_printer_assignments WHERE printer_id = $1', [id]);

    // Eliminar impresora
    const result = await client.query('DELETE FROM printers WHERE id = $1 RETURNING *', [id]);

    await client.query('COMMIT');

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Impresora no encontrada' });
    }

    res.json({ message: 'Impresora eliminada', printer: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error eliminando impresora:', error);
    res.status(500).json({ error: 'Error eliminando impresora' });
  } finally {
    client.release();
  }
});

// ============================================================================
// GESTIÓN DE ASIGNACIONES
// ============================================================================

// Asignar usuarios a impresora (Reemplaza asignaciones existentes o agrega, según lógica de frontend)
// El frontend actual: Delete all for printer -> Insert new.
// Replicaremos esa lógica en una transacción para atomicidad.
app.post('/api/printers/:id/assignments', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { userIds } = req.body; // Array de user_ids

    await client.query('BEGIN');

    // 1. Eliminar asignaciones existentes para esta impresora
    await client.query('DELETE FROM user_printer_assignments WHERE printer_id = $1', [id]);

    // 2. Insertar nuevas asignaciones
    if (userIds && userIds.length > 0) {
      // Construir query de insert múltiple
      // VALUES ($1, $2, NOW()), ($3, $4, NOW()), ...
      const values = [];
      const placeholders = [];
      let paramCount = 1;

      userIds.forEach(userId => {
        placeholders.push(`($${paramCount}, $${paramCount + 1}, NOW())`);
        values.push(userId, id);
        paramCount += 2;
      });

      const query = `
        INSERT INTO user_printer_assignments (user_id, printer_id, assigned_at)
        VALUES ${placeholders.join(', ')}
        RETURNING *
      `;

      await client.query(query, values);
    }

    await client.query('COMMIT');
    res.json({ message: 'Asignaciones actualizadas correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error asignando usuarios:', error);
    res.status(500).json({ error: 'Error asignando usuarios' });
  } finally {
    client.release();
  }
});

// Eliminar una asignación específica
app.delete('/api/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM user_printer_assignments WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    res.json({ message: 'Asignación eliminada', assignment: result.rows[0] });
  } catch (error) {
    console.error('Error eliminando asignación:', error);
    res.status(500).json({ error: 'Error eliminando asignación' });
  }
});

// Obtener todas las asignaciones (para la vista de gestión)
app.get('/api/assignments', async (req, res) => {
  try {
    // Necesitamos incluir los datos del usuario como en la query original de Supabase: select(*, user:users(*))
    // En SQL hacemos un JOIN y devolvemos un objeto anidado o plano estructurado
    const result = await pool.query(`
      SELECT 
        upa.*,
        row_to_json(u) as user
      FROM user_printer_assignments upa
      LEFT JOIN users u ON upa.user_id = u.id
      ORDER BY upa.assigned_at DESC
    `);

    // Postgres row_to_json devuelve el objeto user anidado como queremos
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo asignaciones:', error);
    res.status(500).json({ error: 'Error obteniendo asignaciones' });
  }
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

app.listen(PORT, () => {
  console.log('============================================');
  console.log('🚀 Servidor API iniciado');
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`💾 Base de datos: ${process.env.DB_NAME}`);
  console.log('============================================');
  console.log('');
  console.log('Endpoints disponibles:');
  console.log('  GET /api/health');
  console.log('  GET /api/users');
  console.log('  GET /api/users/:id');
  console.log('  GET /api/users/totals');
  console.log('  GET /api/users/:id/monthly/:year');
  console.log('  GET /api/users/:id/printers');
  console.log('  GET /api/dashboard/stats');
  console.log('  GET /api/printers');
  console.log('  GET /api/printers/office/:office');
  console.log('  GET /api/printers/:id/users');
  console.log('  GET /api/prints/monthly');
  console.log('  GET /api/prints/raw');
  console.log('  GET /api/imports/log');
  console.log('');
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
});

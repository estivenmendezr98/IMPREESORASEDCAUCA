# Guía de Instalación de PostgreSQL y Configuración de la Base de Datos

Esta guía te ayudará a instalar PostgreSQL en Windows y configurar la base de datos `impresiones_db` para tu sistema de gestión de impresiones.

## 📋 Requisitos Previos

- Windows 10 o superior
- Permisos de administrador
- Conexión a Internet para descargar PostgreSQL

## 🔧 Paso 1: Instalar PostgreSQL en Windows

### Opción A: Instalación con el instalador oficial (Recomendado)

1. **Descargar PostgreSQL:**
   - Visita: https://www.postgresql.org/download/windows/
   - Descarga el instalador de PostgreSQL (versión 15 o superior recomendada)
   - O descarga directamente desde: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

2. **Ejecutar el instalador:**
   - Ejecuta el archivo descargado como administrador
   - Sigue el asistente de instalación:
     - **Directorio de instalación:** Deja el predeterminado o elige uno personalizado
     - **Componentes:** Selecciona:
       - ✅ PostgreSQL Server
       - ✅ pgAdmin 4 (interfaz gráfica)
       - ✅ Command Line Tools
     - **Directorio de datos:** Deja el predeterminado
     - **Contraseña del superusuario (postgres):** 
       - ⚠️ **IMPORTANTE:** Anota esta contraseña, la necesitarás
       - Ejemplo: `postgres123` (usa una contraseña segura)
     - **Puerto:** Deja el predeterminado `5432`
     - **Locale:** Deja el predeterminado

3. **Completar la instalación:**
   - Haz clic en "Next" y luego en "Finish"
   - Desmarca "Launch Stack Builder" si aparece

### Opción B: Instalación con Chocolatey (Para usuarios avanzados)

```powershell
# Ejecuta PowerShell como administrador
choco install postgresql
```

## 🚀 Paso 2: Verificar la Instalación

Abre PowerShell o CMD y ejecuta:

```powershell
psql --version
```

Deberías ver algo como: `psql (PostgreSQL) 15.x`

## 🗄️ Paso 3: Crear la Base de Datos

### Opción A: Usando la línea de comandos (Recomendado)

1. **Abrir PowerShell como administrador**

2. **Conectarse a PostgreSQL:**
   ```powershell
   psql -U postgres
   ```
   - Te pedirá la contraseña que configuraste durante la instalación

3. **Crear la base de datos:**
   ```sql
   CREATE DATABASE impresiones_db;
   ```

4. **Verificar que se creó:**
   ```sql
   \l
   ```
   - Deberías ver `impresiones_db` en la lista

5. **Conectarse a la nueva base de datos:**
   ```sql
   \c impresiones_db
   ```

6. **Ejecutar el script de configuración:**
   ```sql
   \i 'c:/impresoras/project/database/setup_impresiones_db.sql'
   ```
   
   **Nota:** Usa barras diagonales `/` en lugar de `\` en la ruta.

7. **Salir de psql:**
   ```sql
   \q
   ```

### Opción B: Usando pgAdmin 4 (Interfaz Gráfica)

1. **Abrir pgAdmin 4:**
   - Busca "pgAdmin 4" en el menú de inicio
   - Te pedirá crear una contraseña maestra para pgAdmin

2. **Conectarse al servidor:**
   - En el panel izquierdo, expande "Servers"
   - Haz clic en "PostgreSQL 15" (o la versión que instalaste)
   - Ingresa la contraseña del usuario `postgres`

3. **Crear la base de datos:**
   - Clic derecho en "Databases" → "Create" → "Database"
   - Nombre: `impresiones_db`
   - Owner: `postgres`
   - Haz clic en "Save"

4. **Ejecutar el script:**
   - Expande "impresiones_db" en el panel izquierdo
   - Haz clic en "Tools" → "Query Tool"
   - Haz clic en el icono de carpeta (Open File)
   - Selecciona: `c:\impresoras\project\database\setup_impresiones_db.sql`
   - Haz clic en el botón "Execute" (▶️)

## ✅ Paso 4: Verificar la Configuración

Ejecuta estas consultas para verificar que todo se creó correctamente:

```sql
-- Conectarse a la base de datos
psql -U postgres -d impresiones_db

-- Ver todas las tablas
\dt

-- Ver las funciones creadas
\df

-- Verificar datos de ejemplo
SELECT * FROM users;
SELECT * FROM printers;

-- Ejecutar función de estadísticas
SELECT * FROM dashboard_stats();
```

## 🔐 Paso 5: Configurar el Proyecto

Ahora necesitas configurar tu aplicación para conectarse a la base de datos local.

### Crear archivo de configuración `.env`

Si tu proyecto usa variables de entorno, crea o actualiza el archivo `.env`:

```env
# PostgreSQL Local Configuration
DATABASE_URL=postgresql://postgres:TU_CONTRASEÑA@localhost:5432/impresiones_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=impresiones_db
DB_USER=postgres
DB_PASSWORD=TU_CONTRASEÑA
```

**⚠️ IMPORTANTE:** Reemplaza `TU_CONTRASEÑA` con la contraseña que configuraste para el usuario `postgres`.

## 📊 Estructura de la Base de Datos

La base de datos incluye las siguientes tablas:

### Tablas Principales:
- **`users`** - Usuarios del sistema
- **`prints_raw`** - Datos brutos de impresiones (importados desde CSV)
- **`prints_monthly`** - Datos agregados mensuales por usuario
- **`import_log`** - Registro de importaciones
- **`printers`** - Gestión de impresoras
- **`user_printer_assignments`** - Asignaciones de usuarios a impresoras

### Funciones Disponibles:
- `dashboard_stats()` - Estadísticas generales del dashboard
- `total_by_user(jsonb)` - Totales de impresiones por usuario
- `monthly_detail(text, integer)` - Detalle mensual por usuario
- `printers_by_office(text)` - Impresoras por oficina
- `users_by_printer(uuid)` - Usuarios asignados a una impresora
- `printers_by_user(text)` - Impresoras asignadas a un usuario

## 🧪 Datos de Prueba

El script incluye datos de ejemplo:

### Usuarios:
- `demo-admin-001` - Admin Demo (admin@demo.com)
- `demo-user-001` - Usuario Demo (user@demo.com)
- `demo-user-002` - Usuario Demo 2 (user2@demo.com)

### Impresoras:
- 6 impresoras de ejemplo en diferentes oficinas
- Con diferentes modelos y estados

## 🔧 Comandos Útiles de PostgreSQL

```sql
-- Ver todas las bases de datos
\l

-- Conectarse a una base de datos
\c impresiones_db

-- Ver todas las tablas
\dt

-- Describir una tabla
\d users

-- Ver todas las funciones
\df

-- Ver índices
\di

-- Ejecutar un archivo SQL
\i 'ruta/al/archivo.sql'

-- Salir de psql
\q
```

## 🛠️ Solución de Problemas

### Error: "psql no se reconoce como comando"

**Solución:** Agregar PostgreSQL al PATH de Windows:

1. Busca "Variables de entorno" en el menú de inicio
2. Haz clic en "Variables de entorno"
3. En "Variables del sistema", selecciona "Path" y haz clic en "Editar"
4. Haz clic en "Nuevo" y agrega: `C:\Program Files\PostgreSQL\15\bin`
5. Haz clic en "Aceptar" en todas las ventanas
6. Reinicia PowerShell/CMD

### Error: "FATAL: password authentication failed"

**Solución:** Verifica que estás usando la contraseña correcta del usuario `postgres`.

### Error: "could not connect to server"

**Solución:** 
1. Verifica que el servicio de PostgreSQL está corriendo:
   - Abre "Servicios" (services.msc)
   - Busca "postgresql-x64-15" (o tu versión)
   - Asegúrate de que está "En ejecución"
   - Si no, haz clic derecho → "Iniciar"

### Error al ejecutar el script

**Solución:**
1. Verifica que estás conectado a la base de datos `impresiones_db`
2. Asegúrate de que la ruta del archivo es correcta
3. Usa barras diagonales `/` en lugar de `\` en las rutas

## 📚 Recursos Adicionales

- [Documentación oficial de PostgreSQL](https://www.postgresql.org/docs/)
- [Tutorial de PostgreSQL en español](https://www.postgresql.org.es/sobre_postgresql)
- [pgAdmin 4 Documentation](https://www.pgadmin.org/docs/)

## 🆘 Soporte

Si encuentras problemas durante la instalación o configuración:

1. Verifica los logs de PostgreSQL en: `C:\Program Files\PostgreSQL\15\data\log`
2. Revisa la documentación oficial
3. Consulta con el equipo de desarrollo

---

**¡Listo!** Tu base de datos PostgreSQL local está configurada y lista para usar con el sistema de gestión de impresiones.

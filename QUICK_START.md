# 🚀 Guía de Ejecución - Sistema de Gestión de Impresiones

## ✅ Configuración Completada

Tu proyecto ya está configurado para usar **PostgreSQL local** en lugar de Supabase.

### 📊 Arquitectura

```
┌─────────────────┐
│   Frontend      │  Puerto 5173
│   (React+Vite)  │  http://localhost:5173
└────────┬────────┘
         │
         │ HTTP/REST
         ▼
┌─────────────────┐
│   Backend API   │  Puerto 3000
│   (Express.js)  │  http://localhost:3000
└────────┬────────┘
         │
         │ SQL
         ▼
┌─────────────────┐
│   PostgreSQL    │  Puerto 5432
│   impresiones_db│  localhost
└─────────────────┘
```

## 🎯 Cómo Ejecutar el Proyecto

### Opción 1: Ejecución Manual (Dos Terminales)

#### Terminal 1: Backend API

```powershell
# Navegar al directorio del backend
cd c:\impresoras\project\backend

# Iniciar el servidor backend
npm start
```

Deberías ver:
```
✅ Conectado a PostgreSQL
🚀 Servidor API iniciado
📡 Puerto: 3000
🌐 URL: http://localhost:3000
```

#### Terminal 2: Frontend

```powershell
# Navegar al directorio del proyecto
cd c:\impresoras\project

# Instalar dependencias (solo la primera vez)
npm install

# Iniciar el frontend
npm run dev
```

Deberías ver:
```
VITE v7.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### Opción 2: Script Automático (Próximamente)

Voy a crear un script que inicie ambos servicios automáticamente.

## 🌐 Acceder a la Aplicación

1. Abre tu navegador
2. Ve a: **http://localhost:5173/**
3. Deberías ver el dashboard con los datos de la base de datos

## 🔍 Verificar que Funciona

### 1. Verificar Backend

Abre tu navegador en: http://localhost:3000/api/health

Deberías ver:
```json
{
  "status": "ok",
  "message": "API funcionando correctamente"
}
```

### 2. Verificar Datos

http://localhost:3000/api/users

Deberías ver los 3 usuarios demo:
```json
[
  {
    "id": "demo-admin-001",
    "full_name": "Admin Demo",
    "email": "admin@demo.com",
    ...
  },
  ...
]
```

### 3. Verificar Estadísticas

http://localhost:3000/api/dashboard/stats

Deberías ver las estadísticas del dashboard.

## 📡 Endpoints Disponibles

### Usuarios
- `GET /api/users` - Todos los usuarios
- `GET /api/users/:id` - Usuario específico
- `GET /api/users/totals` - Totales por usuario
- `GET /api/users/:id/monthly/:year` - Detalle mensual
- `GET /api/users/:id/printers` - Impresoras del usuario

### Dashboard
- `GET /api/dashboard/stats` - Estadísticas generales

### Impresoras
- `GET /api/printers` - Todas las impresoras
- `GET /api/printers/office/:office` - Por oficina
- `GET /api/printers/:id/users` - Usuarios de una impresora

### Impresiones
- `GET /api/prints/monthly` - Datos mensuales
- `GET /api/prints/raw` - Datos brutos
- `GET /api/imports/log` - Log de importaciones

## 🛠️ Comandos Útiles

### Backend

```powershell
cd backend

# Iniciar servidor
npm start

# Iniciar con auto-reload (desarrollo)
npm run dev
```

### Frontend

```powershell
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Compilar para producción
npm run build

# Vista previa de producción
npm run preview
```

## 🐛 Solución de Problemas

### Backend no inicia

**Error**: `Error conectando a PostgreSQL`

**Solución**:
1. Verifica que PostgreSQL está corriendo
2. Verifica las credenciales en `backend/.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=impresiones_db
   DB_USER=postgres
   DB_PASSWORD=1234
   ```

### Frontend no se conecta al backend

**Error**: `Failed to fetch` o `Network error`

**Solución**:
1. Verifica que el backend está corriendo en http://localhost:3000
2. Verifica el archivo `.env` en la raíz:
   ```env
   VITE_API_URL=http://localhost:3000/api
   ```
3. Reinicia el frontend: `Ctrl+C` y luego `npm run dev`

### Puerto 3000 ya está en uso

**Solución**:
```powershell
# Cambiar el puerto en backend/.env
PORT=3001

# Actualizar .env en la raíz
VITE_API_URL=http://localhost:3001/api
```

### No aparecen datos

**Solución**:
1. Verifica que la base de datos tiene datos:
   ```powershell
   $env:PGPASSWORD = "1234"
   & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d impresiones_db -c "SELECT COUNT(*) FROM users;"
   ```
2. Si no hay datos, ejecuta el script SQL de nuevo:
   ```powershell
   cd database
   .\setup_database.ps1
   ```

## 📝 Archivos de Configuración

### `backend/.env`
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=impresiones_db
DB_USER=postgres
DB_PASSWORD=1234
PORT=3000
NODE_ENV=development
```

### `.env` (raíz del proyecto)
```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=Sistema de Gestión de Impresiones
VITE_DEFAULT_TIMEZONE=America/Bogota
```

## 🎉 ¡Listo!

Tu aplicación ahora está funcionando con:
- ✅ PostgreSQL local (impresiones_db)
- ✅ Backend API REST (Express.js)
- ✅ Frontend React (Vite)

**No necesitas Supabase** - Todo funciona localmente en tu Windows.

## 📚 Próximos Pasos

1. Importar datos CSV reales
2. Personalizar la interfaz
3. Agregar más funcionalidades
4. Configurar backups automáticos

---

**¿Necesitas ayuda?** Revisa la sección de solución de problemas o verifica los logs del backend y frontend.

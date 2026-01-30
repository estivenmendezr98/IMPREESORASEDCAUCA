# 🖨️ Sistema de Gestión de Impresiones

Sistema completo de gestión de impresiones funcionando con **PostgreSQL local** en Windows.

## ✅ Estado del Proyecto

- ✅ Base de datos PostgreSQL configurada
- ✅ Backend API REST funcionando
- ✅ Frontend React con dashboard interactivo
- ✅ Autenticación Segura (bcrypt + JWT)
- ✅ Sistema de Backups Automáticos

## 🚀 Inicio Rápido

### 1. Ejecutar el Sistema

```powershell
# Desde la raíz del proyecto
.\start.ps1
```

### 2. Acceso

- **URL**: http://localhost:5173
- **Usuario Demo**: `estivenmendezr@gmail.com`
- **Contraseña**: `admin123`

## 🛡️ Seguridad y Backups

### Autenticación
El sistema utiliza contraseñas encriptadas. Todos los usuarios existentes tienen la contraseña predeterminada: `admin123`.
¡Por favor cambia las contraseñas en producción!

### 💾 Backups Automáticos
Para realizar una copia de seguridad de la base de datos:

```powershell
.\backup_db.ps1
```
Esto creará un archivo `.sql` en la carpeta `backups/` con la fecha y hora actual.

### 🔄 Restauración
Para restaurar una copia de seguridad (⚠️ SOBREESCRIBE DATOS):

```powershell
.\restore_db.ps1 .\backups\impresiones_db_YYYY-MM-DD_HHmm.sql
```

## 📁 Estructura del Proyecto

```
c:\impresoras\project\
├── backend/              # API REST con Express.js
├── src/                 # Frontend React
├── database/           # Scripts de base de datos
├── backups/            # Copias de seguridad automáticas
├── backup_db.ps1      # Script de backup
├── restore_db.ps1     # Script de restauración
└── start.ps1          # Script de inicio
```

## 🔧 Comandos Útiles

### Backend
```powershell
cd backend
npm start
```

### Frontend
```powershell
npm run dev
```

### Base de Datos
```powershell
# Conectarse a PostgreSQL (ajustar versión si es necesario)
$env:PGPASSWORD = "1234"
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d impresiones_db
```
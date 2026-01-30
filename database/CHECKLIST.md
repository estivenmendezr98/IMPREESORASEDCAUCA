# ✅ Lista de Verificación: Configuración de PostgreSQL

Usa esta lista para asegurarte de completar todos los pasos necesarios para configurar la base de datos local.

## 📋 Pre-requisitos

- [ ] Windows 10 o superior
- [ ] Permisos de administrador
- [ ] Conexión a Internet (para descargar PostgreSQL)

## 🔧 Instalación de PostgreSQL

- [ ] Descargar PostgreSQL desde https://www.postgresql.org/download/windows/
- [ ] Ejecutar el instalador como administrador
- [ ] Seleccionar componentes:
  - [ ] PostgreSQL Server
  - [ ] pgAdmin 4
  - [ ] Command Line Tools
- [ ] Configurar contraseña del usuario `postgres`
  - [ ] **IMPORTANTE:** Anotar la contraseña: ___________________
- [ ] Dejar puerto predeterminado: `5432`
- [ ] Completar la instalación

## ✅ Verificación de Instalación

- [ ] Abrir PowerShell o CMD
- [ ] Ejecutar: `psql --version`
- [ ] Verificar que muestra la versión de PostgreSQL

## 🗄️ Configuración de la Base de Datos

### Opción A: Configuración Automática (Recomendado)

- [ ] Abrir PowerShell en: `c:\impresoras\project\database`
- [ ] Ejecutar: `.\setup_database.ps1`
- [ ] Ingresar la contraseña de postgres cuando se solicite
- [ ] Verificar que el script se ejecuta sin errores
- [ ] Confirmar mensaje: "CONFIGURACIÓN COMPLETADA EXITOSAMENTE"

### Opción B: Configuración Manual

- [ ] Abrir PowerShell o CMD
- [ ] Ejecutar: `psql -U postgres`
- [ ] Ingresar contraseña de postgres
- [ ] Ejecutar: `CREATE DATABASE impresiones_db;`
- [ ] Ejecutar: `\c impresiones_db`
- [ ] Ejecutar: `\i 'c:/impresoras/project/database/setup_impresiones_db.sql'`
- [ ] Verificar que no hay errores
- [ ] Ejecutar: `\q` para salir

## 🔍 Verificación de la Base de Datos

- [ ] Conectarse a la base de datos: `psql -U postgres -d impresiones_db`
- [ ] Ver tablas: `\dt`
- [ ] Verificar que existen 6 tablas:
  - [ ] users
  - [ ] prints_raw
  - [ ] prints_monthly
  - [ ] import_log
  - [ ] printers
  - [ ] user_printer_assignments
- [ ] Ver funciones: `\df`
- [ ] Verificar datos de prueba: `SELECT * FROM users;`
- [ ] Verificar impresoras: `SELECT * FROM printers;`
- [ ] Ejecutar función de estadísticas: `SELECT * FROM dashboard_stats();`
- [ ] Salir: `\q`

## ⚙️ Configuración de la Aplicación

- [ ] Copiar `.env.example` a `.env`
- [ ] Editar archivo `.env`
- [ ] Descomentar las líneas de PostgreSQL Local:
  ```env
  DATABASE_URL=postgresql://postgres:TU_CONTRASEÑA@localhost:5432/impresiones_db
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=impresiones_db
  DB_USER=postgres
  DB_PASSWORD=TU_CONTRASEÑA
  ```
- [ ] Reemplazar `TU_CONTRASEÑA` con la contraseña real de postgres
- [ ] Guardar el archivo

## 🧪 Prueba de Conexión

- [ ] Iniciar la aplicación
- [ ] Verificar que se conecta a la base de datos sin errores
- [ ] Verificar que se muestran los datos de prueba
- [ ] Probar funcionalidades básicas:
  - [ ] Ver lista de usuarios
  - [ ] Ver lista de impresoras
  - [ ] Ver estadísticas del dashboard

## 📚 Recursos Disponibles

- [ ] Revisar `README_DATABASE_SETUP.md` para guía completa
- [ ] Revisar `DATABASE_SCHEMA.md` para entender la estructura
- [ ] Revisar `useful_queries.sql` para consultas de ejemplo
- [ ] Revisar `database_setup_summary.md` para resumen rápido

## 🛠️ Solución de Problemas

Si encuentras errores, verifica:

- [ ] PostgreSQL está instalado correctamente
- [ ] El servicio de PostgreSQL está corriendo (services.msc)
- [ ] La contraseña de postgres es correcta
- [ ] PostgreSQL está en el PATH de Windows
- [ ] El puerto 5432 no está bloqueado por firewall
- [ ] Tienes permisos de administrador

## 📝 Notas Adicionales

### Información de Conexión
```
Host: localhost
Puerto: 5432
Base de datos: impresiones_db
Usuario: postgres
Contraseña: [La que configuraste]
```

### Cadena de Conexión
```
postgresql://postgres:[CONTRASEÑA]@localhost:5432/impresiones_db
```

### Usuarios Demo Creados
- demo-admin-001 (admin@demo.com)
- demo-user-001 (user@demo.com)
- demo-user-002 (user2@demo.com)

### Impresoras Demo Creadas
- 6 impresoras en diferentes oficinas
- Con diferentes modelos y estados

## ✨ ¡Completado!

- [ ] Base de datos configurada y funcionando
- [ ] Aplicación conectada a la base de datos
- [ ] Datos de prueba verificados
- [ ] Todo listo para comenzar a usar el sistema

---

**Fecha de configuración:** ___________________

**Configurado por:** ___________________

**Notas adicionales:**
___________________________________________________________________
___________________________________________________________________
___________________________________________________________________

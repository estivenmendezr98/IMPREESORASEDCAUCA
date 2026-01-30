# Guía de Ejecución con Docker

Este proyecto ha sido configurado para funcionar completamente con Docker (Frontend, Backend y Base de Datos).

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y ejecutándose.

## Instrucciones

1.  Abre una terminal en la carpeta raíz del proyecto (`c:\impresoras\project` o donde lo tengas ubicado).

2.  Ejecuta el siguiente comando para construir e iniciar los servicios:

    ```bash
    docker-compose up --build
    ```

3.  Espera a que termine el proceso de construcción y que los servicios inicien. Verás logs del backend diciendo "Conectado a PostgreSQL".

4.  Accede a la aplicación:
    - **Frontend**: [http://localhost:5173](http://localhost:5173)
    - **Backend API**: [http://localhost:3000/api/health](http://localhost:3000/api/health)
    - **Base de Datos**: Accesible en `localhost:5432` (usuario: `postgres`, contraseña: `password123`, db: `impresiones_db`).

## Estructura de Servicios

- **frontend**: Aplicación React (Vite). Se ejecuta en el puerto 5173.
- **backend**: Servidor Node.js (Express). Se ejecuta en el puerto 3000.
- **db**: Base de datos PostgreSQL 15. Se ejecuta en el puerto 5432.

## Notas

- La base de datos se inicializa automáticamente con el script `database/setup_impresiones_db.sql` en la primera ejecución.
- Si necesitas detener los servicios, presiona `Ctrl+C` en la terminal.
- Para eliminar los contenedores y volúmenes (reiniciar la BD desde cero), ejecuta:
    ```bash
    docker-compose down -v
    ```

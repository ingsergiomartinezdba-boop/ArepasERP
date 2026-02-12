# Arepas Factory ERP

Sistema de gestión para la fábrica de arepas, con backend en FastAPI y frontend en React.

## 🚀 Configuración Local (PostgreSQL)

Este proyecto ha sido migrado de Supabase a un servicio de **PostgreSQL local** para mayor control y privacidad.

### Requisitos Previos
- PostgreSQL (v14 o superior)
- Python 3.10+
- Node.js & npm

### Pasos para Configuración

1.  **Configurar Base de Datos:**
    Crea la base de datos y el usuario en PostgreSQL:
    ```sql
    CREATE USER app_arepaserp WITH PASSWORD 'xdr5tgb';
    CREATE DATABASE "ArepasERP" OWNER app_arepaserp;
    GRANT ALL PRIVILEGES ON DATABASE "ArepasERP" TO app_arepaserp;
    ```

2.  **Ejecutar Schema:**
    Importa el esquema y los datos iniciales:
    ```bash
    psql -U app_arepaserp -d ArepasERP -f database/schema_local.sql
    ```

3.  **Configurar Entorno:**
    Copia el archivo `.env` y ajusta las credenciales si es necesario. (Ya configurado para el puerto estándar 5432).

4.  **Iniciar Backend:**
    ```bash
    cd backend
    pip install -r ../requirements.txt
    uvicorn main:app --reload
    ```

5.  **Iniciar Frontend:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

### 👤 Acceso por Defecto
- **Email**: `admin@arepaserp.com`
- **Contraseña**: `admin123`

## 📂 Documentación Detallada
- [Guía de Migración Local](MIGRACION_LOCAL.md): Detalles técnicos de la migración.
- [Estado de la Migración](ESTADO_MIGRACION.md): Routers migrados y pendientes.
- [Análisis de Componentes](COMPONENT_ANALYSIS.md): Plan de mejora de la UI.

## 🛠️ Tecnologías
- **Backend:** FastAPI, SQLAlchemy (ORM), JWT Auth.
- **Frontend:** React, Vite, Axios.
- **Base de Datos:** PostgreSQL.

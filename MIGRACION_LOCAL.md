# Documentación de Base de Datos Local (PostgreSQL)

## Configuración Completada

La aplicación ha sido actualizada para conectarse a una base de datos PostgreSQL local con las siguientes credenciales:

- **Base de Datos**: `ArepasERP`
- **Usuario**: `app_arepaserp`
- **Contraseña**: `xdr5tgb`
- **Host**: `localhost`
- **Puerto**: `5432`

## Pasos para Completar la Migración

### 1. Crear la Base de Datos y Usuario en PostgreSQL

Abre una terminal de PostgreSQL como superusuario y ejecuta:

```sql
-- Crear usuario
CREATE USER app_arepaserp WITH PASSWORD 'xdr5tgb';

-- Crear base de datos
CREATE DATABASE "ArepasERP" OWNER app_arepaserp;

-- Otorgar permisos
GRANT ALL PRIVILEGES ON DATABASE "ArepasERP" TO app_arepaserp;
```

### 2. Ejecutar el Schema SQL

Desde la carpeta raíz del proyecto, ejecuta:

```bash
psql -U app_arepaserp -d ArepasERP -f database/schema_local.sql
```

O si prefieres usar pgAdmin:
1. Abre pgAdmin
2. Conéctate al servidor local
3. Selecciona la base de datos `ArepasERP`
4. Abre Query Tool
5. Copia y pega el contenido de `database/schema_local.sql`
6. Ejecuta el script

### 3. Verificar la Instalación

Ejecuta el script de verificación:

```bash
python -m backend.init_db
```

Deberías ver:
- ✅ Conexión exitosa
- 📋 Lista de tablas creadas
- 👤 Usuario administrador creado

### 4. Instalar Dependencias Python (si no están instaladas)

```bash
pip install sqlalchemy psycopg2-binary passlib[bcrypt] python-jose
```

### 5. Iniciar el Backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Iniciar el Frontend

```bash
cd frontend
npm run dev
```

## Credenciales de Acceso

**Usuario Administrador por Defecto:**
- **Email**: `admin@arepaserp.com`
- **Contraseña**: `admin123`

⚠️ **IMPORTANTE**: Cambia esta contraseña después del primer login.

## Cambios Realizados

### Backend
1. ✅ `database.py` - Configurado para PostgreSQL local con SQLAlchemy
2. ✅ `sql_models.py` - Modelos ORM para todas las tablas
3. ✅ `auth.py` - Sistema de autenticación JWT local (reemplaza Supabase Auth)
4. ✅ `routers/auth.py` - Endpoint de login local
5. ✅ `routers/clients.py` - Actualizado para usar SQLAlchemy
6. ✅ `main.py` - Incluye router de autenticación

### Frontend
1. ✅ `lib/supabase.js` - Reemplazado con autenticación local JWT
2. ✅ `services/api.js` - Ya configurado para usar tokens locales

### Base de Datos
1. ✅ `schema_local.sql` - Schema completo actualizado con:
   - Tabla `usuarios` para autenticación local
   - Tablas actualizadas (`transferencias`, `pagos_recibidos`, `pagos_pedidos`)
   - Vistas (`view_saldos_medios_pago`, `view_historial_abonos`)
   - Datos iniciales (medios de pago, usuario admin)

## Próximos Pasos

Los siguientes routers aún necesitan ser migrados de Supabase a SQLAlchemy:
- `products.py`
- `orders.py`
- `expenses.py`
- `suppliers.py`
- `transfers.py`
- `receivables.py`
- `payment_methods.py`
- `reports.py`

Estos se migrarán siguiendo el mismo patrón usado en `clients.py`.

## Solución de Problemas

### Error: "connection refused"
- Verifica que PostgreSQL esté corriendo: `pg_ctl status`
- En Windows: Verifica el servicio en Services.msc

### Error: "password authentication failed"
- Verifica las credenciales en `backend/database.py`
- Asegúrate de que el usuario `app_arepaserp` existe

### Error: "database does not exist"
- Ejecuta el paso 1 para crear la base de datos

### Error al hacer login
- Verifica que el schema SQL se haya ejecutado correctamente
- Confirma que existe el usuario admin: `SELECT * FROM usuarios;`

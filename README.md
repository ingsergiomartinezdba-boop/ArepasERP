# ArepasERP

Sistema ERP para la gestión de la Fábrica de Arepas Betania. Administra pedidos, clientes, productos, proveedores, gastos, transferencias y reportes financieros.

## Stack

| Capa            | Tecnología                                   |
| --------------- | -------------------------------------------- |
| Backend         | FastAPI · SQLAlchemy 2 · Python 3.12         |
| Frontend        | React 19 · Vite 7                            |
| Base de datos   | PostgreSQL 17                                |
| Autenticación   | JWT (PyJWT) + cookies HttpOnly + bcrypt       |
| Servidor (prod) | Nginx + Gunicorn/Uvicorn (multi-stage Docker) |

## Estructura del repo

```
.
├── backend/             FastAPI app (routers, models, tests, requirements)
├── frontend/            React app (Vite, src, tests)
├── .github/workflows/   CI (pytest, audits, lint)
├── README.md
└── .gitignore
```

> **Nota:** la carpeta `DEV/` (ignorada por git) contiene scripts de operación,
> documentación, base de datos con schema/migraciones, deployment Docker
> (`DEV/deployment/migracion_Docker/`), backups y respaldos. No es necesaria
> para correr la app, pero sí para tareas de mantenimiento, despliegue
> productivo y onboarding inicial.

## Inicio rápido (dev local)

```bash
# 1. Base de datos PostgreSQL (schema en DEV/database/database/schema.sql)
psql -U postgres -d ArepasERP -f DEV/database/database/schema.sql

# 2. Backend
cd backend
cp .env.example .env          # configurar DB_PASS, SECRET_KEY, etc.
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# 3. Frontend
cd frontend
cp .env.example .env          # opcional
npm ci
npm run dev                   # https://localhost:8444
```

## Producción (Docker)

El stack de deployment vive en `DEV/deployment/migracion_Docker/` (no
versionado en este repo; se mantiene en almacenamiento de operación).

```bash
cd DEV/deployment/migracion_Docker
cp .env.example .env.docker   # configurar SERVER_HOST, passwords, etc.
./up.sh --build
```

La app queda accesible en `https://<SERVER_HOST>:8445`.

## Tests

```bash
cd backend  && pytest tests/        # 197 tests
cd frontend && npm test             # 53 tests
```

## Seguridad

- JWT en cookie HttpOnly + Secure + SameSite=lax.
- RBAC con `require_internal_permission` (rol `Cliente` bloqueado del ERP interno; usa `/api/portal/*`).
- CSP, HSTS, X-Frame-Options, Cross-Origin-Opener/Resource-Policy.
- Audit log (`audit_log`) registra login/logout/delete/update sobre entidades sensibles.
- Backend solo expuesto vía HTTPS (puerto 8444 dev / 8445 prod).

Para detalle ver `DEV/docs/documentacion/`.

import os
import logging
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from routers import orders, clients, products, expenses, reports, payment_methods, suppliers, transfers, receivables, auth, inventory, production, insumos, recetas, analytics, costos, roles, portal_cliente, portal_cliente_analytics, configuracion, parametros, cash_flow
from auth import get_current_user, require_permission, require_internal_permission

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

_DEBUG = os.getenv("DEBUG", "false").lower() == "true"

app = FastAPI(
    title="Arepas Factory ERP API",
    version="1.1.0",
    # Deshabilitar docs en producción para no exponer la estructura de la API
    docs_url="/docs" if _DEBUG else None,
    redoc_url="/redoc" if _DEBUG else None,
    openapi_url="/openapi.json" if _DEBUG else None,
)


# ── Security Headers Middleware ────────────────────────────────────────────
# Política CSP — permite recursos del mismo origen + estilos inline (React inyecta
# algunos via style attr). Si se elimina 'unsafe-inline' habrá que mover esos
# estilos a clases CSS. data: en img-src cubre los favicons base64.
_CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # Aislamiento cross-origin
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        # CSP — solo en producción para no bloquear el HMR de Vite dev
        if not _DEBUG:
            response.headers["Content-Security-Policy"] = _CSP
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)


# ── CORS ───────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
if _raw_origins.strip() == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
else:
    origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.get("/", include_in_schema=False)
def read_root():
    return {"status": "ok"}


# ── Healthchecks ───────────────────────────────────────────────────────────
# /health: liveness — la app responde
# /ready:  readiness — la app puede atender requests (BD accesible)
@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok", "service": "arepaserp-api"}


@app.get("/ready", include_in_schema=False)
def ready():
    """Verifica que la BD responda. Útil para Docker HEALTHCHECK y orquestadores."""
    from sqlalchemy import text
    from database import SessionLocal
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "db": "ok"}
    except Exception as e:
        logger.error("Readiness check failed: %s", e)
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "db": "error", "detail": str(e)[:200]},
        )
    finally:
        db.close()

# Public Routes (No authentication required)
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])

# Protected Routes
app.include_router(clients.router, prefix="/api/clients", tags=["Clients"], dependencies=[Depends(get_current_user)])
app.include_router(products.router, prefix="/api/products", tags=["Products"], dependencies=[Depends(get_current_user)])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"], dependencies=[Depends(get_current_user)])
app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"], dependencies=[Depends(get_current_user)])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"], dependencies=[Depends(get_current_user)])
app.include_router(payment_methods.router, prefix="/api/payment-methods", tags=["Payment Methods"], dependencies=[Depends(get_current_user)])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["Suppliers"], dependencies=[Depends(get_current_user)])
app.include_router(transfers.router, prefix="/api/transfers", tags=["Transfers"], dependencies=[Depends(get_current_user)])
app.include_router(receivables.router, prefix="/api/receivables", tags=["Receivables"], dependencies=[Depends(get_current_user)])
app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"], dependencies=[Depends(get_current_user)])
app.include_router(production.router, prefix="/api/production", tags=["Production"], dependencies=[Depends(get_current_user)])
app.include_router(insumos.router, prefix="/api/insumos", tags=["Insumos"], dependencies=[Depends(get_current_user)])
app.include_router(recetas.router,    prefix="/api/production", tags=["Recetas"],   dependencies=[Depends(get_current_user)])
app.include_router(analytics.router,  prefix="/api/analytics",  tags=["Analytics"], dependencies=[Depends(get_current_user)])
app.include_router(costos.router,     prefix="/api/costos",     tags=["Costos"],    dependencies=[Depends(get_current_user)])
app.include_router(roles.router,      prefix="/api/roles",      tags=["RBAC"],      dependencies=[Depends(get_current_user)])
app.include_router(portal_cliente.router, prefix="/api/portal", tags=["Portal Cliente"])
app.include_router(portal_cliente_analytics.router, prefix="/api/portal/analytics", tags=["Portal Cliente — Analytics"])
# GET es público (usado por el modal de pedidos sin requerir permiso especial)
app.include_router(configuracion.router, prefix="/api/config", tags=["Configuración"], dependencies=[Depends(get_current_user)])
app.include_router(parametros.router, prefix="/api/parametros", tags=["Parámetros"], dependencies=[Depends(require_internal_permission("parametros.ver"))])
app.include_router(cash_flow.router, prefix="/api/cash-flow", tags=["Cash Flow"], dependencies=[Depends(get_current_user)])

from datetime import datetime, timedelta
from typing import Optional, Set
from functools import lru_cache

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWTError as JWTError
import bcrypt
from sqlalchemy.orm import Session, joinedload

from database import get_db
from sql_models import Usuario, Rol, RolPermiso, Permiso

import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Configuración JWT ─────────────────────────────────────────

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    import secrets
    SECRET_KEY = secrets.token_hex(32)
    logger.warning(
        "SECRET_KEY not set in environment — using a temporary random key. "
        "All sessions will be invalidated on restart. Set SECRET_KEY in backend/.env"
    )

ALGORITHM                  = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Nombre y atributos de la cookie HttpOnly que transporta el JWT.
# En dev (DEBUG=true) Secure=False para permitir HTTP local.
COOKIE_NAME = "arepaserp_session"
COOKIE_SECURE = os.getenv("DEBUG", "false").lower() != "true"

# auto_error=False: si no llega header Authorization, no falla — caemos a la cookie.
security = HTTPBearer(auto_error=False)

# ── Contraseñas ───────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_password_hash(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# ── JWT ───────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)  # PyJWT retorna str directamente

# ── Carga de permisos del usuario ────────────────────────────

def get_user_permissions(user: Usuario, db: Session) -> Set[str]:
    """
    Retorna el set de codigos de permisos del usuario según su rol.
    Se consulta en cada request (sin cache) para reflejar cambios en tiempo real.
    """
    if not user.rol_id:
        # Sin rol asignado → sin permisos granulares
        # Si es 'admin' legacy, le damos todos los permisos
        if user.rol == "admin":
            permisos = db.query(Permiso.codigo).all()
            return {p.codigo for p in permisos}
        return set()

    permisos = (
        db.query(Permiso.codigo)
        .join(RolPermiso, RolPermiso.permiso_id == Permiso.id)
        .filter(RolPermiso.rol_id == user.rol_id)
        .all()
    )
    return {p.codigo for p in permisos}

# ── Dependencia: usuario autenticado ──────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    cookie_token: Optional[str] = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Valida el JWT y retorna el Usuario ORM.

    Acepta el token desde **dos** orígenes (en orden de prioridad):
      1) Cookie HttpOnly `arepaserp_session` (recomendado, no expuesto a XSS).
      2) Header `Authorization: Bearer <token>` (compatibilidad con clientes
         existentes, integraciones y scripts).

    Agrega atributo dinámico `_permisos: Set[str]` al objeto para uso inmediato.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Preferencia: cookie > header (la cookie es la fuente segura)
    token = cookie_token or (credentials.credentials if credentials else None)
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(Usuario).filter(Usuario.email == email, Usuario.activo == True).first()
    if not user:
        raise credentials_exception

    # Inyectar permisos como atributo no persistido — disponible en handlers
    user._permisos = get_user_permissions(user, db)
    return user

# ── Dependencia: permiso granular ────────────────────────────

def is_cliente_role(user: Usuario) -> bool:
    """True si el usuario es un cliente del portal (no un operador interno)."""
    perms = getattr(user, "_permisos", set())
    return "portal.ver_pedidos" in perms and bool(user.cliente_id)


def require_permission(codigo: str):
    """
    Dependency factory — protege un endpoint con un permiso específico.
    Uso típico: endpoints del portal cliente o endpoints universales.

    Para endpoints del ERP interno (no portal), usar
    `require_internal_permission` que ADEMÁS bloquea a clientes del portal.

    Uso:
        @router.post("/")
        def crear_cliente(
            _: Usuario = Depends(require_permission("clientes.crear")),
            db: Session = Depends(get_db),
        ):
            ...
    """
    def checker(user: Usuario = Depends(get_current_user)) -> Usuario:
        if not hasattr(user, "_permisos") or codigo not in user._permisos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso requerido: {codigo}",
            )
        return user
    return checker


def require_internal_permission(codigo: str):
    """
    Como `require_permission` pero RECHAZA usuarios del portal cliente.

    Garantiza segregación:
      - Los Clientes del portal NUNCA acceden a endpoints internos del ERP,
        aunque algún permiso solapado se lo permitiera (ej. el rol Cliente
        tiene `pedidos.crear` asignado por diseño legacy).
      - Los Clientes deben usar sus endpoints en /api/portal/*.

    Uso en cualquier router interno (orders, expenses, products, etc.):

        @router.delete("/{id}",
            dependencies=[Depends(require_internal_permission("pedidos.eliminar"))])
        def borrar(id: int, ...): ...
    """
    def checker(user: Usuario = Depends(get_current_user)) -> Usuario:
        # Bloqueo previo: Clientes del portal no acceden al ERP interno.
        if is_cliente_role(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Este endpoint es para uso interno del ERP. "
                       "Usa el portal de cliente en /portal."
            )
        if not hasattr(user, "_permisos") or codigo not in user._permisos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso requerido: {codigo}",
            )
        return user
    return checker

# ── Dependencia: solo administradores ────────────────────────

def require_admin(user: Usuario = Depends(get_current_user)) -> Usuario:
    """Requiere rol admin (legacy) o permiso roles.editar."""
    perms = getattr(user, "_permisos", set())
    if user.rol != "admin" and "roles.editar" not in perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador",
        )
    return user

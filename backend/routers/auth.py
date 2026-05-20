import logging
import time
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
import jwt
from jwt import PyJWTError
from database import get_db
from sql_models import Usuario
from auth import (
    create_access_token,
    verify_password,
    get_current_user,
    get_user_permissions,
    COOKIE_NAME,
    COOKIE_SECURE,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    SECRET_KEY,
    ALGORITHM,
)
from audit import auditar

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Rate limiter en memoria (5 intentos por IP cada 60s) ---
_login_attempts: dict = defaultdict(list)
_MAX_ATTEMPTS   = 5
_WINDOW_SECONDS = 60
_CLEANUP_EVERY  = 200   # limpiar IPs viejas cada N llamadas
_cleanup_counter = 0


def _get_real_ip(request: Request) -> str:
    """Usa client.host directamente; ignora X-Forwarded-For para evitar spoofing."""
    return request.client.host if request.client else "unknown"


def _check_rate_limit(ip: str):
    global _cleanup_counter
    now = time.time()
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < _WINDOW_SECONDS]
    if len(_login_attempts[ip]) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. Espera 60 segundos.",
        )
    _login_attempts[ip].append(now)
    # Evitar memory leak: purgar IPs con ventana expirada periódicamente
    _cleanup_counter += 1
    if _cleanup_counter >= _CLEANUP_EVERY:
        _cleanup_counter = 0
        expired = [k for k, v in list(_login_attempts.items()) if not v]
        for k in expired:
            del _login_attempts[k]

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

@router.post("/login", response_model=TokenResponse)
def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Autenticar usuario y retornar JWT.

    Además del token en el body (compatibilidad con clientes existentes),
    setea una cookie HttpOnly `arepaserp_session` que es el método preferido
    para el navegador (no expuesta a XSS).
    """
    client_ip = _get_real_ip(request)
    _check_rate_limit(client_ip)

    user = db.query(Usuario).filter(Usuario.email == credentials.email).first()

    if not user or not user.activo or not verify_password(credentials.password, user.password_hash):
        logger.warning("Failed login attempt for email=%s ip=%s", credentials.email, client_ip)
        # Auditar intento fallido (sin tirar la transacción de auditoría
        # contra la sesión actual — auditar() maneja sus propios commits).
        auditar(
            db, user, "usuario",
            user.id if user else None,
            "login_failed",
            request=request,
            nota=f"email={credentials.email}"
                 + ("" if user else " (usuario_inexistente)")
                 + ("" if not user or user.activo else " (usuario_inactivo)"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )

    _login_attempts.pop(client_ip, None)

    access_token = create_access_token(data={"sub": user.email})

    # Auditar login exitoso
    auditar(db, user, "usuario", user.id, "login", request=request)

    # Cookie HttpOnly — preferida frente a localStorage (evita robo por XSS).
    # SameSite=lax: mantiene UX de navegación normal pero bloquea CSRF cross-site.
    response.set_cookie(
        key=COOKIE_NAME,
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

    permisos = get_user_permissions(user, db)
    rol_nombre = user.rol_obj.nombre if user.rol_obj else user.rol

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id":         user.id,
            "email":      user.email,
            "nombre":     user.nombre,
            "rol":        user.rol,
            "rol_id":     user.rol_id,
            "rol_nombre": rol_nombre,
            "cliente_id": user.cliente_id,
            "permisos":   list(permisos),
        }
    }


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    cookie_token: Optional[str] = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
):
    """Cierra la sesión borrando la cookie HttpOnly.

    Diseño:
      - NO requiere sesión válida — siempre limpia la cookie del cliente
        para que cualquier sesión rota pueda quedar limpia.
      - Si la cookie es decodificable, auditamos quién hizo logout.

    Nota: el JWT en sí sigue siendo válido hasta su `exp`. Para invalidación
    real se requiere una blacklist (Redis o tabla `tokens_revocados`).
    """
    # Best-effort: identificar al usuario para auditar
    user = None
    if cookie_token:
        try:
            payload = jwt.decode(cookie_token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            if email:
                user = db.query(Usuario).filter(Usuario.email == email).first()
        except PyJWTError:
            pass
    if user:
        auditar(db, user, "usuario", user.id, "logout", request=request)

    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )
    return Response(status_code=204)

@router.get("/me")
def get_current_user_info(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Obtener info del usuario autenticado con sus permisos RBAC."""
    permisos = get_user_permissions(current_user, db)
    rol_nombre = current_user.rol_obj.nombre if current_user.rol_obj else current_user.rol
    return {
        "id":         current_user.id,
        "email":      current_user.email,
        "nombre":     current_user.nombre,
        "rol":        current_user.rol,
        "rol_id":     current_user.rol_id,
        "rol_nombre": rol_nombre,
        "cliente_id": current_user.cliente_id,
        "permisos":   list(permisos),
    }

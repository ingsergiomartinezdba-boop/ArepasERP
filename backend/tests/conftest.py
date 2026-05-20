"""
Configuración global de pytest para ArepasERP.

Estrategia:
- Usa la BD real (DEBUG) — los tests usan PREFIX 'TEST_' para datos creados.
- Crea un usuario admin de pruebas al inicio de la sesión y lo elimina al final.
- Fixtures auth-helpers: client, admin_token, auth_headers.
- Los tests de integración deben usar el helper `cleanup_test_data` para limpiar lo que crean.
"""
import os
import sys
import pathlib
import pytest
from typing import Generator

# Asegurar que backend/ esté en sys.path
BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from main import app  # noqa: E402
from database import SessionLocal  # noqa: E402
from sql_models import Usuario, Rol  # noqa: E402
from auth import get_password_hash, create_access_token  # noqa: E402


TEST_USER_EMAIL = "qa.tester.arepaserp@example.com"
TEST_USER_PASSWORD = "TestQA_Pwd_2026!"
TEST_USER_NAME = "QA Tester (auto)"


# ──────────────────────────────────────────────────────────────────────────
# Fixtures de sesión
# ──────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def db_session() -> Generator[Session, None, None]:
    """Sesión SQLAlchemy compartida (scope=session) para setup/teardown global."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def ensure_test_user(db_session: Session) -> Generator[Usuario, None, None]:
    """Crea/asegura el usuario de pruebas con rol admin. Se elimina al final."""
    user = db_session.query(Usuario).filter(Usuario.email == TEST_USER_EMAIL).first()
    created_here = False
    if not user:
        # Buscar rol admin
        admin_rol = db_session.query(Rol).filter(Rol.nombre.in_(["admin", "Administrador"])).first()
        user = Usuario(
            email=TEST_USER_EMAIL,
            password_hash=get_password_hash(TEST_USER_PASSWORD),
            nombre=TEST_USER_NAME,
            rol="admin",
            rol_id=admin_rol.id if admin_rol else None,
            activo=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        created_here = True

    yield user

    # Teardown: borrar SOLO si fue creado por la suite
    if created_here:
        try:
            db_session.delete(user)
            db_session.commit()
        except Exception:
            db_session.rollback()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """TestClient per-test para que las cookies (HttpOnly session) de un
    test no contaminen al siguiente. POST /api/auth/login setea una cookie
    arepaserp_session que persiste en el TestClient si es session-scoped."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(ensure_test_user: Usuario) -> str:
    """JWT del usuario admin de pruebas."""
    return create_access_token({"sub": ensure_test_user.email})


@pytest.fixture(scope="session")
def auth_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────

@pytest.fixture
def cleanup_test_data(db_session: Session):
    """
    Registra IDs a eliminar al final del test.

    Uso:
        def test_x(client, auth_headers, cleanup_test_data):
            r = client.post(...).json()
            cleanup_test_data(table="productos", id=r["id"])
    """
    to_delete = []  # [(table, id_or_filter), ...]

    def register(table: str, id: int = None, where: str = None):
        to_delete.append((table, id, where))

    yield register

    # Teardown — orden inverso para FKs
    from sqlalchemy import text
    for table, id_, where in reversed(to_delete):
        try:
            if id_ is not None:
                db_session.execute(text(f"DELETE FROM {table} WHERE id = :id"), {"id": id_})
            elif where:
                db_session.execute(text(f"DELETE FROM {table} WHERE {where}"))
            db_session.commit()
        except Exception:
            db_session.rollback()

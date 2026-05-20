import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Database Connection String — all values must come from .env
DB_USER    = os.getenv("DB_USER", "app_arepaserp")
DB_PASS    = os.getenv("DB_PASS")
DB_HOST    = os.getenv("DB_HOST", "localhost")
DB_PORT    = os.getenv("DB_PORT", "5432")
DB_NAME    = os.getenv("DB_NAME", "ArepasERP")
# Modo SSL — 'prefer' negocia TLS si el server lo soporta, sin romper si no.
# En producción remota usar 'require' o 'verify-full'.
DB_SSLMODE = os.getenv("DB_SSLMODE", "prefer")

if not DB_PASS:
    logger.warning("DB_PASS not set in environment. Set it in backend/.env")

SQLALCHEMY_DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?sslmode={DB_SSLMODE}"
)

# Create Engine
#  - pool_pre_ping: detecta conexiones zombies tras reinicios de la BD.
#  - pool_recycle: recicla cada 30 min para evitar `server closed the connection`.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=10,
    max_overflow=10,
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for ORM models
Base = declarative_base()

# Dependency for FastAPI routers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

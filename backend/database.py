from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Database Connection String
# User: app_arepaserp
# Pass: xdr5tgb
# DB: ArepasERP
SQLALCHEMY_DATABASE_URL = "postgresql://app_arepaserp:xdr5tgb@localhost:5432/ArepasERP"

# Create Engine
engine = create_engine(SQLALCHEMY_DATABASE_URL)

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

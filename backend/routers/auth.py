from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from sql_models import Usuario
from auth import create_access_token

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token
    """
    # Find user by email
    user = db.query(Usuario).filter(Usuario.email == credentials.email).first()
    
    if not user or not user.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )
    
    # Verify password using PostgreSQL's crypt function
    from sqlalchemy import text
    result = db.execute(
        text("SELECT (password_hash = crypt(:password, password_hash)) AS match FROM usuarios WHERE email = :email"),
        {"password": credentials.password, "email": credentials.email}
    ).fetchone()
    
    if not result or not result[0]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "nombre": user.nombre,
            "rol": user.rol
        }
    }

@router.get("/me")
def get_current_user_info(current_user: Usuario = Depends(lambda: __import__('auth', fromlist=['get_current_user']).get_current_user)):
    """Get current authenticated user info"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "nombre": current_user.nombre,
        "rol": current_user.rol
    }

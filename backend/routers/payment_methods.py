from fastapi import APIRouter, HTTPException, Depends
from typing import List
from sqlalchemy.orm import Session
from ..database import get_db
from ..sql_models import MedioPago
from ..models import PaymentMethod, PaymentMethodCreate, PaymentMethodUpdate

router = APIRouter()

@router.get("/", response_model=List[PaymentMethod])
def get_payment_methods(db: Session = Depends(get_db)):
    """Get all payment methods"""
    methods = db.query(MedioPago).order_by(MedioPago.id).all()
    return methods

@router.post("/", response_model=PaymentMethod)
def create_payment_method(method: PaymentMethodCreate, db: Session = Depends(get_db)):
    """Create a new payment method"""
    try:
        db_method = MedioPago(**method.dict())
        db.add(db_method)
        db.commit()
        db.refresh(db_method)
        return db_method
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{method_id}", response_model=PaymentMethod)
def update_payment_method(method_id: int, method: PaymentMethodUpdate, db: Session = Depends(get_db)):
    """Update an existing payment method"""
    db_method = db.query(MedioPago).filter(MedioPago.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    
    for key, value in method.dict(exclude_unset=True).items():
        setattr(db_method, key, value)
    
    db.commit()
    db.refresh(db_method)
    return db_method

@router.delete("/{method_id}")
def delete_payment_method(method_id: int, db: Session = Depends(get_db)):
    """Delete a payment method (soft delete by setting activo=False)"""
    db_method = db.query(MedioPago).filter(MedioPago.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    
    # Soft delete instead of hard delete to preserve historical data
    db_method.activo = False
    db.commit()
    return {"message": "Payment method deactivated"}

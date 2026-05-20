import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List
from sqlalchemy.orm import Session
from database import get_db
from sql_models import MedioPago, Usuario
from models import PaymentMethod, PaymentMethodCreate, PaymentMethodUpdate
from auth import require_permission, require_internal_permission
from audit import auditar, snapshot

router = APIRouter()
logger = logging.getLogger(__name__)

SAFE = {"nombre", "tipo", "activo"}


@router.get("/", response_model=List[PaymentMethod])
def get_payment_methods(
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_internal_permission("medios_pago.ver")),
):
    return db.query(MedioPago).order_by(MedioPago.id).all()


@router.post("/", response_model=PaymentMethod)
def create_payment_method(
    method: PaymentMethodCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_internal_permission("medios_pago.crear")),
):
    try:
        data = {k: v for k, v in method.model_dump().items() if k in SAFE and v is not None}
        db_method = MedioPago(**data)
        db.add(db_method)
        db.commit()
        db.refresh(db_method)
        return db_method
    except Exception as e:
        db.rollback()
        logger.error("Error creating payment method: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al crear el medio de pago")


@router.put("/{method_id}", response_model=PaymentMethod)
def update_payment_method(
    method_id: int,
    method: PaymentMethodUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_internal_permission("medios_pago.editar")),
):
    db_method = db.query(MedioPago).filter(MedioPago.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Payment method not found")

    for key, value in method.model_dump(exclude_unset=True).items():
        if key in SAFE:
            setattr(db_method, key, value)

    db.commit()
    db.refresh(db_method)
    return db_method


@router.patch("/{method_id}/toggle", response_model=PaymentMethod)
def toggle_active(
    method_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_internal_permission("medios_pago.editar")),
):
    """Activa o desactiva un medio de pago."""
    db_method = db.query(MedioPago).filter(MedioPago.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Payment method not found")

    db_method.activo = not (db_method.activo if db_method.activo is not None else True)
    db.commit()
    db.refresh(db_method)
    return db_method


@router.delete("/{method_id}")
def delete_payment_method(
    method_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_internal_permission("medios_pago.editar")),
):
    db_method = db.query(MedioPago).filter(MedioPago.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Payment method not found")

    antes = snapshot(db_method)
    db.delete(db_method)
    db.commit()

    auditar(db, user, "medio_pago", method_id, "delete", antes=antes, request=request)

    return {"message": "Payment method deleted"}

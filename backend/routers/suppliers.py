from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from sqlalchemy.orm import Session
from database import get_db
from sql_models import Proveedor, Gasto
from models import Supplier, SupplierCreate, SupplierUpdate

router = APIRouter()

@router.get("/", response_model=List[Supplier])
def get_suppliers(db: Session = Depends(get_db)):
    """Get all suppliers ordered by name"""
    suppliers = db.query(Proveedor).order_by(Proveedor.nombre).all()
    return suppliers

@router.post("/", response_model=Supplier, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier: SupplierCreate, db: Session = Depends(get_db)):
    """Create a new supplier"""
    try:
        db_supplier = Proveedor(**supplier.dict())
        db.add(db_supplier)
        db.commit()
        db.refresh(db_supplier)
        return db_supplier
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{supplier_id}", response_model=Supplier)
def update_supplier(supplier_id: int, supplier: SupplierUpdate, db: Session = Depends(get_db)):
    """Update an existing supplier"""
    db_supplier = db.query(Proveedor).filter(Proveedor.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    for key, value in supplier.dict(exclude_unset=True).items():
        setattr(db_supplier, key, value)
    
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """Delete a supplier (only if no associated expenses)"""
    # Check for associated expenses
    expense_count = db.query(Gasto).filter(Gasto.proveedor_id == supplier_id).count()
    if expense_count > 0:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete supplier with associated expenses."
        )
    
    db_supplier = db.query(Proveedor).filter(Proveedor.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    db.delete(db_supplier)
    db.commit()
    return {"message": "Supplier deleted"}

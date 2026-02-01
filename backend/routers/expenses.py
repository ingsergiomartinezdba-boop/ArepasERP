from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..sql_models import Gasto, Proveedor
from ..models import Expense, ExpenseCreate
from ..utils import get_now_colombia

router = APIRouter()

@router.get("/", response_model=List[Expense])
def get_expenses(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get expenses with optional date filtering"""
    query = db.query(Gasto).outerjoin(Proveedor).order_by(Gasto.fecha.desc())
    
    if start_date and end_date:
        # Parse dates
        query = query.filter(Gasto.fecha >= start_date, Gasto.fecha <= end_date)
    else:
        query = query.limit(100)
    
    expenses = query.all()
    
    # Convert to dict and add proveedor_nombre
    result = []
    for expense in expenses:
        expense_dict = {
            "id": expense.id,
            "concepto": expense.concepto,
            "categoria": expense.categoria,
            "tipo_gasto": expense.tipo_gasto,
            "fecha": expense.fecha,
            "valor": float(expense.valor),
            "proveedor_id": expense.proveedor_id,
            "medio_pago_id": expense.medio_pago_id,
            "pedido_id": expense.pedido_id,
            "observaciones": expense.observaciones,
            "created_at": expense.created_at,
            "proveedor_nombre": None
        }
        
        # Get proveedor nombre if exists
        if expense.proveedor_id:
            proveedor = db.query(Proveedor).filter(Proveedor.id == expense.proveedor_id).first()
            if proveedor:
                expense_dict["proveedor_nombre"] = proveedor.nombre
        
        result.append(expense_dict)
    
    return result

@router.post("/", response_model=Expense, status_code=status.HTTP_201_CREATED)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    """Create a new expense"""
    try:
        expense_data = expense.dict()
        
        db_expense = Gasto(**expense_data)
        db.add(db_expense)
        db.commit()
        db.refresh(db_expense)
        
        # Get proveedor nombre for response
        expense_dict = {
            "id": db_expense.id,
            "concepto": db_expense.concepto,
            "categoria": db_expense.categoria,
            "tipo_gasto": db_expense.tipo_gasto,
            "fecha": db_expense.fecha,
            "valor": float(db_expense.valor),
            "proveedor_id": db_expense.proveedor_id,
            "medio_pago_id": db_expense.medio_pago_id,
            "pedido_id": db_expense.pedido_id,
            "observaciones": db_expense.observaciones,
            "created_at": db_expense.created_at,
            "proveedor_nombre": None
        }
        
        if db_expense.proveedor_id:
            proveedor = db.query(Proveedor).filter(Proveedor.id == db_expense.proveedor_id).first()
            if proveedor:
                expense_dict["proveedor_nombre"] = proveedor.nombre
        
        return expense_dict
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{expense_id}", response_model=Expense)
def update_expense(expense_id: int, expense_update: ExpenseCreate, db: Session = Depends(get_db)):
    """Update an existing expense"""
    db_expense = db.query(Gasto).filter(Gasto.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    for key, value in expense_update.dict(exclude_unset=True).items():
        setattr(db_expense, key, value)
    
    db.commit()
    db.refresh(db_expense)
    
    # Get proveedor nombre for response
    expense_dict = {
        "id": db_expense.id,
        "concepto": db_expense.concepto,
        "categoria": db_expense.categoria,
        "tipo_gasto": db_expense.tipo_gasto,
        "fecha": db_expense.fecha,
        "valor": float(db_expense.valor),
        "proveedor_id": db_expense.proveedor_id,
        "medio_pago_id": db_expense.medio_pago_id,
        "pedido_id": db_expense.pedido_id,
        "observaciones": db_expense.observaciones,
        "created_at": db_expense.created_at,
        "proveedor_nombre": None
    }
    
    if db_expense.proveedor_id:
        proveedor = db.query(Proveedor).filter(Proveedor.id == db_expense.proveedor_id).first()
        if proveedor:
            expense_dict["proveedor_nombre"] = proveedor.nombre
    
    return expense_dict

@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    """Delete an expense"""
    db_expense = db.query(Gasto).filter(Gasto.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    db.delete(db_expense)
    db.commit()
    return {"message": "Expense deleted"}

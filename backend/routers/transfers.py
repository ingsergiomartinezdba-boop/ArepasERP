from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from ..database import get_db
from ..sql_models import Transferencia, MedioPago
from ..models import Transfer, TransferCreate
from ..utils import get_now_colombia

router = APIRouter(tags=["transfers"])

@router.get("/", response_model=List[Transfer])
def get_transfers(db: Session = Depends(get_db)):
    """Get all transfers with payment method names"""
    transfers = db.query(Transferencia).order_by(Transferencia.fecha.desc()).all()
    
    if not transfers:
        return []
    
    # Get payment methods for mapping
    methods = db.query(MedioPago).all()
    methods_map = {m.id: m.nombre for m in methods}
    
    # Convert to dict and add names
    result = []
    for t in transfers:
        transfer_dict = {
            "id": t.id,
            "origen_id": t.origen_id,
            "destino_id": t.destino_id,
            "valor": float(t.valor),
            "fecha": t.fecha,
            "descripcion": t.descripcion,
            "created_by": t.created_by,
            "created_at": t.created_at,
            "origen_nombre": methods_map.get(t.origen_id, "Desconocido"),
            "destino_nombre": methods_map.get(t.destino_id, "Desconocido")
        }
        result.append(transfer_dict)
    
    return result

@router.post("/", response_model=Transfer)
def create_transfer(transfer: TransferCreate, db: Session = Depends(get_db)):
    """Create a new transfer"""
    try:
        transfer_data = transfer.dict()
        if not transfer_data.get('fecha'):
            transfer_data['fecha'] = get_now_colombia().date()
        
        db_transfer = Transferencia(**transfer_data)
        db.add(db_transfer)
        db.commit()
        db.refresh(db_transfer)
        
        # Add method names for response
        methods = db.query(MedioPago).all()
        methods_map = {m.id: m.nombre for m in methods}
        
        result = {
            "id": db_transfer.id,
            "origen_id": db_transfer.origen_id,
            "destino_id": db_transfer.destino_id,
            "valor": float(db_transfer.valor),
            "fecha": db_transfer.fecha,
            "descripcion": db_transfer.descripcion,
            "created_by": db_transfer.created_by,
            "created_at": db_transfer.created_at,
            "origen_nombre": methods_map.get(db_transfer.origen_id, "Desconocido"),
            "destino_nombre": methods_map.get(db_transfer.destino_id, "Desconocido")
        }
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{id}", response_model=Transfer)
def update_transfer(id: int, transfer: TransferCreate, db: Session = Depends(get_db)):
    """Update an existing transfer"""
    db_transfer = db.query(Transferencia).filter(Transferencia.id == id).first()
    if not db_transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    for key, value in transfer.dict(exclude_unset=True).items():
        setattr(db_transfer, key, value)
    
    db.commit()
    db.refresh(db_transfer)
    
    # Add method names for response
    methods = db.query(MedioPago).all()
    methods_map = {m.id: m.nombre for m in methods}
    
    result = {
        "id": db_transfer.id,
        "origen_id": db_transfer.origen_id,
        "destino_id": db_transfer.destino_id,
        "valor": float(db_transfer.valor),
        "fecha": db_transfer.fecha,
        "descripcion": db_transfer.descripcion,
        "created_by": db_transfer.created_by,
        "created_at": db_transfer.created_at,
        "origen_nombre": methods_map.get(db_transfer.origen_id, "Desconocido"),
        "destino_nombre": methods_map.get(db_transfer.destino_id, "Desconocido")
    }
    return result

@router.delete("/{id}")
def delete_transfer(id: int, db: Session = Depends(get_db)):
    """Delete a transfer"""
    db_transfer = db.query(Transferencia).filter(Transferencia.id == id).first()
    if not db_transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    db.delete(db_transfer)
    db.commit()
    return {"message": "Transfer deleted successfully"}

@router.get("/balances")
def get_balances(db: Session = Depends(get_db)):
    """Get balances from view_saldos_medios_pago"""
    try:
        # Query the view directly
        result = db.execute(text("SELECT * FROM view_saldos_medios_pago")).fetchall()
        
        # Convert to list of dicts
        balances = []
        for row in result:
            balances.append({
                "id": row[0],
                "nombre": row[1],
                "tipo": row[2],
                "ingresos": float(row[3]) if row[3] else 0,
                "egresos": float(row[4]) if row[4] else 0,
                "saldo": float(row[5]) if row[5] else 0
            })
        return balances
    except Exception as e:
        print(f"Error fetching balances: {e}")
        return []

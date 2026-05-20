import logging
from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from sql_models import Proveedor, Gasto, Insumo, InsumoProveedor
from auth import require_internal_permission
from models import Supplier, SupplierCreate, SupplierUpdate

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[Supplier], dependencies=[Depends(require_internal_permission("proveedores.ver"))])
def get_suppliers(db: Session = Depends(get_db)):
    """Get all suppliers ordered by name"""
    suppliers = db.query(Proveedor).order_by(Proveedor.nombre).all()
    return suppliers

@router.post("/", response_model=Supplier, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_internal_permission("proveedores.crear"))])
def create_supplier(supplier: SupplierCreate, db: Session = Depends(get_db)):
    """Create a new supplier"""
    try:
        safe_fields = {"nombre", "contacto", "telefono", "email", "direccion", "activo"}
        data = {k: v for k, v in supplier.model_dump().items() if k in safe_fields and v is not None}
        db_supplier = Proveedor(**data)
        db.add(db_supplier)
        db.commit()
        db.refresh(db_supplier)
        return db_supplier
    except Exception as e:
        db.rollback()
        logger.error("Error creating supplier: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al crear el proveedor")

@router.put("/{supplier_id}", response_model=Supplier, dependencies=[Depends(require_internal_permission("proveedores.editar"))])
def update_supplier(supplier_id: int, supplier: SupplierUpdate, db: Session = Depends(get_db)):
    """Update an existing supplier"""
    db_supplier = db.query(Proveedor).filter(Proveedor.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    safe_fields = {"nombre", "contacto", "telefono", "email", "direccion", "activo"}
    for key, value in supplier.model_dump(exclude_unset=True).items():
        if key in safe_fields:
            setattr(db_supplier, key, value)
    
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@router.delete("/{supplier_id}", dependencies=[Depends(require_internal_permission("proveedores.eliminar"))])
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


# ============================================================================
# INSUMOS POR PROVEEDOR  (relación N:M con costo)
# ============================================================================

class InsumoProveedorRow(BaseModel):
    id: int
    insumo_id: int
    insumo_nombre: str
    unidad_medida: str
    ultimo_costo_unitario: Optional[float] = None
    costo_promedio_insumo: Optional[float] = None
    ultima_compra_fecha: Optional[date] = None
    unidades_por_paquete: Optional[float] = None
    activo: bool


class AsignarInsumoRequest(BaseModel):
    insumo_id: int
    costo_unitario_referencia: Optional[float] = None
    unidades_por_paquete: Optional[float] = None


class PreviewImpacto(BaseModel):
    insumo_nombre: str
    unidad_medida: str
    costo_promedio_actual: float
    costo_referencia: Optional[float] = None
    delta_pct: Optional[float] = None
    proveedores_actuales: int


def _row_dict(r: InsumoProveedor, costo_promedio: Optional[float]) -> dict:
    return {
        "id": r.id,
        "insumo_id": r.insumo_id,
        "insumo_nombre": r.insumo.nombre if r.insumo else "",
        "unidad_medida": r.insumo.unidad_medida if r.insumo else "",
        "ultimo_costo_unitario": float(r.ultimo_costo_unitario) if r.ultimo_costo_unitario is not None else None,
        "costo_promedio_insumo": costo_promedio,
        "ultima_compra_fecha": r.ultima_compra_fecha,
        "unidades_por_paquete": float(r.unidades_por_paquete) if r.unidades_por_paquete is not None else None,
        "activo": bool(r.activo),
    }


@router.get("/{supplier_id}/insumos", response_model=List[InsumoProveedorRow], dependencies=[Depends(require_internal_permission("proveedores.ver"))])
def list_insumos_proveedor(supplier_id: int, db: Session = Depends(get_db)):
    """Lista insumos que vende un proveedor con su último costo y el promedio
    ponderado actual del insumo (para visualizar el diferencial)."""
    if not db.query(Proveedor).filter(Proveedor.id == supplier_id).first():
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    rows = (
        db.query(InsumoProveedor)
          .join(Insumo, Insumo.id == InsumoProveedor.insumo_id)
          .filter(InsumoProveedor.proveedor_id == supplier_id)
          .order_by(Insumo.nombre)
          .all()
    )
    out = []
    for r in rows:
        promedio = float(r.insumo.costo_unitario) if r.insumo and r.insumo.costo_unitario else None
        out.append(_row_dict(r, promedio))
    return out


@router.post("/{supplier_id}/insumos", response_model=InsumoProveedorRow, status_code=201, dependencies=[Depends(require_internal_permission("proveedores.editar"))])
def asignar_insumo_a_proveedor(
    supplier_id: int,
    data: AsignarInsumoRequest,
    db: Session = Depends(get_db),
):
    """Asigna un insumo existente a un proveedor. Crea o reactiva la relación.

    No registra un gasto (eso se hace desde el módulo de gastos). Si se
    proporciona costo_unitario_referencia, queda como ultimo_costo_unitario
    pero NO afecta insumos.costo_unitario (el promedio se mueve solo con gastos).
    """
    if not db.query(Proveedor).filter(Proveedor.id == supplier_id).first():
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    insumo = db.query(Insumo).filter(Insumo.id == data.insumo_id).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")

    rel = (
        db.query(InsumoProveedor)
          .filter(InsumoProveedor.insumo_id == data.insumo_id,
                  InsumoProveedor.proveedor_id == supplier_id)
          .first()
    )

    uds_paquete = (Decimal(str(data.unidades_por_paquete))
                   if data.unidades_por_paquete is not None
                   else insumo.unidades_por_paquete)
    costo_ref = (Decimal(str(data.costo_unitario_referencia))
                 if data.costo_unitario_referencia is not None
                 else None)

    if rel:
        rel.activo = True
        if costo_ref is not None:
            rel.ultimo_costo_unitario = costo_ref
        if uds_paquete is not None:
            rel.unidades_por_paquete = uds_paquete
    else:
        rel = InsumoProveedor(
            insumo_id=data.insumo_id,
            proveedor_id=supplier_id,
            ultimo_costo_unitario=costo_ref,
            unidades_por_paquete=uds_paquete,
            activo=True,
        )
        db.add(rel)

    db.commit()
    db.refresh(rel)
    promedio = float(insumo.costo_unitario) if insumo.costo_unitario else None
    return _row_dict(rel, promedio)


@router.delete("/{supplier_id}/insumos/{insumo_id}", dependencies=[Depends(require_internal_permission("proveedores.editar"))])
def desasignar_insumo_de_proveedor(supplier_id: int, insumo_id: int,
                                   db: Session = Depends(get_db)):
    """Marca la relación como inactiva (no borra histórico de gastos)."""
    rel = (
        db.query(InsumoProveedor)
          .filter(InsumoProveedor.insumo_id == insumo_id,
                  InsumoProveedor.proveedor_id == supplier_id)
          .first()
    )
    if not rel:
        raise HTTPException(status_code=404, detail="Relación no encontrada")
    rel.activo = False
    db.commit()
    return {"message": "Relación desactivada"}


@router.get("/{supplier_id}/insumos/{insumo_id}/preview", response_model=PreviewImpacto, dependencies=[Depends(require_internal_permission("proveedores.ver"))])
def preview_impacto_costo(
    supplier_id: int,
    insumo_id: int,
    costo: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """Devuelve el costo promedio actual del insumo y, si se pasa `costo`, el
    diferencial porcentual respecto al promedio. No persiste nada."""
    insumo = db.query(Insumo).filter(Insumo.id == insumo_id).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")
    proveedores_actuales = (
        db.query(InsumoProveedor)
          .filter(InsumoProveedor.insumo_id == insumo_id,
                  InsumoProveedor.activo == True)
          .count()
    )
    promedio = float(insumo.costo_unitario) if insumo.costo_unitario else 0.0
    delta_pct = None
    if costo is not None and promedio > 0:
        delta_pct = ((costo - promedio) / promedio) * 100.0
    return {
        "insumo_nombre": insumo.nombre,
        "unidad_medida": insumo.unidad_medida,
        "costo_promedio_actual": promedio,
        "costo_referencia": costo,
        "delta_pct": delta_pct,
        "proveedores_actuales": proveedores_actuales,
    }

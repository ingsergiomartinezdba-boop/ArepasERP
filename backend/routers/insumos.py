import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel, Field
from database import get_db
from sql_models import Insumo, MovimientoInsumo, LoteProduccionInsumo, Gasto
from auth import require_internal_permission

router = APIRouter(tags=["insumos"])
logger = logging.getLogger(__name__)


# ── Schemas ────────────────────────────────────────────────
class InsumoCreate(BaseModel):
    nombre: str
    unidad_medida: str = "kg"
    costo_unitario: Optional[float] = 0
    activo: bool = True
    proveedor_id: Optional[int] = None
    unidades_por_paquete: Optional[float] = None

class InsumoUpdate(BaseModel):
    nombre: Optional[str] = None
    unidad_medida: Optional[str] = None
    costo_unitario: Optional[float] = None
    activo: Optional[bool] = None
    proveedor_id: Optional[int] = None
    unidades_por_paquete: Optional[float] = None

class InsumoResponse(BaseModel):
    id: int
    nombre: str
    unidad_medida: str
    cantidad_actual: float
    costo_unitario: float
    activo: bool
    proveedor_id: Optional[int] = None
    unidades_por_paquete: Optional[float] = None
    costo_paquete: Optional[float] = None
    class Config:
        from_attributes = True

class AjusteInsumo(BaseModel):
    cantidad: float = Field(..., description="Positivo=entrada, negativo=salida")
    notas: Optional[str] = None

class MovimientoResponse(BaseModel):
    id: int
    insumo_id: int
    tipo: str
    cantidad: float
    costo_total: Optional[float] = None
    origen: Optional[str] = None
    referencia_id: Optional[int] = None
    notas: Optional[str] = None
    fecha: Optional[str] = None
    class Config:
        from_attributes = True


# ── CRUD Insumos ────────────────────────────────────────────
@router.get("/", response_model=List[InsumoResponse], dependencies=[Depends(require_internal_permission("insumos.ver"))])
def get_insumos(
    activo_only: bool = False,
    proveedor_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Insumo)
    if activo_only:
        q = q.filter(Insumo.activo == True)
    if proveedor_id:
        q = q.filter(Insumo.proveedor_id == proveedor_id)
    return [_to_dict(i) for i in q.order_by(Insumo.nombre).all()]


@router.get("/{insumo_id}", response_model=InsumoResponse, dependencies=[Depends(require_internal_permission("insumos.ver"))])
def get_insumo(insumo_id: int, db: Session = Depends(get_db)):
    ins = db.query(Insumo).filter(Insumo.id == insumo_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")
    return _to_dict(ins)


@router.post("/", response_model=InsumoResponse, dependencies=[Depends(require_internal_permission("insumos.crear"))])
def create_insumo(data: InsumoCreate, db: Session = Depends(get_db)):
    ins = Insumo(
        nombre=data.nombre,
        unidad_medida=data.unidad_medida,
        costo_unitario=data.costo_unitario,
        activo=data.activo,
        proveedor_id=data.proveedor_id,
        unidades_por_paquete=data.unidades_por_paquete,
    )
    db.add(ins)
    db.commit()
    db.refresh(ins)
    return _to_dict(ins)


@router.put("/{insumo_id}", response_model=InsumoResponse, dependencies=[Depends(require_internal_permission("insumos.editar"))])
def update_insumo(insumo_id: int, data: InsumoUpdate, db: Session = Depends(get_db)):
    ins = db.query(Insumo).filter(Insumo.id == insumo_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(ins, field, val)
    db.commit()
    db.refresh(ins)
    return _to_dict(ins)


@router.delete("/{insumo_id}", dependencies=[Depends(require_internal_permission("insumos.editar"))])
def delete_insumo(insumo_id: int, db: Session = Depends(get_db)):
    ins = db.query(Insumo).filter(Insumo.id == insumo_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")
    if db.query(Gasto).filter(Gasto.insumo_id == insumo_id).first():
        raise HTTPException(status_code=400, detail="No se puede eliminar: el insumo tiene gastos registrados.")
    if db.query(LoteProduccionInsumo).filter(LoteProduccionInsumo.insumo_id == insumo_id).first():
        raise HTTPException(status_code=400, detail="No se puede eliminar: el insumo está asociado a lotes de producción.")
    db.delete(ins)
    db.commit()
    return {"message": "Insumo eliminado"}


# ── Ajuste manual de stock ──────────────────────────────────
@router.post("/{insumo_id}/ajuste", response_model=InsumoResponse, dependencies=[Depends(require_internal_permission("insumos.editar"))])
def ajustar_stock(insumo_id: int, data: AjusteInsumo, db: Session = Depends(get_db)):
    ins = db.query(Insumo).filter(Insumo.id == insumo_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")

    nueva_cantidad = float(ins.cantidad_actual or 0) + data.cantidad
    if nueva_cantidad < 0:
        raise HTTPException(status_code=400, detail="El stock no puede quedar negativo")

    tipo = "entrada" if data.cantidad > 0 else "salida"
    ins.cantidad_actual = nueva_cantidad

    mov = MovimientoInsumo(
        insumo_id=insumo_id,
        tipo="ajuste",
        cantidad=abs(data.cantidad),
        origen="ajuste_manual",
        notas=data.notas or f"Ajuste manual ({'+' if data.cantidad > 0 else '-'}{abs(data.cantidad)})",
    )
    db.add(mov)
    db.commit()
    db.refresh(ins)
    return _to_dict(ins)


# ── Movimientos ─────────────────────────────────────────────
@router.get("/{insumo_id}/movimientos", response_model=List[MovimientoResponse], dependencies=[Depends(require_internal_permission("insumos.ver"))])
def get_movimientos(insumo_id: int, db: Session = Depends(get_db)):
    movs = (
        db.query(MovimientoInsumo)
        .filter(MovimientoInsumo.insumo_id == insumo_id)
        .order_by(MovimientoInsumo.fecha.desc(), MovimientoInsumo.id.desc())
        .limit(100)
        .all()
    )
    return [_mov_dict(m) for m in movs]


# ── Vista stock ─────────────────────────────────────────────
@router.get("/stock/resumen", dependencies=[Depends(require_internal_permission("insumos.ver"))])
def get_stock_resumen(db: Session = Depends(get_db)):
    try:
        rows = db.execute(text(
            "SELECT id, nombre, unidad_medida, cantidad_actual, costo_unitario, activo, "
            "total_entradas, total_salidas FROM view_stock_insumos"
        )).fetchall()
        return [
            {
                "id": r[0], "nombre": r[1], "unidad_medida": r[2],
                "cantidad_actual": float(r[3]), "costo_unitario": float(r[4]),
                "activo": r[5], "total_entradas": float(r[6]), "total_salidas": float(r[7]),
            }
            for r in rows
        ]
    except Exception:
        # Vista no existe aún — fallback directo
        insumos = db.query(Insumo).order_by(Insumo.nombre).all()
        return [_to_dict(i) for i in insumos]


# ── helpers ─────────────────────────────────────────────────
def _to_dict(i: Insumo) -> dict:
    return {
        "id": i.id, "nombre": i.nombre, "unidad_medida": i.unidad_medida,
        "cantidad_actual": float(i.cantidad_actual or 0),
        "costo_unitario": float(i.costo_unitario or 0),
        "activo": bool(i.activo),
        "proveedor_id": i.proveedor_id,
        "unidades_por_paquete": float(i.unidades_por_paquete) if i.unidades_por_paquete else None,
        "costo_paquete": float(i.costo_paquete) if i.costo_paquete else None,
    }

def _mov_dict(m: MovimientoInsumo) -> dict:
    return {
        "id": m.id, "insumo_id": m.insumo_id, "tipo": m.tipo,
        "cantidad": float(m.cantidad), "costo_total": float(m.costo_total or 0),
        "origen": m.origen, "referencia_id": m.referencia_id,
        "notas": m.notas, "fecha": str(m.fecha) if m.fecha else None,
    }

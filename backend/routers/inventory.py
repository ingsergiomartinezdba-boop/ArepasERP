import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from database import get_db
from sql_models import Inventario, MovimientoInventario, Producto
from auth import require_internal_permission
from models import InventarioItem, MovimientoCreate, MovimientoResponse, AjusteInventario
from utils import get_now_colombia

router = APIRouter(tags=["inventory"])
logger = logging.getLogger(__name__)


def _ensure_inventario_row(db: Session, producto_id: int) -> Inventario:
    """Garantiza que exista fila en inventario para el producto."""
    row = db.query(Inventario).filter(Inventario.producto_id == producto_id).first()
    if not row:
        row = Inventario(producto_id=producto_id, cantidad=0)
        db.add(row)
        db.flush()
    return row


# ── GET /inventory/ ─────────────────────────────────────────────────────────
@router.get("/", response_model=List[InventarioItem], dependencies=[Depends(require_internal_permission("inventario.ver"))])
def get_inventory(db: Session = Depends(get_db)):
    """Stock actual de todos los productos."""
    rows = (
        db.query(Inventario)
        .options(joinedload(Inventario.producto))
        .order_by(Inventario.producto_id)
        .all()
    )
    result = []
    for r in rows:
        result.append(InventarioItem(
            producto_id=r.producto_id,
            cantidad=float(r.cantidad),
            producto_nombre=r.producto.nombre if r.producto else None,
            tipo_producto=r.producto.tipo_producto if r.producto else None,
        ))
    return result


# ── GET /inventory/{producto_id} ─────────────────────────────────────────────
@router.get("/{producto_id}", response_model=InventarioItem, dependencies=[Depends(require_internal_permission("inventario.ver"))])
def get_stock(producto_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(Inventario)
        .options(joinedload(Inventario.producto))
        .filter(Inventario.producto_id == producto_id)
        .first()
    )
    if not row:
        producto = db.query(Producto).filter(Producto.id == producto_id).first()
        if not producto:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return InventarioItem(
            producto_id=producto_id,
            cantidad=0.0,
            producto_nombre=producto.nombre,
            tipo_producto=producto.tipo_producto,
        )
    return InventarioItem(
        producto_id=row.producto_id,
        cantidad=float(row.cantidad),
        producto_nombre=row.producto.nombre if row.producto else None,
        tipo_producto=row.producto.tipo_producto if row.producto else None,
    )


# ── POST /inventory/entrada ──────────────────────────────────────────────────
@router.post("/entrada", response_model=MovimientoResponse, status_code=201, dependencies=[Depends(require_internal_permission("inventario.ajustar"))])
def registrar_entrada(data: MovimientoCreate, db: Session = Depends(get_db)):
    """Registra una entrada de inventario (compra de insumos)."""
    if data.tipo not in ("entrada", "salida", "ajuste"):
        raise HTTPException(status_code=400, detail="tipo debe ser: entrada | salida | ajuste")

    row = _ensure_inventario_row(db, data.producto_id)

    if data.tipo == "entrada":
        row.cantidad = float(row.cantidad) + data.cantidad
    elif data.tipo == "salida":
        if float(row.cantidad) < data.cantidad:
            raise HTTPException(status_code=400, detail="Stock insuficiente")
        row.cantidad = float(row.cantidad) - data.cantidad
    else:  # ajuste
        row.cantidad = data.cantidad

    mov = MovimientoInventario(
        producto_id=data.producto_id,
        tipo=data.tipo,
        cantidad=data.cantidad,
        origen=data.origen or "manual",
        referencia_id=data.referencia_id,
        fecha=data.fecha or get_now_colombia(),
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)

    producto = db.query(Producto).filter(Producto.id == data.producto_id).first()
    return MovimientoResponse(
        id=mov.id,
        producto_id=mov.producto_id,
        tipo=mov.tipo,
        cantidad=float(mov.cantidad),
        origen=mov.origen,
        referencia_id=mov.referencia_id,
        fecha=mov.fecha,
        producto_nombre=producto.nombre if producto else None,
    )


# ── POST /inventory/ajuste ───────────────────────────────────────────────────
@router.post("/ajuste", response_model=MovimientoResponse, status_code=201, dependencies=[Depends(require_internal_permission("inventario.ajustar"))])
def ajustar_inventario(data: AjusteInventario, db: Session = Depends(get_db)):
    """Ajusta el stock absoluto de un producto y registra el movimiento."""
    row = _ensure_inventario_row(db, data.producto_id)
    anterior = float(row.cantidad)
    diferencia = data.cantidad_nueva - anterior
    row.cantidad = data.cantidad_nueva

    tipo = "entrada" if diferencia >= 0 else "salida"
    mov = MovimientoInventario(
        producto_id=data.producto_id,
        tipo="ajuste",
        cantidad=abs(diferencia),
        origen=data.motivo or "ajuste_manual",
        fecha=get_now_colombia(),
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)

    producto = db.query(Producto).filter(Producto.id == data.producto_id).first()
    return MovimientoResponse(
        id=mov.id,
        producto_id=mov.producto_id,
        tipo=mov.tipo,
        cantidad=float(mov.cantidad),
        origen=mov.origen,
        referencia_id=mov.referencia_id,
        fecha=mov.fecha,
        producto_nombre=producto.nombre if producto else None,
    )


# ── GET /inventory/movimientos/ ──────────────────────────────────────────────
@router.get("/movimientos/", response_model=List[MovimientoResponse], dependencies=[Depends(require_internal_permission("inventario.ver"))])
def get_movimientos(
    producto_id: Optional[int] = Query(None),
    tipo: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(MovimientoInventario).options(joinedload(MovimientoInventario.producto))
    if producto_id:
        q = q.filter(MovimientoInventario.producto_id == producto_id)
    if tipo:
        q = q.filter(MovimientoInventario.tipo == tipo)
    movs = q.order_by(desc(MovimientoInventario.fecha), desc(MovimientoInventario.id)).limit(limit).all()

    return [
        MovimientoResponse(
            id=m.id,
            producto_id=m.producto_id,
            tipo=m.tipo,
            cantidad=float(m.cantidad),
            origen=m.origen,
            referencia_id=m.referencia_id,
            fecha=m.fecha,
            producto_nombre=m.producto.nombre if m.producto else None,
        )
        for m in movs
    ]

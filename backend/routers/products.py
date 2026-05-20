import logging
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from database import get_db
from sql_models import Producto, ProductoInsumo
from models import Product, ProductCreate
from auth import require_internal_permission

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Schemas ────────────────────────────────────────────────────────────────────
class ProductoInsumoIn(BaseModel):
    insumo_id: int
    cantidad: float  # cantidad del insumo por unidad de producto

class ProductoInsumoOut(BaseModel):
    insumo_id: int
    insumo_nombre: str
    unidad_medida: str
    cantidad: float
    costo_unitario: float
    costo_linea: float

class CostoResponse(BaseModel):
    producto_id: int
    producto_nombre: str
    insumos: List[ProductoInsumoOut]
    costo_total: float         # suma de cantidad × costo_unitario de todos los insumos
    costo_actual: float        # costo guardado actualmente en el producto

@router.get("/", response_model=List[Product], dependencies=[Depends(require_internal_permission("productos.ver"))])
def get_products(
    active_only: bool = Query(True, description="Filter by active status"),
    db: Session = Depends(get_db)
):
    """Get all products, optionally filtered by active status"""
    query = db.query(Producto).order_by(Producto.nombre)
    if active_only:
        query = query.filter(Producto.activo == True)
    return query.all()

@router.post("/", response_model=Product, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_internal_permission("productos.crear"))])
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product"""
    try:
        safe_fields = {"nombre", "codigo_corto", "tipo_producto", "precio", "costo", "activo"}
        data = {k: v for k, v in product.model_dump().items() if k in safe_fields and v is not None}
        db_product = Producto(**data)
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
        return db_product
    except Exception as e:
        db.rollback()
        logger.error("Error in products router: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.put("/{product_id}", response_model=Product, dependencies=[Depends(require_internal_permission("productos.editar"))])
def update_product(product_id: int, product: ProductCreate, db: Session = Depends(get_db)):
    """Update an existing product"""
    db_product = db.query(Producto).filter(Producto.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    safe_fields = {"nombre", "codigo_corto", "tipo_producto", "precio", "costo", "activo"}
    for key, value in product.model_dump(exclude_unset=True).items():
        if key in safe_fields:
            setattr(db_product, key, value)
    
    db.commit()
    db.refresh(db_product)
    return db_product


# ── Insumos por producto ──────────────────────────────────────────────────────

@router.get("/insumos/all", dependencies=[Depends(require_internal_permission("productos.ver"))])
def get_all_producto_insumos(db: Session = Depends(get_db)):
    """Devuelve TODAS las filas producto_insumos del sistema en un único request.

    Útil para el módulo Production que necesita calcular masa-por-producto
    sin disparar N requests por producto.
    """
    rows = (
        db.query(ProductoInsumo)
        .options(joinedload(ProductoInsumo.insumo))
        .all()
    )
    return [
        {
            "producto_id":   r.producto_id,
            "insumo_id":     r.insumo_id,
            "insumo_nombre": r.insumo.nombre if r.insumo else None,
            "unidad_medida": r.insumo.unidad_medida if r.insumo else None,
            "cantidad":      float(r.cantidad),
        }
        for r in rows
    ]


@router.get("/{product_id}/insumos", dependencies=[Depends(require_internal_permission("productos.ver"))])
def get_producto_insumos(product_id: int, db: Session = Depends(get_db)):
    """Devuelve los insumos de empaque asociados al producto."""
    rows = (
        db.query(ProductoInsumo)
        .options(joinedload(ProductoInsumo.insumo))
        .filter(ProductoInsumo.producto_id == product_id)
        .all()
    )
    return [
        {
            "id": r.id,
            "insumo_id": r.insumo_id,
            "insumo_nombre": r.insumo.nombre if r.insumo else None,
            "unidad_medida": r.insumo.unidad_medida if r.insumo else None,
            "cantidad": float(r.cantidad),
            "costo_unitario": float(r.insumo.costo_unitario) if r.insumo else 0,
        }
        for r in rows
    ]


@router.put("/{product_id}/insumos", dependencies=[Depends(require_internal_permission("productos.editar"))])
def save_producto_insumos(product_id: int, insumos: List[ProductoInsumoIn], db: Session = Depends(get_db)):
    """Reemplaza los insumos de empaque del producto."""
    db.query(ProductoInsumo).filter(ProductoInsumo.producto_id == product_id).delete()
    for item in insumos:
        db.add(ProductoInsumo(producto_id=product_id, insumo_id=item.insumo_id, cantidad=item.cantidad))
    db.commit()
    return {"ok": True}


@router.get("/{product_id}/costo", response_model=CostoResponse, dependencies=[Depends(require_internal_permission("productos.ver"))])
def calcular_costo(product_id: int, db: Session = Depends(get_db)):
    """Calcula el costo unitario del producto sumando todos los insumos asociados.

    La masa es un insumo más en la grilla de insumos del producto, con su
    costo_unitario actualizado por la cocción más reciente.
    """
    producto = db.query(Producto).filter(Producto.id == product_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    pi_rows = (
        db.query(ProductoInsumo)
        .options(joinedload(ProductoInsumo.insumo))
        .filter(ProductoInsumo.producto_id == product_id)
        .all()
    )
    insumos_out: list[ProductoInsumoOut] = []
    costo_total = 0.0
    for pi in pi_rows:
        cu = float(pi.insumo.costo_unitario) if pi.insumo and pi.insumo.costo_unitario else 0.0
        cl = round(float(pi.cantidad) * cu, 2)
        costo_total += cl
        insumos_out.append(ProductoInsumoOut(
            insumo_id=pi.insumo_id,
            insumo_nombre=pi.insumo.nombre if pi.insumo else "",
            unidad_medida=pi.insumo.unidad_medida if pi.insumo else "",
            cantidad=float(pi.cantidad),
            costo_unitario=cu,
            costo_linea=cl,
        ))

    return CostoResponse(
        producto_id=producto.id,
        producto_nombre=producto.nombre,
        insumos=insumos_out,
        costo_total=round(costo_total, 2),
        costo_actual=float(producto.costo or 0),
    )


@router.post("/{product_id}/costo/aplicar", dependencies=[Depends(require_internal_permission("productos.editar"))])
def aplicar_costo(product_id: int, db: Session = Depends(get_db)):
    """Guarda el costo calculado en el campo costo del producto."""
    from routers.products import calcular_costo
    resultado = calcular_costo(product_id, db)
    producto = db.query(Producto).filter(Producto.id == product_id).first()
    producto.costo = resultado.costo_total
    db.commit()
    return {"ok": True, "costo_nuevo": resultado.costo_total}

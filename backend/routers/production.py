import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from database import get_db
from sql_models import (
    ProduccionProceso, ProduccionDetalle,
    Inventario, MovimientoInventario, Producto,
    LoteProduccion, LoteProduccionInsumo, Insumo, MovimientoInsumo,
)
from auth import require_internal_permission
from models import (
    ProduccionProcesoCreate, ProduccionProcesoResponse,
    ProduccionDetalleCreate, ProduccionDetalleResponse,
    LoteProduccionCreate, LoteProduccionResponse,
)
from utils import get_now_colombia

router = APIRouter(tags=["production"])
logger = logging.getLogger(__name__)

# Catálogo único: KG para pesos, UNIDAD para discretos
from units import convertir as _convertir  # noqa: E402


def _ensure_inv(db: Session, producto_id: int) -> Inventario:
    row = db.query(Inventario).filter(Inventario.producto_id == producto_id).first()
    if not row:
        row = Inventario(producto_id=producto_id, cantidad=0)
        db.add(row)
        db.flush()
    return row


def _build_proceso_response(p: ProduccionProceso) -> ProduccionProcesoResponse:
    return ProduccionProcesoResponse(
        id=p.id,
        fecha=p.fecha,
        producto_entrada_id=p.producto_entrada_id,
        cantidad_entrada_kg=float(p.cantidad_entrada_kg),
        producto_salida_id=p.producto_salida_id,
        cantidad_salida_kg=float(p.cantidad_salida_kg),
        rendimiento=float(p.rendimiento) if p.rendimiento is not None else None,
        observaciones=p.observaciones,
        producto_entrada_nombre=p.producto_entrada.nombre if p.producto_entrada else None,
        producto_salida_nombre=p.producto_salida.nombre if p.producto_salida else None,
    )


def _build_detalle_response(d: ProduccionDetalle) -> ProduccionDetalleResponse:
    return ProduccionDetalleResponse(
        id=d.id,
        fecha=d.fecha,
        producto_final_id=d.producto_final_id,
        cantidad_producida=d.cantidad_producida,
        producto_consumido_id=d.producto_consumido_id,
        cantidad_consumida_kg=float(d.cantidad_consumida_kg),
        observaciones=d.observaciones,
        producto_final_nombre=d.producto_final.nombre if d.producto_final else None,
        producto_consumido_nombre=d.producto_consumido.nombre if d.producto_consumido else None,
    )


# ─────────────────────────────────────────────────────────────────────────────
# PROCESO (cocción: insumo → masa)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/proceso", response_model=List[ProduccionProcesoResponse], dependencies=[Depends(require_internal_permission("produccion.ver"))])
def list_procesos(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ProduccionProceso)
        .options(
            joinedload(ProduccionProceso.producto_entrada),
            joinedload(ProduccionProceso.producto_salida),
        )
        .order_by(desc(ProduccionProceso.fecha), desc(ProduccionProceso.id))
        .limit(limit)
        .all()
    )
    return [_build_proceso_response(r) for r in rows]


@router.post("/proceso", response_model=ProduccionProcesoResponse, status_code=201, dependencies=[Depends(require_internal_permission("produccion.crear"))])
def crear_proceso(data: ProduccionProcesoCreate, db: Session = Depends(get_db)):
    """
    Registra una cocción: descuenta insumo del inventario y suma masa producida.
    El rendimiento se calcula automáticamente: (salida / entrada) * 100.
    """
    # Validar productos
    p_entrada = db.query(Producto).filter(Producto.id == data.producto_entrada_id).first()
    p_salida = db.query(Producto).filter(Producto.id == data.producto_salida_id).first()
    if not p_entrada:
        raise HTTPException(status_code=404, detail="Producto de entrada no encontrado")
    if not p_salida:
        raise HTTPException(status_code=404, detail="Producto de salida no encontrado")

    # Verificar stock de entrada
    inv_entrada = _ensure_inv(db, data.producto_entrada_id)
    if float(inv_entrada.cantidad) < data.cantidad_entrada_kg:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente de '{p_entrada.nombre}': "
                   f"disponible {float(inv_entrada.cantidad):.2f} kg, "
                   f"requerido {data.cantidad_entrada_kg:.2f} kg",
        )

    rendimiento = round((data.cantidad_salida_kg / data.cantidad_entrada_kg) * 100, 2)

    proceso = ProduccionProceso(
        fecha=data.fecha or get_now_colombia(),
        producto_entrada_id=data.producto_entrada_id,
        cantidad_entrada_kg=data.cantidad_entrada_kg,
        producto_salida_id=data.producto_salida_id,
        cantidad_salida_kg=data.cantidad_salida_kg,
        rendimiento=rendimiento,
        observaciones=data.observaciones,
    )
    db.add(proceso)
    db.flush()  # obtener ID antes de movimientos

    # ── Descontar insumo ──
    inv_entrada.cantidad = float(inv_entrada.cantidad) - data.cantidad_entrada_kg
    db.add(MovimientoInventario(
        producto_id=data.producto_entrada_id,
        tipo="salida",
        cantidad=data.cantidad_entrada_kg,
        origen="coccion",
        referencia_id=proceso.id,
        fecha=proceso.fecha,
    ))

    # ── Sumar masa producida ──
    inv_salida = _ensure_inv(db, data.producto_salida_id)
    inv_salida.cantidad = float(inv_salida.cantidad) + data.cantidad_salida_kg
    db.add(MovimientoInventario(
        producto_id=data.producto_salida_id,
        tipo="entrada",
        cantidad=data.cantidad_salida_kg,
        origen="coccion",
        referencia_id=proceso.id,
        fecha=proceso.fecha,
    ))

    db.commit()
    db.refresh(proceso)

    # Reload with relationships
    proceso = (
        db.query(ProduccionProceso)
        .options(
            joinedload(ProduccionProceso.producto_entrada),
            joinedload(ProduccionProceso.producto_salida),
        )
        .filter(ProduccionProceso.id == proceso.id)
        .first()
    )
    return _build_proceso_response(proceso)


@router.delete("/proceso/{proceso_id}", status_code=204, dependencies=[Depends(require_internal_permission("produccion.editar"))])
def eliminar_proceso(proceso_id: int, db: Session = Depends(get_db)):
    proceso = db.query(ProduccionProceso).filter(ProduccionProceso.id == proceso_id).first()
    if not proceso:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    # Revertir inventario
    inv_entrada = _ensure_inv(db, proceso.producto_entrada_id)
    inv_entrada.cantidad = float(inv_entrada.cantidad) + float(proceso.cantidad_entrada_kg)

    inv_salida = _ensure_inv(db, proceso.producto_salida_id)
    new_salida = float(inv_salida.cantidad) - float(proceso.cantidad_salida_kg)
    inv_salida.cantidad = max(new_salida, 0)

    db.delete(proceso)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# DETALLE (producción final: masa → arepas)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/detalle", response_model=List[ProduccionDetalleResponse], dependencies=[Depends(require_internal_permission("produccion.ver"))])
def list_detalles(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ProduccionDetalle)
        .options(
            joinedload(ProduccionDetalle.producto_final),
            joinedload(ProduccionDetalle.producto_consumido),
        )
        .order_by(desc(ProduccionDetalle.fecha), desc(ProduccionDetalle.id))
        .limit(limit)
        .all()
    )
    return [_build_detalle_response(r) for r in rows]


@router.post("/detalle", response_model=ProduccionDetalleResponse, status_code=201, dependencies=[Depends(require_internal_permission("produccion.crear"))])
def crear_detalle(data: ProduccionDetalleCreate, db: Session = Depends(get_db)):
    """
    Registra producción final: descuenta masa e incrementa arepas/paquetes.
    El trigger de la BD también descuenta, pero aquí manejamos todo desde Python
    para consistencia. Asegúrate de deshabilitar el trigger si usas este endpoint.
    """
    p_final = db.query(Producto).filter(Producto.id == data.producto_final_id).first()
    p_consumido = db.query(Producto).filter(Producto.id == data.producto_consumido_id).first()
    if not p_final:
        raise HTTPException(status_code=404, detail="Producto final no encontrado")
    if not p_consumido:
        raise HTTPException(status_code=404, detail="Producto consumido no encontrado")

    # Verificar stock de masa
    inv_consumido = _ensure_inv(db, data.producto_consumido_id)
    if float(inv_consumido.cantidad) < data.cantidad_consumida_kg:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente de '{p_consumido.nombre}': "
                   f"disponible {float(inv_consumido.cantidad):.2f} kg, "
                   f"requerido {data.cantidad_consumida_kg:.2f} kg",
        )

    detalle = ProduccionDetalle(
        fecha=data.fecha or get_now_colombia(),
        producto_final_id=data.producto_final_id,
        cantidad_producida=data.cantidad_producida,
        producto_consumido_id=data.producto_consumido_id,
        cantidad_consumida_kg=data.cantidad_consumida_kg,
        observaciones=data.observaciones,
    )
    db.add(detalle)
    db.flush()

    # ── Descontar masa ──
    inv_consumido.cantidad = float(inv_consumido.cantidad) - data.cantidad_consumida_kg
    db.add(MovimientoInventario(
        producto_id=data.producto_consumido_id,
        tipo="salida",
        cantidad=data.cantidad_consumida_kg,
        origen="produccion",
        referencia_id=detalle.id,
        fecha=detalle.fecha,
    ))

    # ── Calcular peso total del lote y sumar producto final ──
    inv_final = _ensure_inv(db, data.producto_final_id)
    inv_final.cantidad = float(inv_final.cantidad) + data.cantidad_producida
    db.add(MovimientoInventario(
        producto_id=data.producto_final_id,
        tipo="entrada",
        cantidad=data.cantidad_producida,
        origen="produccion",
        referencia_id=detalle.id,
        fecha=detalle.fecha,
    ))

    db.commit()
    db.refresh(detalle)

    detalle = (
        db.query(ProduccionDetalle)
        .options(
            joinedload(ProduccionDetalle.producto_final),
            joinedload(ProduccionDetalle.producto_consumido),
        )
        .filter(ProduccionDetalle.id == detalle.id)
        .first()
    )
    return _build_detalle_response(detalle)


@router.delete("/detalle/{detalle_id}", status_code=204, dependencies=[Depends(require_internal_permission("produccion.editar"))])
def eliminar_detalle(detalle_id: int, db: Session = Depends(get_db)):
    detalle = db.query(ProduccionDetalle).filter(ProduccionDetalle.id == detalle_id).first()
    if not detalle:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    # Revertir inventario
    inv_consumido = _ensure_inv(db, detalle.producto_consumido_id)
    inv_consumido.cantidad = float(inv_consumido.cantidad) + float(detalle.cantidad_consumida_kg)

    inv_final = _ensure_inv(db, detalle.producto_final_id)
    new_final = float(inv_final.cantidad) - detalle.cantidad_producida
    inv_final.cantidad = max(new_final, 0)

    db.delete(detalle)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# LOTES DE PRODUCCIÓN CON COSTO
# ─────────────────────────────────────────────────────────────────────────────

def _build_lote_response(lote: LoteProduccion) -> LoteProduccionResponse:
    return LoteProduccionResponse(
        id=lote.id,
        fecha=lote.fecha,
        producto_final_id=lote.producto_final_id,
        producto_final_nombre=lote.producto_final.nombre if lote.producto_final else None,
        cantidad_producida=lote.cantidad_producida,
        costo_total=float(lote.costo_total or 0),
        costo_por_unidad=float(lote.costo_por_unidad or 0),
        observaciones=lote.observaciones,
        insumos_usados=[
            {
                "id": li.id,
                "insumo_id": li.insumo_id,
                # JOIN a insumos (3FN: no almacenamos nombre/unidad en la línea del lote)
                "insumo_nombre": li.insumo.nombre if li.insumo else None,
                "cantidad": float(li.cantidad),
                "unidad_medida": li.insumo.unidad_medida if li.insumo else None,
                "costo_unitario_snapshot": float(li.costo_unitario_snapshot or 0),
                "costo_linea": float(li.costo_linea or 0),
            }
            for li in lote.insumos_usados
        ],
    )


@router.get("/lotes", response_model=List[LoteProduccionResponse], dependencies=[Depends(require_internal_permission("produccion.ver"))])
def list_lotes(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    from sqlalchemy.orm import joinedload as jl
    rows = (
        db.query(LoteProduccion)
        .options(
            jl(LoteProduccion.producto_final),
            jl(LoteProduccion.insumos_usados),
        )
        .order_by(desc(LoteProduccion.fecha), desc(LoteProduccion.id))
        .limit(limit)
        .all()
    )
    return [_build_lote_response(r) for r in rows]


@router.post("/lotes", response_model=LoteProduccionResponse, status_code=201, dependencies=[Depends(require_internal_permission("produccion.crear"))])
def crear_lote(data: LoteProduccionCreate, db: Session = Depends(get_db)):
    """
    Registra un lote de producción con múltiples insumos.
    - Descuenta cada insumo del inventario.
    - Calcula costo_total = Σ(cantidad × costo_unitario) por insumo.
    - Calcula costo_por_unidad = costo_total / cantidad_producida.
    """
    if not data.insumos:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un insumo")
    if data.cantidad_producida <= 0:
        raise HTTPException(status_code=400, detail="cantidad_producida debe ser > 0")

    # Validar y cargar insumos
    lineas = []
    costo_total = 0.0

    for item in data.insumos:
        if item.cantidad <= 0:
            raise HTTPException(status_code=400, detail="La cantidad de cada insumo debe ser > 0")
        insumo = db.query(Insumo).filter(Insumo.id == item.insumo_id).first()
        if not insumo:
            raise HTTPException(status_code=404, detail=f"Insumo ID {item.insumo_id} no encontrado")

        # Convertir a unidad base del insumo si el usuario usó otra unidad
        unidad_consumo = (item.unidad_consumo or insumo.unidad_medida).lower().strip()
        unidad_base    = insumo.unidad_medida.lower().strip()
        try:
            cantidad_base = _convertir(item.cantidad, unidad_consumo, unidad_base)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        if float(insumo.cantidad_actual) < cantidad_base:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente de '{insumo.nombre}': "
                       f"disponible {float(insumo.cantidad_actual):.3f} {insumo.unidad_medida}, "
                       f"requerido {cantidad_base:.3f} {insumo.unidad_medida}"
                       + (f" ({item.cantidad} {unidad_consumo})" if unidad_consumo != unidad_base else ""),
            )

        costo_u = float(insumo.costo_unitario or 0)
        costo_linea = round(cantidad_base * costo_u, 2)
        costo_total += costo_linea
        lineas.append((insumo, cantidad_base, item.cantidad, unidad_consumo, costo_u, costo_linea))

    costo_total = round(costo_total, 2)
    costo_por_unidad = round(costo_total / data.cantidad_producida, 6) if data.cantidad_producida else 0

    # Crear lote
    lote = LoteProduccion(
        fecha=data.fecha or get_now_colombia(),
        producto_final_id=data.producto_final_id,
        cantidad_producida=data.cantidad_producida,
        costo_total=costo_total,
        costo_por_unidad=costo_por_unidad,
        observaciones=data.observaciones,
    )
    db.add(lote)
    db.flush()

    # Crear líneas + descontar inventario + registrar movimientos
    for insumo, cantidad_base, cant_orig, unidad_orig, costo_u, costo_linea in lineas:
        db.add(LoteProduccionInsumo(
            lote_id=lote.id,
            insumo_id=insumo.id,
            cantidad=cantidad_base,           # en unidad base del insumo
            costo_unitario_snapshot=costo_u,
            costo_linea=costo_linea,
        ))
        insumo.cantidad_actual = float(insumo.cantidad_actual) - cantidad_base
        unidad_base = insumo.unidad_medida
        nota_conv = (f" (ingresado: {cant_orig} {unidad_orig} → {cantidad_base:.4f} {unidad_base})"
                     if unidad_orig != unidad_base else "")
        db.add(MovimientoInsumo(
            insumo_id=insumo.id,
            tipo="salida",
            cantidad=cantidad_base,
            costo_total=costo_linea,
            origen="produccion",
            referencia_id=lote.id,
            notas=f"Lote #{lote.id} — {data.cantidad_producida} unidades{nota_conv}",
            fecha=lote.fecha,
        ))

    db.commit()

    from sqlalchemy.orm import joinedload as jl
    lote = (
        db.query(LoteProduccion)
        .options(jl(LoteProduccion.producto_final), jl(LoteProduccion.insumos_usados))
        .filter(LoteProduccion.id == lote.id)
        .first()
    )
    return _build_lote_response(lote)


@router.delete("/lotes/{lote_id}", status_code=204, dependencies=[Depends(require_internal_permission("produccion.editar"))])
def eliminar_lote(lote_id: int, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload as jl
    lote = (
        db.query(LoteProduccion)
        .options(jl(LoteProduccion.insumos_usados))
        .filter(LoteProduccion.id == lote_id)
        .first()
    )
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    # Revertir stock de cada insumo
    for li in lote.insumos_usados:
        if li.insumo_id:
            insumo = db.query(Insumo).filter(Insumo.id == li.insumo_id).first()
            if insumo:
                insumo.cantidad_actual = float(insumo.cantidad_actual) + float(li.cantidad)
                db.add(MovimientoInsumo(
                    insumo_id=insumo.id,
                    tipo="entrada",
                    cantidad=float(li.cantidad),
                    costo_total=float(li.costo_linea or 0),
                    origen="reversion_lote",
                    referencia_id=lote_id,
                    notas=f"Reversión lote #{lote_id}",
                ))

    db.delete(lote)
    db.commit()

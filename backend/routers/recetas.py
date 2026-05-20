"""
Router: Recetas de Cocción
Gestión de fórmulas de cocción reutilizables y ejecución de cocciones.

Flujo:
  1. Crear receta: define insumos + cantidades por bulto + masa que produce.
  2. Ejecutar cocción: seleccionar receta + nro. bultos → descuenta insumos, suma masa al inventario.
  3. Eliminar cocción: revierte insumos y masa (igual que produccion_proceso).
"""
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from database import get_db
from sql_models import (
    RecetaCoccion, RecetaCoccionInsumo,
    Coccion, CoccionInsumo,
    Insumo, MovimientoInsumo, Producto,
)
from auth import require_internal_permission
from models import (
    RecetaCoccionCreate, RecetaCoccionUpdate, RecetaCoccionResponse,
    EjecutarCoccionCreate, CoccionResponse, CoccionUpdate,
)
from utils import get_now_colombia

router = APIRouter(tags=["recetas"])
logger = logging.getLogger(__name__)

# Tabla central de unidades — ver units.py
from units import convertir as _convertir  # noqa: E402


def _build_receta_response(r: RecetaCoccion) -> RecetaCoccionResponse:
    return RecetaCoccionResponse(
        id=r.id,
        nombre=r.nombre,
        descripcion=r.descripcion,
        insumo_salida_id=r.insumo_salida_id,
        insumo_salida_nombre=r.insumo_salida.nombre if r.insumo_salida else None,
        masa_salida_kg=float(r.masa_salida_kg),
        activa=r.activa,
        insumos=[
            {
                "id":            ri.id,
                "insumo_id":     ri.insumo_id,
                "insumo_nombre": ri.insumo.nombre if ri.insumo else None,
                "cantidad":      float(ri.cantidad),
                "unidad":        ri.unidad,
            }
            for ri in r.insumos
        ],
    )


def _build_coccion_response(c: Coccion) -> CoccionResponse:
    insumos_resp = []
    costo_total = 0.0
    for ci in c.insumos_usados:
        costo_unit = float(ci.insumo.costo_unitario) if ci.insumo and ci.insumo.costo_unitario else 0.0
        costo_linea = round(float(ci.cantidad) * costo_unit, 2)
        costo_total += costo_linea
        insumos_resp.append({
            "id":            ci.id,
            "insumo_id":     ci.insumo_id,
            "insumo_nombre": ci.insumo_nombre,
            "cantidad":      float(ci.cantidad),
            "unidad":        ci.unidad,
            "costo_unitario": costo_unit,
            "costo_linea":   costo_linea,
        })
    masa_kg = float(c.masa_obtenida_kg)
    costo_por_kg = round(costo_total / masa_kg, 4) if masa_kg > 0 else 0.0
    return CoccionResponse(
        id=c.id,
        receta_id=c.receta_id,
        receta_nombre=c.receta.nombre if c.receta else None,
        bultos=float(c.bultos),
        masa_obtenida_kg=masa_kg,
        costo_total=round(costo_total, 2),
        costo_por_kg=costo_por_kg,
        observaciones=c.observaciones,
        fecha=c.fecha,
        insumos_usados=insumos_resp,
    )


# ─────────────────────────────────────────────────────────────────────────────
# RECETAS — CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/recetas", response_model=List[RecetaCoccionResponse], dependencies=[Depends(require_internal_permission("produccion.ver"))])
def list_recetas(
    solo_activas: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(RecetaCoccion).options(
        joinedload(RecetaCoccion.insumo_salida),
        joinedload(RecetaCoccion.insumos).joinedload(RecetaCoccionInsumo.insumo),
    )
    if solo_activas:
        q = q.filter(RecetaCoccion.activa == True)
    return [_build_receta_response(r) for r in q.order_by(RecetaCoccion.nombre).all()]


@router.post("/recetas", response_model=RecetaCoccionResponse, status_code=201, dependencies=[Depends(require_internal_permission("produccion.crear"))])
def crear_receta(data: RecetaCoccionCreate, db: Session = Depends(get_db)):
    if not data.nombre.strip():
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    if data.masa_salida_kg <= 0:
        raise HTTPException(status_code=400, detail="masa_salida_kg debe ser > 0")
    if not data.insumos:
        raise HTTPException(status_code=400, detail="La receta debe tener al menos un insumo")

    receta = RecetaCoccion(
        nombre=data.nombre.strip(),
        descripcion=data.descripcion,
        insumo_salida_id=data.insumo_salida_id,
        masa_salida_kg=data.masa_salida_kg,
    )
    db.add(receta)
    db.flush()

    for item in data.insumos:
        insumo = db.query(Insumo).filter(Insumo.id == item.insumo_id).first()
        if not insumo:
            raise HTTPException(status_code=404, detail=f"Insumo ID {item.insumo_id} no encontrado")
        db.add(RecetaCoccionInsumo(
            receta_id=receta.id,
            insumo_id=item.insumo_id,
            cantidad=item.cantidad,
            unidad=item.unidad or insumo.unidad_medida,
        ))

    db.commit()
    receta = db.query(RecetaCoccion).options(
        joinedload(RecetaCoccion.insumo_salida),
        joinedload(RecetaCoccion.insumos).joinedload(RecetaCoccionInsumo.insumo),
    ).filter(RecetaCoccion.id == receta.id).first()
    return _build_receta_response(receta)


@router.put("/recetas/{receta_id}", response_model=RecetaCoccionResponse, dependencies=[Depends(require_internal_permission("produccion.editar"))])
def actualizar_receta(receta_id: int, data: RecetaCoccionUpdate, db: Session = Depends(get_db)):
    receta = db.query(RecetaCoccion).filter(RecetaCoccion.id == receta_id).first()
    if not receta:
        raise HTTPException(status_code=404, detail="Receta no encontrada")

    if data.nombre is not None:      receta.nombre = data.nombre.strip()
    if data.descripcion is not None: receta.descripcion = data.descripcion
    if data.insumo_salida_id is not None: receta.insumo_salida_id = data.insumo_salida_id
    if data.masa_salida_kg is not None:     receta.masa_salida_kg = data.masa_salida_kg
    if data.activa is not None:             receta.activa = data.activa

    # Si se pasan insumos, reemplazar completamente las líneas
    if data.insumos is not None:
        db.query(RecetaCoccionInsumo).filter(RecetaCoccionInsumo.receta_id == receta_id).delete()
        for item in data.insumos:
            insumo = db.query(Insumo).filter(Insumo.id == item.insumo_id).first()
            if not insumo:
                raise HTTPException(status_code=404, detail=f"Insumo ID {item.insumo_id} no encontrado")
            db.add(RecetaCoccionInsumo(
                receta_id=receta_id,
                insumo_id=item.insumo_id,
                cantidad=item.cantidad,
                unidad=item.unidad or insumo.unidad_medida,
            ))

    db.commit()
    receta = db.query(RecetaCoccion).options(
        joinedload(RecetaCoccion.insumo_salida),
        joinedload(RecetaCoccion.insumos).joinedload(RecetaCoccionInsumo.insumo),
    ).filter(RecetaCoccion.id == receta_id).first()
    return _build_receta_response(receta)


@router.delete("/recetas/{receta_id}", status_code=204, dependencies=[Depends(require_internal_permission("produccion.editar"))])
def eliminar_receta(receta_id: int, db: Session = Depends(get_db)):
    receta = db.query(RecetaCoccion).filter(RecetaCoccion.id == receta_id).first()
    if not receta:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    if receta.cocciones:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar: la receta tiene cocciones registradas. Desactívala en su lugar."
        )
    db.delete(receta)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# COCCIONES — Ejecución y historial
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/cocciones", response_model=List[CoccionResponse], dependencies=[Depends(require_internal_permission("produccion.ver"))])
def list_cocciones(
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Coccion)
        .options(
            joinedload(Coccion.receta),
            joinedload(Coccion.insumos_usados).joinedload(CoccionInsumo.insumo),
        )
        .order_by(desc(Coccion.fecha), desc(Coccion.id))
        .limit(limit)
        .all()
    )
    return [_build_coccion_response(c) for c in rows]


@router.post("/cocciones", response_model=CoccionResponse, status_code=201, dependencies=[Depends(require_internal_permission("produccion.crear"))])
def ejecutar_coccion(data: EjecutarCoccionCreate, db: Session = Depends(get_db)):
    """
    Ejecuta una receta de cocción:
    - Descuenta cada insumo de la receta × bultos del stock de insumos.
    - Suma la masa producida al stock del INSUMO de salida (masa como insumo).
    - Registra movimientos en movimientos_insumos.
    """
    if data.bultos <= 0:
        raise HTTPException(status_code=400, detail="bultos debe ser > 0")

    receta = (
        db.query(RecetaCoccion)
        .options(
            joinedload(RecetaCoccion.insumos).joinedload(RecetaCoccionInsumo.insumo),
            joinedload(RecetaCoccion.insumo_salida),
        )
        .filter(RecetaCoccion.id == data.receta_id, RecetaCoccion.activa == True)
        .first()
    )
    if not receta:
        raise HTTPException(status_code=404, detail="Receta no encontrada o inactiva")
    if not receta.insumo_salida_id:
        raise HTTPException(status_code=400, detail="La receta no tiene insumo de salida configurado")

    fecha = data.fecha or get_now_colombia()
    masa_kg = data.masa_obtenida_kg if data.masa_obtenida_kg and data.masa_obtenida_kg > 0 \
              else round(float(receta.masa_salida_kg) * data.bultos, 3)

    # ── Validar y calcular stock de insumos ──────────────────────────────────
    lineas = []
    for ri in receta.insumos:
        insumo = ri.insumo
        if not insumo:
            raise HTTPException(status_code=400, detail=f"Insumo de receta ID {ri.insumo_id} no encontrado")

        # Cantidad en unidad de la receta × bultos
        cantidad_receta = float(ri.cantidad) * data.bultos
        unidad_receta   = ri.unidad.lower().strip()
        unidad_base     = insumo.unidad_medida.lower().strip()

        # Convertir a unidad base del insumo
        try:
            cantidad_base = _convertir(cantidad_receta, unidad_receta, unidad_base)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        if float(insumo.cantidad_actual) < cantidad_base:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Stock insuficiente de '{insumo.nombre}': "
                    f"disponible {float(insumo.cantidad_actual):.3f} {unidad_base}, "
                    f"requerido {cantidad_base:.3f} {unidad_base} "
                    f"({cantidad_receta:.4f} {unidad_receta} × {data.bultos} bulto(s))"
                ),
            )
        lineas.append((insumo, cantidad_base, unidad_receta, cantidad_receta))

    # ── Crear registro de cocción ─────────────────────────────────────────────
    coccion = Coccion(
        receta_id=receta.id,
        bultos=data.bultos,
        masa_obtenida_kg=masa_kg,
        observaciones=data.observaciones,
        fecha=fecha,
    )
    db.add(coccion)
    db.flush()

    # ── Descontar insumos + snapshot ─────────────────────────────────────────
    for insumo, cantidad_base, unidad_orig, cant_orig in lineas:
        insumo.cantidad_actual = float(insumo.cantidad_actual) - cantidad_base
        db.add(CoccionInsumo(
            coccion_id=coccion.id,
            insumo_id=insumo.id,
            insumo_nombre=insumo.nombre,
            cantidad=cantidad_base,
            unidad=insumo.unidad_medida,
        ))
        db.add(MovimientoInsumo(
            insumo_id=insumo.id,
            tipo="salida",
            cantidad=cantidad_base,
            costo_total=round(cantidad_base * float(insumo.costo_unitario or 0), 2),
            origen="coccion",
            referencia_id=coccion.id,
            notas=f"Cocción #{coccion.id} — receta '{receta.nombre}' × {data.bultos} bulto(s)"
                  + (f" (receta: {cant_orig:.4f} {unidad_orig})" if unidad_orig != insumo.unidad_medida.lower() else ""),
            fecha=fecha,
        ))

    # ── Sumar masa al stock del INSUMO de salida ──────────────────────────────
    masa_insumo = receta.insumo_salida or db.query(Insumo).filter(Insumo.id == receta.insumo_salida_id).first()
    if not masa_insumo:
        raise HTTPException(status_code=400, detail="El insumo de salida de la receta no existe")

    # Costo del lote producido (insumos descontados × su costo)
    costo_lote = sum(
        cantidad_base * float(insumo.costo_unitario or 0)
        for insumo, cantidad_base, _, _ in lineas
    )
    # Actualizar costo_unitario del insumo-masa con el costo de esta cocción
    if masa_kg > 0:
        masa_insumo.costo_unitario = round(costo_lote / masa_kg, 6)

    masa_insumo.cantidad_actual = float(masa_insumo.cantidad_actual) + masa_kg
    db.add(MovimientoInsumo(
        insumo_id=masa_insumo.id,
        tipo="entrada",
        cantidad=masa_kg,
        costo_total=round(costo_lote, 2),
        origen="coccion",
        referencia_id=coccion.id,
        notas=f"Cocción #{coccion.id} — receta '{receta.nombre}' × {data.bultos} bulto(s)",
        fecha=fecha,
    ))

    db.commit()

    coccion = (
        db.query(Coccion)
        .options(joinedload(Coccion.receta), joinedload(Coccion.insumos_usados))
        .filter(Coccion.id == coccion.id)
        .first()
    )
    return _build_coccion_response(coccion)


@router.patch("/cocciones/{coccion_id}", response_model=CoccionResponse, dependencies=[Depends(require_internal_permission("produccion.editar"))])
def actualizar_coccion(coccion_id: int, data: CoccionUpdate, db: Session = Depends(get_db)):
    """
    Actualiza campos editables de una cocción existente.
    Por ahora solo soporta fecha; al cambiarla también se sincronizan
    las fechas de los movimientos de insumos que la referencian.
    """
    coccion = (
        db.query(Coccion)
        .options(joinedload(Coccion.receta), joinedload(Coccion.insumos_usados))
        .filter(Coccion.id == coccion_id)
        .first()
    )
    if not coccion:
        raise HTTPException(status_code=404, detail="Cocción no encontrada")

    if data.fecha is not None:
        coccion.fecha = data.fecha
        # Sincronizar fecha en movimientos de insumos relacionados a esta cocción
        db.query(MovimientoInsumo).filter(
            MovimientoInsumo.origen == "coccion",
            MovimientoInsumo.referencia_id == coccion_id,
        ).update({MovimientoInsumo.fecha: data.fecha}, synchronize_session=False)

    db.commit()
    db.refresh(coccion)

    coccion = (
        db.query(Coccion)
        .options(joinedload(Coccion.receta), joinedload(Coccion.insumos_usados))
        .filter(Coccion.id == coccion_id)
        .first()
    )
    return _build_coccion_response(coccion)


@router.delete("/cocciones/{coccion_id}", status_code=204, dependencies=[Depends(require_internal_permission("produccion.editar"))])
def eliminar_coccion(coccion_id: int, db: Session = Depends(get_db)):
    """
    Revierte una cocción: devuelve los insumos descontados y descuenta la masa
    producida del stock del insumo de salida.
    """
    coccion = (
        db.query(Coccion)
        .options(
            joinedload(Coccion.insumos_usados).joinedload(CoccionInsumo.insumo),
            joinedload(Coccion.receta),
        )
        .filter(Coccion.id == coccion_id)
        .first()
    )
    if not coccion:
        raise HTTPException(status_code=404, detail="Cocción no encontrada")

    fecha = get_now_colombia()

    # ── Devolver insumos ──────────────────────────────────────────────────────
    for ci in coccion.insumos_usados:
        if ci.insumo_id:
            insumo = db.query(Insumo).filter(Insumo.id == ci.insumo_id).first()
            if insumo:
                insumo.cantidad_actual = float(insumo.cantidad_actual) + float(ci.cantidad)
                db.add(MovimientoInsumo(
                    insumo_id=insumo.id,
                    tipo="entrada",
                    cantidad=float(ci.cantidad),
                    costo_total=0,
                    origen="reversion_coccion",
                    referencia_id=coccion_id,
                    notas=f"Reversión cocción #{coccion_id}",
                    fecha=fecha,
                ))

    # ── Descontar masa del stock del insumo de salida ─────────────────────────
    receta = coccion.receta
    if receta and receta.insumo_salida_id:
        masa_insumo = db.query(Insumo).filter(Insumo.id == receta.insumo_salida_id).first()
        if masa_insumo:
            masa_kg = float(coccion.masa_obtenida_kg)
            masa_insumo.cantidad_actual = max(0, float(masa_insumo.cantidad_actual) - masa_kg)
            db.add(MovimientoInsumo(
                insumo_id=masa_insumo.id,
                tipo="salida",
                cantidad=masa_kg,
                costo_total=0,
                origen="reversion_coccion",
                referencia_id=coccion_id,
                notas=f"Reversión cocción #{coccion_id}",
                fecha=fecha,
            ))

    db.delete(coccion)
    db.commit()

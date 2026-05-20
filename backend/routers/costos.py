"""
Router de Costeo de Producción — ArepasERP

Fuente de verdad de cocciones: tabla `cocciones` (ejecutada desde recetas_coccion).
  - masa_obtenida_kg  → kilos producidos
  - consumo_gas_m3    → m³ de gas usados en esa cocción
  - consumo_agua_m3   → m³ de agua usados en esa cocción

Lógica de costo por cocción:
  1. Insumos directos
       = SUM(ci.cantidad * insumo.costo_unitario) de cocciones_insumos
  2. Servicios
       costo_gas  = consumo_gas_m3  * costo_unitario_gas(periodo)
       costo_agua = consumo_agua_m3 * costo_unitario_agua(periodo)
  3. Indirectos prorrateados
       costo_indirecto_kg = total_indirectos_produccion_mes / total_kg_mes
       costo_indirectos   = masa_obtenida_kg * costo_indirecto_kg
  4. Total = insumos + gas + agua + indirectos
  5. Costo/kg = total / masa_obtenida_kg
"""
import logging, calendar
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text

from database import get_db
from sql_models import Coccion, CoccionInsumo, Insumo, FacturaServicio
from auth import require_internal_permission

router = APIRouter()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────

class FacturaServicioCreate(BaseModel):
    tipo:         str
    periodo:      str
    valor:        float
    consumo:      Optional[float] = None
    unidad:       str = "m3"
    proveedor_id: Optional[int] = None
    notas:        Optional[str] = None

    @field_validator("periodo")
    @classmethod
    def validate_periodo(cls, v):
        import re
        if not re.match(r"^\d{4}-\d{2}$", v):
            raise ValueError("periodo debe tener formato YYYY-MM")
        return v


class FacturaServicioUpdate(BaseModel):
    valor:        Optional[float] = None
    consumo:      Optional[float] = None
    notas:        Optional[str] = None
    proveedor_id: Optional[int] = None


class ConsumosPatch(BaseModel):
    consumo_gas_m3:  Optional[float] = None
    consumo_agua_m3: Optional[float] = None


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def _periodo(d) -> str:
    if hasattr(d, "date"):
        d = d.date()
    return d.strftime("%Y-%m")


def _costo_unitario_servicio(tipo: str, periodo: str, db: Session) -> float:
    """
    Retorna costo_unitario de la factura más reciente del tipo indicado
    en ese periodo o en el anterior. Devuelve 0.0 si no existe.
    """
    year, month = int(periodo[:4]), int(periodo[5:])
    prev_month  = month - 1 if month > 1 else 12
    prev_year   = year if month > 1 else year - 1
    periodos    = [periodo, f"{prev_year:04d}-{prev_month:02d}"]

    for p in periodos:
        f = (db.query(FacturaServicio)
             .filter(FacturaServicio.tipo == tipo, FacturaServicio.periodo == p)
             .order_by(FacturaServicio.created_at.desc())
             .first())
        if f and f.costo_unitario:
            return float(f.costo_unitario)
    return 0.0


def _servicios_y_indirectos_mes(periodo: str, db: Session) -> dict:
    """
    Para gas, agua e indirectos: obtiene el total mensual de cada rubro
    y el total de kg producidos en el mes → costo_por_kg de cada uno.
    Gas y agua se prorratean por kg (igual que indirectos).
    """
    year, month = int(periodo[:4]), int(periodo[5:])
    ultimo_dia  = calendar.monthrange(year, month)[1]
    inicio, fin = f"{periodo}-01", f"{periodo}-{ultimo_dia:02d}"

    # Total kg del mes
    row_kg = db.execute(text("""
        SELECT COALESCE(SUM(masa_obtenida_kg), 0) AS total_kg
        FROM cocciones
        WHERE DATE(fecha AT TIME ZONE 'America/Bogota') BETWEEN :inicio AND :fin
    """), {"inicio": inicio, "fin": fin}).fetchone()
    total_kg = float(row_kg.total_kg)

    # Facturas de gas y agua del mes
    def _factura_total(tipo: str) -> float:
        row = db.execute(text("""
            SELECT COALESCE(SUM(valor), 0) AS total
            FROM facturas_servicio
            WHERE tipo = :tipo AND periodo = :periodo
        """), {"tipo": tipo, "periodo": periodo}).fetchone()
        return float(row.total)

    total_gas  = _factura_total("gas")
    total_agua = _factura_total("agua")
    total_luz  = _factura_total("luz")

    # Gastos por tipo_costo del mes (activos, con centro_costo produccion o sin clasificar)
    rows_costos = db.execute(text("""
        SELECT tipo_costo, COALESCE(SUM(valor), 0) AS total
        FROM gastos
        WHERE estado = 'activo'
          AND tipo_costo IN ('directo', 'indirecto')
          AND fecha BETWEEN :inicio AND :fin
        GROUP BY tipo_costo
    """), {"inicio": inicio, "fin": fin}).fetchall()
    costos_map = {r.tipo_costo: float(r.total) for r in rows_costos}
    total_dir = costos_map.get("directo", 0.0)
    total_ind = costos_map.get("indirecto", 0.0)

    def _por_kg(total): return round(total / total_kg, 4) if total_kg > 0 else 0.0

    return {
        "total_kg_mes":         round(total_kg, 3),
        "total_gas_mes":        round(total_gas, 2),
        "total_agua_mes":       round(total_agua, 2),
        "total_luz_mes":        round(total_luz, 2),
        "total_directos_mes":   round(total_dir, 2),
        "total_indirectos_mes": round(total_ind, 2),
        "costo_gas_kg":         _por_kg(total_gas),
        "costo_agua_kg":        _por_kg(total_agua),
        "costo_luz_kg":         _por_kg(total_luz),
        "costo_directo_kg":     _por_kg(total_dir),
        "costo_indirecto_kg":   _por_kg(total_ind),
    }


def _calcular_costo_coccion(coccion: Coccion, db: Session) -> dict:
    """Costo completo de una cocción: insumos + gas + agua + indirectos.
    Gas y agua se prorratean por kg producidos en el mes (igual que indirectos).
    """
    periodo  = _periodo(coccion.fecha)
    kg_prod  = float(coccion.masa_obtenida_kg)

    # 1. Insumos directos
    insumos_usados = (db.query(CoccionInsumo)
                      .filter(CoccionInsumo.coccion_id == coccion.id)
                      .all())
    costo_insumos   = 0.0
    detalle_insumos = []
    for ci in insumos_usados:
        insumo = db.query(Insumo).filter(Insumo.id == ci.insumo_id).first()
        cu       = float(insumo.costo_unitario) if insumo and insumo.costo_unitario else 0.0
        cant     = float(ci.cantidad)
        subtotal = cant * cu
        costo_insumos += subtotal
        detalle_insumos.append({
            "nombre":     ci.insumo_nombre,
            "cantidad":   cant,
            "unidad":     ci.unidad,
            "costo_unit": round(cu, 4),
            "subtotal":   round(subtotal, 2),
        })

    # 2. Servicios y costos prorrateados por kg del mes
    mes = _servicios_y_indirectos_mes(periodo, db)
    costo_gas  = kg_prod * mes["costo_gas_kg"]
    costo_agua = kg_prod * mes["costo_agua_kg"]
    costo_luz  = kg_prod * mes["costo_luz_kg"]
    costo_dir  = kg_prod * mes["costo_directo_kg"]
    costo_ind  = kg_prod * mes["costo_indirecto_kg"]

    # 3. Totales
    total = costo_insumos + costo_gas + costo_agua + costo_luz + costo_dir + costo_ind
    cph   = total / kg_prod if kg_prod > 0 else 0.0

    def pct(v): return round(v / total * 100, 1) if total > 0 else 0

    return {
        "coccion_id":    coccion.id,
        "receta_id":     coccion.receta_id,
        "fecha":         str(coccion.fecha.date() if hasattr(coccion.fecha, "date") else coccion.fecha),
        "periodo":       periodo,
        "bultos":        float(coccion.bultos),
        "kg_producidas": round(kg_prod, 3),
        "desglose": {
            "insumos": {
                "detalle": detalle_insumos,
                "total":   round(costo_insumos, 2),
            },
            "gas": {
                "total_mes":    mes["total_gas_mes"],
                "total_kg_mes": mes["total_kg_mes"],
                "costo_kg":     round(mes["costo_gas_kg"], 4),
                "total":        round(costo_gas, 2),
            },
            "agua": {
                "total_mes":    mes["total_agua_mes"],
                "total_kg_mes": mes["total_kg_mes"],
                "costo_kg":     round(mes["costo_agua_kg"], 4),
                "total":        round(costo_agua, 2),
            },
            "luz": {
                "total_mes":    mes["total_luz_mes"],
                "total_kg_mes": mes["total_kg_mes"],
                "costo_kg":     round(mes["costo_luz_kg"], 4),
                "total":        round(costo_luz, 2),
            },
            "directos": {
                "total_mes":    mes["total_directos_mes"],
                "total_kg_mes": mes["total_kg_mes"],
                "costo_kg":     round(mes["costo_directo_kg"], 4),
                "total":        round(costo_dir, 2),
            },
            "indirectos": {
                "total_mes":    mes["total_indirectos_mes"],
                "total_kg_mes": mes["total_kg_mes"],
                "costo_kg":     round(mes["costo_indirecto_kg"], 4),
                "total":        round(costo_ind, 2),
            },
        },
        "costo_total":  round(total, 2),
        "costo_por_kg": round(cph, 4),
        "pct": {
            "insumos":    pct(costo_insumos),
            "gas":        pct(costo_gas),
            "agua":       pct(costo_agua),
            "luz":        pct(costo_luz),
            "directos":   pct(costo_dir),
            "indirectos": pct(costo_ind),
        },
    }


# ─────────────────────────────────────────────────────────────
# ENDPOINTS — FACTURAS DE SERVICIO
# ─────────────────────────────────────────────────────────────

def _factura_dict(f: FacturaServicio) -> dict:
    return {
        "id":             f.id,
        "tipo":           f.tipo,
        "periodo":        f.periodo,
        "valor":          float(f.valor),
        "consumo":        float(f.consumo) if f.consumo else None,
        "unidad":         f.unidad,
        "costo_unitario": float(f.costo_unitario) if f.costo_unitario else None,
        "proveedor_id":   f.proveedor_id,
        "notas":          f.notas,
        "created_at":     str(f.created_at),
    }


@router.get("/facturas-servicio", dependencies=[Depends(require_internal_permission("costeo.ver"))])
def listar_facturas(periodo: Optional[str] = None, tipo: Optional[str] = None,
                    db: Session = Depends(get_db)):
    q = db.query(FacturaServicio).order_by(
        FacturaServicio.periodo.desc(), FacturaServicio.tipo)
    if periodo: q = q.filter(FacturaServicio.periodo == periodo)
    if tipo:    q = q.filter(FacturaServicio.tipo == tipo)
    return [_factura_dict(f) for f in q.all()]


@router.post("/facturas-servicio", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_internal_permission("costeo.crear"))])
def crear_factura(data: FacturaServicioCreate, db: Session = Depends(get_db)):
    cu = (data.valor / data.consumo) if data.consumo and data.consumo > 0 else None
    f  = FacturaServicio(tipo=data.tipo, periodo=data.periodo, valor=data.valor,
                         consumo=data.consumo, unidad=data.unidad, costo_unitario=cu,
                         proveedor_id=data.proveedor_id, notas=data.notas)
    db.add(f); db.commit(); db.refresh(f)
    return _factura_dict(f)


@router.put("/facturas-servicio/{fid}", dependencies=[Depends(require_internal_permission("costeo.crear"))])
def actualizar_factura(fid: int, data: FacturaServicioUpdate, db: Session = Depends(get_db)):
    f = db.query(FacturaServicio).filter(FacturaServicio.id == fid).first()
    if not f:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if data.valor    is not None: f.valor    = data.valor
    if data.consumo  is not None: f.consumo  = data.consumo
    if data.notas    is not None: f.notas    = data.notas
    if data.proveedor_id is not None: f.proveedor_id = data.proveedor_id
    if f.consumo and float(f.consumo) > 0:
        f.costo_unitario = float(f.valor) / float(f.consumo)
    db.commit(); db.refresh(f)
    return _factura_dict(f)


@router.delete("/facturas-servicio/{fid}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_internal_permission("costeo.crear"))])
def eliminar_factura(fid: int, db: Session = Depends(get_db)):
    f = db.query(FacturaServicio).filter(FacturaServicio.id == fid).first()
    if not f:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    db.delete(f); db.commit()


# ─────────────────────────────────────────────────────────────
# ENDPOINTS — COSTOS DE COCCIONES
# ─────────────────────────────────────────────────────────────

@router.patch("/coccion/{coccion_id}/consumos", dependencies=[Depends(require_internal_permission("costeo.crear"))])
def actualizar_consumos(coccion_id: int, data: ConsumosPatch,
                        db: Session = Depends(get_db)):
    c = db.query(Coccion).filter(Coccion.id == coccion_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cocción no encontrada")
    if data.consumo_gas_m3  is not None: c.consumo_gas_m3  = data.consumo_gas_m3
    if data.consumo_agua_m3 is not None: c.consumo_agua_m3 = data.consumo_agua_m3
    db.commit()
    return {"ok": True, "consumo_gas_m3":  float(c.consumo_gas_m3 or 0),
            "consumo_agua_m3": float(c.consumo_agua_m3 or 0)}


@router.get("/coccion/{coccion_id}", dependencies=[Depends(require_internal_permission("costeo.ver"))])
def costo_coccion(coccion_id: int, db: Session = Depends(get_db)):
    c = db.query(Coccion).filter(Coccion.id == coccion_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cocción no encontrada")
    return _calcular_costo_coccion(c, db)


@router.get("/historial", dependencies=[Depends(require_internal_permission("costeo.ver"))])
def historial_costos(dias: int = 60, db: Session = Depends(get_db)):
    desde = date.today() - timedelta(days=dias)
    cocciones = (db.query(Coccion)
                 .options(joinedload(Coccion.receta))
                 .filter(Coccion.fecha >= desde)
                 .order_by(Coccion.fecha.desc(), Coccion.id.desc())
                 .all())
    result = []
    for c in cocciones:
        try:
            result.append(_calcular_costo_coccion(c, db))
        except Exception as e:
            logger.warning("Error calculando costo coccion %s: %s", c.id, e)
    return result


@router.get("/indicadores", dependencies=[Depends(require_internal_permission("costeo.ver"))])
def indicadores(periodo: Optional[str] = None, db: Session = Depends(get_db)):
    if not periodo:
        periodo = date.today().strftime("%Y-%m")

    year, month   = int(periodo[:4]), int(periodo[5:])
    ultimo_dia    = calendar.monthrange(year, month)[1]
    inicio, fin   = f"{periodo}-01", f"{periodo}-{ultimo_dia:02d}"

    # Cocciones del mes
    cocciones = (db.query(Coccion)
                 .filter(Coccion.fecha.between(inicio, fin + "T23:59:59"))
                 .all())

    total_kg       = sum(float(c.masa_obtenida_kg) for c in cocciones)
    total_cocciones = len(cocciones)

    # Costos del mes por tipo
    gastos_rows = db.execute(text("""
        SELECT tipo_costo, COALESCE(SUM(valor), 0) AS total
        FROM gastos
        WHERE estado = 'activo' AND fecha BETWEEN :ini AND :fin
        GROUP BY tipo_costo
    """), {"ini": inicio, "fin": fin}).fetchall()
    costos_por_tipo = {r.tipo_costo or "sin_clasificar": float(r.total) for r in gastos_rows}

    # Facturas de servicios del mes
    facturas = db.execute(text("""
        SELECT tipo, valor, consumo, costo_unitario
        FROM facturas_servicio WHERE periodo = :periodo
    """), {"periodo": periodo}).fetchall()
    servicios = {r.tipo: {"valor": float(r.valor), "consumo": float(r.consumo or 0),
                          "costo_unitario": float(r.costo_unitario or 0)} for r in facturas}

    mes = _servicios_y_indirectos_mes(periodo, db)

    # Costo promedio/kg
    costos_kg = []
    for c in cocciones:
        try:
            costos_kg.append(_calcular_costo_coccion(c, db)["costo_por_kg"])
        except Exception:
            pass
    avg_kg = sum(costos_kg) / len(costos_kg) if costos_kg else 0.0

    return {
        "periodo":          periodo,
        "produccion":       {"total_cocciones": total_cocciones, "total_kg": round(total_kg, 2)},
        "costos_por_tipo":  costos_por_tipo,
        "servicios":        servicios,
        "prorrateo_mes":    mes,
        "costo_promedio_kg": round(avg_kg, 4),
    }

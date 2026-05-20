"""
Router de Flujo de Caja (Cash Flow) — ArepasERP

Integra ventas (devengado), pagos (caja), gastos, abonos, ingresos manuales y
medios de pago para producir:
  • Dashboard ejecutivo (KPIs)
  • Timeline diaria/semanal/mensual con saldo acumulado
  • Top categorías de ingreso/egreso
  • Proyecciones simples basadas en tendencia
  • Alertas financieras
  • Exportación CSV / XLSX / PDF
  • CRUD de ingresos manuales (ingresos extraordinarios)

Cash basis: ingresos = pagos recibidos + ingresos manuales activos.
            egresos  = abonos a gastos + gastos pagados de contado.
Devengado (informativo): ventas facturadas (pedidos.total, excl. cancelados).
"""

import io
import csv
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional
from collections import OrderedDict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text, func as sqlfunc
from sqlalchemy.orm import Session, joinedload

from database import get_db
from auth import get_current_user, require_permission, require_internal_permission
from sql_models import (
    IngresoManual, Categoria, Subcategoria, MedioPago, Usuario,
)
from models import IngresoManualCreate, IngresoManualResponse
from utils import get_now_colombia

router = APIRouter()
logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════════════

GRAN_DAY = "day"
GRAN_WEEK = "week"
GRAN_MONTH = "month"
GRAN_YEAR = "year"
VALID_GRANS = {GRAN_DAY, GRAN_WEEK, GRAN_MONTH, GRAN_YEAR}


def _today() -> date:
    return get_now_colombia().date()


def _parse_date(s: Optional[str], default: date) -> date:
    if not s:
        return default
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, f"Fecha inválida: '{s}'. Usar YYYY-MM-DD.")


def _bucket_key(d: date, granularity: str) -> str:
    """Devuelve la clave de bucket para una fecha según granularidad."""
    if granularity == GRAN_DAY:
        return d.isoformat()
    if granularity == GRAN_WEEK:
        # ISO week — empezando lunes
        iso_year, iso_week, _ = d.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    if granularity == GRAN_MONTH:
        return d.strftime("%Y-%m")
    if granularity == GRAN_YEAR:
        return d.strftime("%Y")
    return d.isoformat()


def _bucket_label(key: str, granularity: str) -> str:
    """Etiqueta legible para el bucket en gráficos."""
    if granularity == GRAN_DAY:
        try:
            return datetime.strptime(key, "%Y-%m-%d").strftime("%d %b")
        except ValueError:
            return key
    if granularity == GRAN_WEEK:
        return key.replace("-W", " S")
    if granularity == GRAN_MONTH:
        try:
            return datetime.strptime(key, "%Y-%m").strftime("%b %Y")
        except ValueError:
            return key
    return key


def _ingreso_manual_dict(m: IngresoManual) -> dict:
    return {
        "id": m.id,
        "fecha": m.fecha,
        "valor": float(m.valor or 0),
        "categoria_id": m.categoria_id,
        "categoria_nombre": m.categoria.nombre if m.categoria else None,
        "subcategoria_id": m.subcategoria_id,
        "subcategoria_nombre": m.subcategoria.nombre if m.subcategoria else None,
        "medio_pago_id": m.medio_pago_id,
        "medio_pago_nombre": m.medio_pago.nombre if m.medio_pago else None,
        "descripcion": m.descripcion,
        "tipo": m.tipo or "operativo",
        "estado": m.estado or "activo",
        "created_by": m.created_by,
        "created_by_nombre": m.creador.nombre if m.creador else None,
        "created_at": m.created_at,
        "updated_at": m.updated_at,
        "anulado_at": m.anulado_at,
    }


def _caja_total(db: Session) -> float:
    """Suma de saldos actuales de todos los medios de pago."""
    try:
        row = db.execute(text(
            "SELECT COALESCE(SUM(saldo), 0) FROM view_saldos_medios_pago"
        )).scalar()
        return float(row or 0)
    except Exception:
        return 0.0


@router.get("/saldos-medios-pago",
            dependencies=[Depends(require_internal_permission("cash_flow.ver"))])
def saldos_medios_pago(db: Session = Depends(get_db)):
    """
    Saldo actual por medio de pago — base caja real.
    Ingresos = pagos + transferencias entrantes + ingresos_manuales (activos).
    Egresos  = abonos_gastos + gastos de contado (monto_pagado sin abonos)
               + transferencias salientes.
    Cualquier pago/abono afecta el saldo sin importar la fecha de la factura.
    """
    rows = db.execute(text(
        "SELECT id, nombre, tipo, ingresos, egresos, saldo "
        "FROM view_saldos_medios_pago"
    )).fetchall()
    items = [
        {
            "id":       r[0],
            "medio":    r[1],
            "tipo":     r[2],
            "ingresos": float(r[3] or 0),
            "egresos":  float(r[4] or 0),
            "saldo":    float(r[5] or 0),
        }
        for r in rows
    ]
    total = {
        "ingresos": round(sum(i["ingresos"] for i in items), 2),
        "egresos":  round(sum(i["egresos"]  for i in items), 2),
        "saldo":    round(sum(i["saldo"]    for i in items), 2),
    }
    return {"items": items, "total": total}


# ════════════════════════════════════════════════════════════════════════════
# DASHBOARD — KPIs ejecutivos
# ════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard", dependencies=[Depends(require_internal_permission("cash_flow.ver"))])
def cash_flow_dashboard(db: Session = Depends(get_db)):
    """
    KPIs para encabezado del dashboard financiero:
      • caja_total: suma de saldos actuales de medios de pago
      • vendido_hoy / vendido_mes (devengado, pedidos.total excl. cancelados)
      • cobrado_hoy / cobrado_mes (caja: pagos + ingresos_manuales)
      • egresos_hoy / egresos_mes (caja: abonos_gastos + gastos pagados contado)
      • utilidad_mes (cobrado − egresos)
      • margen_mes (% utilidad / cobrado)
      • crecimiento (% vs mes anterior, sobre cobrado)
      • por_pagar / por_cobrar (cartera abierta)
    """
    today = _today()
    month_start = today.replace(day=1)
    if today.month == 12:
        next_month = today.replace(year=today.year + 1, month=1, day=1)
    else:
        next_month = today.replace(month=today.month + 1, day=1)
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

    # ── Caja total
    caja_total = _caja_total(db)

    # ── Vendido (devengado)
    vendido_hoy = db.execute(text("""
        SELECT COALESCE(SUM(total), 0) FROM pedidos
        WHERE  estado != 'cancelado'
          AND  DATE(fecha AT TIME ZONE 'America/Bogota') = :hoy
    """), {"hoy": today}).scalar() or 0
    vendido_mes = db.execute(text("""
        SELECT COALESCE(SUM(total), 0) FROM pedidos
        WHERE  estado != 'cancelado'
          AND  DATE(fecha AT TIME ZONE 'America/Bogota') >= :ini
          AND  DATE(fecha AT TIME ZONE 'America/Bogota') <  :fin
    """), {"ini": month_start, "fin": next_month}).scalar() or 0

    # ── Cobrado (caja) — pagos + ingresos manuales activos
    cobrado_hoy = db.execute(text("""
        SELECT
          COALESCE((SELECT SUM(monto) FROM pagos
                     WHERE DATE(fecha AT TIME ZONE 'America/Bogota') = :hoy), 0)
        + COALESCE((SELECT SUM(valor) FROM ingresos_manuales
                     WHERE estado='activo' AND fecha = :hoy), 0)
    """), {"hoy": today}).scalar() or 0
    cobrado_mes = db.execute(text("""
        SELECT
          COALESCE((SELECT SUM(monto) FROM pagos
                     WHERE DATE(fecha AT TIME ZONE 'America/Bogota') >= :ini
                       AND DATE(fecha AT TIME ZONE 'America/Bogota') <  :fin), 0)
        + COALESCE((SELECT SUM(valor) FROM ingresos_manuales
                     WHERE estado='activo' AND fecha >= :ini AND fecha < :fin), 0)
    """), {"ini": month_start, "fin": next_month}).scalar() or 0

    # ── Egresos (caja) — abonos + gastos contado (sin abonos)
    egresos_hoy = db.execute(text("""
        SELECT
          COALESCE((SELECT SUM(monto) FROM abonos_gastos
                     WHERE fecha = :hoy), 0)
        + COALESCE((SELECT SUM(monto_pagado) FROM gastos g
                     WHERE g.fecha = :hoy
                       AND g.estado != 'anulado'
                       AND g.monto_pagado > 0
                       AND NOT EXISTS (SELECT 1 FROM abonos_gastos a WHERE a.gasto_id=g.id)), 0)
    """), {"hoy": today}).scalar() or 0
    egresos_mes = db.execute(text("""
        SELECT
          COALESCE((SELECT SUM(monto) FROM abonos_gastos
                     WHERE fecha >= :ini AND fecha < :fin), 0)
        + COALESCE((SELECT SUM(monto_pagado) FROM gastos g
                     WHERE g.fecha >= :ini AND g.fecha < :fin
                       AND g.estado != 'anulado'
                       AND g.monto_pagado > 0
                       AND NOT EXISTS (SELECT 1 FROM abonos_gastos a WHERE a.gasto_id=g.id)), 0)
    """), {"ini": month_start, "fin": next_month}).scalar() or 0

    # Mes anterior — para crecimiento
    cobrado_mes_prev = db.execute(text("""
        SELECT
          COALESCE((SELECT SUM(monto) FROM pagos
                     WHERE DATE(fecha AT TIME ZONE 'America/Bogota') >= :ini
                       AND DATE(fecha AT TIME ZONE 'America/Bogota') <  :fin), 0)
        + COALESCE((SELECT SUM(valor) FROM ingresos_manuales
                     WHERE estado='activo' AND fecha >= :ini AND fecha < :fin), 0)
    """), {"ini": prev_month_start, "fin": month_start}).scalar() or 0
    egresos_mes_prev = db.execute(text("""
        SELECT
          COALESCE((SELECT SUM(monto) FROM abonos_gastos
                     WHERE fecha >= :ini AND fecha < :fin), 0)
        + COALESCE((SELECT SUM(monto_pagado) FROM gastos g
                     WHERE g.fecha >= :ini AND g.fecha < :fin
                       AND g.estado != 'anulado'
                       AND g.monto_pagado > 0
                       AND NOT EXISTS (SELECT 1 FROM abonos_gastos a WHERE a.gasto_id=g.id)), 0)
    """), {"ini": prev_month_start, "fin": month_start}).scalar() or 0

    cobrado_mes_f = float(cobrado_mes)
    cobrado_prev_f = float(cobrado_mes_prev)
    egresos_mes_f = float(egresos_mes)
    egresos_prev_f = float(egresos_mes_prev)

    utilidad_mes = cobrado_mes_f - egresos_mes_f
    utilidad_prev = cobrado_prev_f - egresos_prev_f
    margen_mes = (utilidad_mes / cobrado_mes_f * 100) if cobrado_mes_f > 0 else 0
    crecimiento_ingresos = (
        ((cobrado_mes_f - cobrado_prev_f) / cobrado_prev_f * 100)
        if cobrado_prev_f > 0 else 0
    )
    crecimiento_utilidad = (
        ((utilidad_mes - utilidad_prev) / abs(utilidad_prev) * 100)
        if utilidad_prev != 0 else 0
    )

    # ── Cartera (cuentas por cobrar y por pagar)
    por_cobrar = db.execute(text("""
        SELECT COALESCE(SUM(p.total - COALESCE(pp_sum.pagado, 0)), 0)
        FROM   pedidos p
        LEFT JOIN (
            SELECT pedido_id, SUM(monto) AS pagado
            FROM   pagos_pedidos GROUP BY pedido_id
        ) pp_sum ON pp_sum.pedido_id = p.id
        WHERE  p.estado IN ('por_cobrar','pendiente')
          AND  (p.total - COALESCE(pp_sum.pagado, 0)) > 0
    """)).scalar() or 0
    por_pagar = db.execute(text("""
        SELECT COALESCE(SUM(valor - COALESCE(monto_pagado, 0)), 0)
        FROM   gastos
        WHERE  estado != 'anulado'
          AND  estado_pago != 'pagado'
    """)).scalar() or 0

    # ── Promedio diario del mes (cobrado)
    dias_mes_transcurridos = (today - month_start).days + 1
    promedio_diario = (cobrado_mes_f / dias_mes_transcurridos) if dias_mes_transcurridos > 0 else 0

    return {
        "caja_total":           float(caja_total),
        "vendido_hoy":          float(vendido_hoy),
        "vendido_mes":          float(vendido_mes),
        "cobrado_hoy":          float(cobrado_hoy),
        "cobrado_mes":          cobrado_mes_f,
        "egresos_hoy":          float(egresos_hoy),
        "egresos_mes":          egresos_mes_f,
        "utilidad_mes":         round(utilidad_mes, 2),
        "margen_mes_pct":       round(margen_mes, 2),
        "crecimiento_ingresos_pct": round(crecimiento_ingresos, 2),
        "crecimiento_utilidad_pct": round(crecimiento_utilidad, 2),
        "por_cobrar":           float(por_cobrar),
        "por_pagar":            float(por_pagar),
        "promedio_diario":      round(promedio_diario, 2),
        "cobrado_mes_prev":     cobrado_prev_f,
        "egresos_mes_prev":     egresos_prev_f,
        "utilidad_mes_prev":    round(utilidad_prev, 2),
        "periodo": {
            "hoy":              today.isoformat(),
            "mes_inicio":       month_start.isoformat(),
            "mes_fin":          (next_month - timedelta(days=1)).isoformat(),
            "dias_transcurridos": dias_mes_transcurridos,
        },
    }


# ════════════════════════════════════════════════════════════════════════════
# TIMELINE — Serie por bucket (día/semana/mes/año) con saldo acumulado
# ════════════════════════════════════════════════════════════════════════════

@router.get("/timeline", dependencies=[Depends(require_internal_permission("cash_flow.ver"))])
def cash_flow_timeline(
    start_date: Optional[str] = None,
    end_date:   Optional[str] = None,
    granularity: str = Query(GRAN_DAY, regex="^(day|week|month|year)$"),
    db: Session = Depends(get_db),
):
    """
    Devuelve serie de buckets con: vendido, cobrado, ingresos_manuales,
    ingresos_totales, egresos, neto, saldo_acumulado.
    El saldo_acumulado parte de la caja_total actual menos el neto futuro
    para reconstruir saldo histórico (aproximación si no hay saldo_inicial).
    """
    end = _parse_date(end_date, _today())
    start = _parse_date(start_date, end - timedelta(days=29))
    if start > end:
        raise HTTPException(400, "start_date no puede ser posterior a end_date")

    # Consulta a la vista view_cash_flow_diario, filtrando rango
    rows = db.execute(text("""
        SELECT dia, vendido, cobrado, ingresos_manuales,
               ingresos_totales, egresos, neto
        FROM   view_cash_flow_diario
        WHERE  dia >= :ini AND dia <= :fin
        ORDER  BY dia
    """), {"ini": start, "fin": end}).fetchall()

    # Agrupar por bucket según granularidad
    buckets: "OrderedDict[str, dict]" = OrderedDict()

    # Pre-poblar buckets vacíos para tener serie continua
    cursor = start
    while cursor <= end:
        key = _bucket_key(cursor, granularity)
        if key not in buckets:
            buckets[key] = {
                "key": key,
                "label": _bucket_label(key, granularity),
                "vendido": 0.0,
                "cobrado": 0.0,
                "ingresos_manuales": 0.0,
                "ingresos_totales": 0.0,
                "egresos": 0.0,
                "neto": 0.0,
                "fecha_inicio": cursor.isoformat(),
            }
        if granularity == GRAN_DAY:
            cursor += timedelta(days=1)
        elif granularity == GRAN_WEEK:
            cursor += timedelta(days=7 - cursor.weekday())
        elif granularity == GRAN_MONTH:
            # avanzar al primero del mes siguiente
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1, day=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1, day=1)
        else:  # year
            cursor = cursor.replace(year=cursor.year + 1, month=1, day=1)

    # Llenar buckets con datos reales
    for r in rows:
        key = _bucket_key(r.dia, granularity)
        if key not in buckets:
            buckets[key] = {
                "key": key, "label": _bucket_label(key, granularity),
                "vendido": 0.0, "cobrado": 0.0, "ingresos_manuales": 0.0,
                "ingresos_totales": 0.0, "egresos": 0.0, "neto": 0.0,
                "fecha_inicio": r.dia.isoformat(),
            }
        b = buckets[key]
        b["vendido"]           += float(r.vendido)
        b["cobrado"]           += float(r.cobrado)
        b["ingresos_manuales"] += float(r.ingresos_manuales)
        b["ingresos_totales"]  += float(r.ingresos_totales)
        b["egresos"]           += float(r.egresos)
        b["neto"]              += float(r.neto)

    # Saldo acumulado retroactivo: partir de caja actual y restar neto futuro
    serie = list(buckets.values())
    caja_actual = _caja_total(db)
    # neto total desde hoy hacia atrás: si hoy está en el rango, el último bucket termina en caja_actual
    # caja_inicial_bucket = caja_actual − sum(neto desde ese bucket en adelante)
    saldo_running = caja_actual
    # Computar saldo final por bucket en reverso
    for b in reversed(serie):
        b["saldo_final"] = round(saldo_running, 2)
        saldo_running -= b["neto"]
        b["saldo_inicial"] = round(saldo_running, 2)

    # Reordenar campos para legibilidad y redondeos
    for b in serie:
        for k in ("vendido","cobrado","ingresos_manuales","ingresos_totales","egresos","neto"):
            b[k] = round(b[k], 2)

    # Totales del rango
    total = {
        "vendido":           round(sum(b["vendido"]           for b in serie), 2),
        "cobrado":           round(sum(b["cobrado"]           for b in serie), 2),
        "ingresos_manuales": round(sum(b["ingresos_manuales"] for b in serie), 2),
        "ingresos_totales":  round(sum(b["ingresos_totales"]  for b in serie), 2),
        "egresos":           round(sum(b["egresos"]           for b in serie), 2),
        "neto":              round(sum(b["neto"]              for b in serie), 2),
    }
    caja_inicio_periodo = serie[0]["saldo_inicial"] if serie else caja_actual
    caja_fin_periodo    = serie[-1]["saldo_final"]  if serie else caja_actual

    return {
        "granularity": granularity,
        "start_date":  start.isoformat(),
        "end_date":    end.isoformat(),
        "serie":       serie,
        "totales":     total,
        "caja": {
            "inicio_periodo": caja_inicio_periodo,
            "fin_periodo":    caja_fin_periodo,
            "actual":         round(caja_actual, 2),
        },
    }


# ════════════════════════════════════════════════════════════════════════════
# CATEGORÍAS — Top ingresos/egresos por categoría
# ════════════════════════════════════════════════════════════════════════════

@router.get("/categorias", dependencies=[Depends(require_internal_permission("cash_flow.ver"))])
def cash_flow_categorias(
    start_date: Optional[str] = None,
    end_date:   Optional[str] = None,
    limit: int = Query(8, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """
    Distribución por categoría dentro del rango:
      • egresos: agregado por categorias.nombre desde gastos.monto_pagado (no anulados)
      • ingresos: ventas + ingresos manuales por categoría
    Retorna top-N + % de participación.
    """
    end = _parse_date(end_date, _today())
    start = _parse_date(start_date, end.replace(day=1))

    # Egresos por categoría
    egresos_rows = db.execute(text("""
        SELECT c.id, c.nombre, c.icono, c.color,
               COALESCE(SUM(g.monto_pagado), 0)::numeric AS total
        FROM   gastos g
        LEFT JOIN categorias c ON c.id = g.categoria_id
        WHERE  g.fecha >= :ini AND g.fecha <= :fin
          AND  g.estado != 'anulado'
          AND  g.monto_pagado > 0
        GROUP  BY c.id, c.nombre, c.icono, c.color
        ORDER  BY total DESC
    """), {"ini": start, "fin": end}).fetchall()

    egresos_total = float(sum(r.total for r in egresos_rows)) or 0
    egresos = [
        {
            "id":     r.id,
            "nombre": r.nombre or "Sin categoría",
            "icono":  r.icono,
            "color":  r.color or "#94a3b8",
            "total":  float(r.total),
            "pct":    round(float(r.total) / egresos_total * 100, 1) if egresos_total > 0 else 0,
        }
        for r in egresos_rows[:limit] if float(r.total) > 0
    ]

    # Ingresos por categoría — manuales (con categoría)
    manuales_rows = db.execute(text("""
        SELECT c.id, c.nombre, c.icono, c.color,
               COALESCE(SUM(im.valor), 0)::numeric AS total
        FROM   ingresos_manuales im
        LEFT JOIN categorias c ON c.id = im.categoria_id
        WHERE  im.fecha >= :ini AND im.fecha <= :fin
          AND  im.estado = 'activo'
        GROUP  BY c.id, c.nombre, c.icono, c.color
        ORDER  BY total DESC
    """), {"ini": start, "fin": end}).fetchall()

    # Ventas como "categoría sintética" Ventas
    ventas_total = db.execute(text("""
        SELECT COALESCE(SUM(p.monto), 0)::numeric
        FROM   pagos p
        WHERE  DATE(p.fecha AT TIME ZONE 'America/Bogota') >= :ini
          AND  DATE(p.fecha AT TIME ZONE 'America/Bogota') <= :fin
    """), {"ini": start, "fin": end}).scalar() or 0

    ingresos = []
    if float(ventas_total) > 0:
        ingresos.append({
            "id": None, "nombre": "Ventas", "icono": "💰", "color": "#10b981",
            "total": float(ventas_total), "pct": 0,
        })
    for r in manuales_rows:
        if float(r.total) > 0:
            ingresos.append({
                "id":     r.id,
                "nombre": r.nombre or "Sin categoría",
                "icono":  r.icono,
                "color":  r.color or "#06b6d4",
                "total":  float(r.total),
                "pct":    0,
            })
    ingresos_total = sum(i["total"] for i in ingresos)
    for i in ingresos:
        i["pct"] = round(i["total"] / ingresos_total * 100, 1) if ingresos_total > 0 else 0
    ingresos = sorted(ingresos, key=lambda x: x["total"], reverse=True)[:limit]

    return {
        "start_date":     start.isoformat(),
        "end_date":       end.isoformat(),
        "egresos":        egresos,
        "egresos_total":  round(egresos_total, 2),
        "ingresos":       ingresos,
        "ingresos_total": round(ingresos_total, 2),
    }


# ════════════════════════════════════════════════════════════════════════════
# PROYECCIONES — promedios móviles
# ════════════════════════════════════════════════════════════════════════════

@router.get("/proyecciones", dependencies=[Depends(require_internal_permission("cash_flow.ver"))])
def cash_flow_proyecciones(
    semanas: int = Query(4, ge=1, le=12),
    db: Session = Depends(get_db),
):
    """
    Proyección simple: promedio diario de las últimas 4 semanas → extrapola
    los próximos `semanas` periodos semanales. Incluye:
      • proyección de ingresos
      • proyección de egresos
      • proyección de saldo
      • flag de meses críticos (saldo proyectado < 0)
    """
    today = _today()
    # Histórico: 8 semanas para suavizar
    desde = today - timedelta(days=8 * 7)

    rows = db.execute(text("""
        SELECT dia, ingresos_totales, egresos, neto
        FROM   view_cash_flow_diario
        WHERE  dia >= :ini AND dia <= :fin
        ORDER  BY dia
    """), {"ini": desde, "fin": today}).fetchall()

    if not rows:
        return {
            "promedio_diario_ingresos": 0.0,
            "promedio_diario_egresos":  0.0,
            "promedio_diario_neto":     0.0,
            "proyeccion_semanas":       [],
            "caja_actual":              _caja_total(db),
            "alerta_caja_negativa":     False,
        }

    # Promedio diario (sobre días con actividad para no aplanar la tendencia)
    ingresos_avg = float(sum(float(r.ingresos_totales) for r in rows)) / 56  # 8 semanas
    egresos_avg  = float(sum(float(r.egresos) for r in rows)) / 56
    neto_avg     = ingresos_avg - egresos_avg

    caja_actual = _caja_total(db)
    proyeccion = []
    saldo = caja_actual
    fecha = today
    alerta_negativa = False
    for s in range(1, semanas + 1):
        fecha = fecha + timedelta(days=7)
        ingresos_semana = ingresos_avg * 7
        egresos_semana  = egresos_avg  * 7
        neto_semana     = ingresos_semana - egresos_semana
        saldo += neto_semana
        if saldo < 0:
            alerta_negativa = True
        proyeccion.append({
            "semana":   s,
            "fecha":    fecha.isoformat(),
            "label":    f"Sem {s}",
            "ingresos": round(ingresos_semana, 2),
            "egresos":  round(egresos_semana, 2),
            "neto":     round(neto_semana, 2),
            "saldo":    round(saldo, 2),
            "critico":  saldo < 0,
        })

    return {
        "promedio_diario_ingresos": round(ingresos_avg, 2),
        "promedio_diario_egresos":  round(egresos_avg, 2),
        "promedio_diario_neto":     round(neto_avg, 2),
        "proyeccion_semanas":       proyeccion,
        "caja_actual":               round(caja_actual, 2),
        "alerta_caja_negativa":     alerta_negativa,
        "base_historica_dias":      56,
    }


# ════════════════════════════════════════════════════════════════════════════
# ALERTAS FINANCIERAS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/alertas", dependencies=[Depends(require_internal_permission("cash_flow.ver"))])
def cash_flow_alertas(db: Session = Depends(get_db)):
    """
    Calcula alertas en tiempo real cruzando indicadores:
      • flujo_negativo:       neto del mes < 0
      • exceso_gastos:        egresos del mes > ingresos del mes
      • baja_rentabilidad:    margen del mes < 10%
      • caida_ventas:         cobrado del mes < 70% mes anterior
      • cartera_alta:         por_cobrar > 2× cobrado_mes
      • deuda_alta:           por_pagar  > 2× caja_total
      • caja_baja:            caja_total < egresos promedio diario × 7
    """
    dash = cash_flow_dashboard(db)
    alertas = []

    if dash["utilidad_mes"] < 0:
        alertas.append({
            "codigo":   "flujo_negativo",
            "nivel":    "critico",
            "titulo":   "Flujo neto negativo",
            "mensaje":  f"El neto del mes es {dash['utilidad_mes']:,.0f}. Egresos superan ingresos.",
            "valor":    dash["utilidad_mes"],
        })

    if dash["egresos_mes"] > dash["cobrado_mes"] and dash["cobrado_mes"] > 0:
        alertas.append({
            "codigo":   "exceso_gastos",
            "nivel":    "alta",
            "titulo":   "Egresos exceden ingresos",
            "mensaje":  f"Egresos del mes ({dash['egresos_mes']:,.0f}) > Ingresos ({dash['cobrado_mes']:,.0f}).",
            "valor":    dash["egresos_mes"] - dash["cobrado_mes"],
        })

    if 0 < dash["margen_mes_pct"] < 10:
        alertas.append({
            "codigo":   "baja_rentabilidad",
            "nivel":    "media",
            "titulo":   "Margen bajo",
            "mensaje":  f"Margen operativo del mes: {dash['margen_mes_pct']:.1f}% (umbral 10%).",
            "valor":    dash["margen_mes_pct"],
        })

    if dash["cobrado_mes_prev"] > 0:
        ratio = dash["cobrado_mes"] / dash["cobrado_mes_prev"]
        if ratio < 0.7:
            alertas.append({
                "codigo":  "caida_ventas",
                "nivel":   "alta",
                "titulo":  "Caída de ingresos",
                "mensaje": f"Ingresos del mes son {ratio*100:.0f}% del mes anterior.",
                "valor":   round((1 - ratio) * 100, 1),
            })

    if dash["cobrado_mes"] > 0 and dash["por_cobrar"] > 2 * dash["cobrado_mes"]:
        alertas.append({
            "codigo":  "cartera_alta",
            "nivel":   "media",
            "titulo":  "Cartera por cobrar alta",
            "mensaje": f"Por cobrar ({dash['por_cobrar']:,.0f}) supera 2× el cobrado mensual.",
            "valor":   dash["por_cobrar"],
        })

    if dash["caja_total"] > 0 and dash["por_pagar"] > 2 * dash["caja_total"]:
        alertas.append({
            "codigo":  "deuda_alta",
            "nivel":   "alta",
            "titulo":  "Deuda por pagar alta",
            "mensaje": f"Por pagar ({dash['por_pagar']:,.0f}) supera 2× la caja actual.",
            "valor":   dash["por_pagar"],
        })

    # Estimación de runway: cuántos días aguanta la caja al ritmo de egresos
    if dash["egresos_mes"] > 0:
        egresos_diario = dash["egresos_mes"] / max(dash["periodo"]["dias_transcurridos"], 1)
        runway_dias = (dash["caja_total"] / egresos_diario) if egresos_diario > 0 else 999
        if runway_dias < 7:
            alertas.append({
                "codigo":  "caja_baja",
                "nivel":   "critico",
                "titulo":  "Liquidez baja",
                "mensaje": f"La caja actual cubre solo {runway_dias:.1f} días al ritmo de egresos.",
                "valor":   round(runway_dias, 1),
            })

    return {"alertas": alertas, "total": len(alertas)}


# ════════════════════════════════════════════════════════════════════════════
# EXPORTACIÓN — CSV / XLSX / PDF
# ════════════════════════════════════════════════════════════════════════════

EXPORT_HEADERS = [
    "Fecha", "Vendido", "Cobrado", "Ingresos manuales", "Ingresos totales",
    "Egresos", "Neto", "Saldo inicial", "Saldo final",
]


@router.get("/export", dependencies=[Depends(require_internal_permission("cash_flow.export"))])
def cash_flow_export(
    format:      str = Query("csv", regex="^(csv|xlsx|pdf)$"),
    start_date:  Optional[str] = None,
    end_date:    Optional[str] = None,
    granularity: str = Query(GRAN_DAY, regex="^(day|week|month|year)$"),
    db: Session = Depends(get_db),
):
    """Exporta el timeline con los totales y KPIs en CSV/XLSX/PDF."""
    data = cash_flow_timeline(start_date, end_date, granularity, db)
    dash = cash_flow_dashboard(db)
    serie = data["serie"]
    totales = data["totales"]
    fname_base = f"cash_flow_{data['start_date']}_{data['end_date']}_{granularity}"

    # ── CSV ────────────────────────────────────────────────────────────────
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["Flujo de Caja — Arepas Betania"])
        w.writerow([f"Período: {data['start_date']} a {data['end_date']} · Granularidad: {granularity}"])
        w.writerow([])
        w.writerow(EXPORT_HEADERS)
        for b in serie:
            w.writerow([
                b["label"], b["vendido"], b["cobrado"], b["ingresos_manuales"],
                b["ingresos_totales"], b["egresos"], b["neto"],
                b["saldo_inicial"], b["saldo_final"],
            ])
        w.writerow([])
        w.writerow(["TOTAL", totales["vendido"], totales["cobrado"],
                    totales["ingresos_manuales"], totales["ingresos_totales"],
                    totales["egresos"], totales["neto"], "", ""])
        w.writerow([])
        w.writerow(["KPIs", ""])
        w.writerow(["Caja actual", dash["caja_total"]])
        w.writerow(["Utilidad mes", dash["utilidad_mes"]])
        w.writerow(["Margen mes %", dash["margen_mes_pct"]])
        w.writerow(["Por cobrar", dash["por_cobrar"]])
        w.writerow(["Por pagar", dash["por_pagar"]])
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{fname_base}.csv"'},
        )

    # ── XLSX ───────────────────────────────────────────────────────────────
    if format == "xlsx":
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
        from openpyxl.utils import get_column_letter

        wb = Workbook()
        ws = wb.active
        ws.title = "Flujo de Caja"
        ws["A1"] = "Flujo de Caja — Arepas Betania"
        ws["A1"].font = Font(bold=True, size=14)
        ws["A2"] = f"Período: {data['start_date']} a {data['end_date']} · Granularidad: {granularity}"
        ws["A2"].font = Font(italic=True, color="6B7280")
        ws.append([])  # row 3 vacía

        ws.append(EXPORT_HEADERS)
        for cell in ws[4]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="374151")
            cell.alignment = Alignment(horizontal="center")

        for b in serie:
            ws.append([
                b["label"], b["vendido"], b["cobrado"], b["ingresos_manuales"],
                b["ingresos_totales"], b["egresos"], b["neto"],
                b["saldo_inicial"], b["saldo_final"],
            ])
        # Fila TOTAL
        total_row_idx = ws.max_row + 1
        ws.append(["TOTAL", totales["vendido"], totales["cobrado"],
                   totales["ingresos_manuales"], totales["ingresos_totales"],
                   totales["egresos"], totales["neto"], "", ""])
        for cell in ws[total_row_idx]:
            cell.font = Font(bold=True)
            cell.fill = PatternFill("solid", fgColor="F3F4F6")

        # Hoja 2: KPIs
        ws2 = wb.create_sheet("KPIs")
        ws2.append(["Indicador", "Valor"])
        for cell in ws2[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="374151")
        for k, v in [
            ("Caja actual",            dash["caja_total"]),
            ("Vendido del mes",        dash["vendido_mes"]),
            ("Cobrado del mes",        dash["cobrado_mes"]),
            ("Egresos del mes",        dash["egresos_mes"]),
            ("Utilidad del mes",       dash["utilidad_mes"]),
            ("Margen del mes (%)",     dash["margen_mes_pct"]),
            ("Crecimiento ingresos %", dash["crecimiento_ingresos_pct"]),
            ("Por cobrar",             dash["por_cobrar"]),
            ("Por pagar",              dash["por_pagar"]),
            ("Promedio diario",        dash["promedio_diario"]),
        ]:
            ws2.append([k, v])

        # Anchos
        for i, w in enumerate([14, 16, 16, 18, 18, 14, 14, 14, 14], start=1):
            ws.column_dimensions[get_column_letter(i)].width = w
        ws2.column_dimensions["A"].width = 26
        ws2.column_dimensions["B"].width = 18

        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{fname_base}.xlsx"'},
        )

    # ── PDF ────────────────────────────────────────────────────────────────
    # format == "pdf"
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import landscape, A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        )
    except ImportError:
        raise HTTPException(500, "reportlab no instalado en el servidor")

    fmt_money = lambda v: f"${v:,.0f}" if isinstance(v, (int, float)) else str(v)
    out = io.BytesIO()
    doc = SimpleDocTemplate(out, pagesize=landscape(A4),
                            rightMargin=1.2*cm, leftMargin=1.2*cm,
                            topMargin=1*cm, bottomMargin=1*cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"],
                                 fontSize=18, textColor=colors.HexColor("#1f2937"))
    sub_style = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=10,
                               textColor=colors.HexColor("#6b7280"))
    body = []
    body.append(Paragraph("Flujo de Caja — Arepas Betania", title_style))
    body.append(Paragraph(
        f"Período: {data['start_date']} a {data['end_date']} · Granularidad: {granularity}",
        sub_style,
    ))
    body.append(Spacer(1, 0.4*cm))

    # KPIs en cuadro
    kpis_data = [
        ["Caja actual", fmt_money(dash["caja_total"]),
         "Utilidad mes", fmt_money(dash["utilidad_mes"])],
        ["Vendido mes", fmt_money(dash["vendido_mes"]),
         "Margen mes", f"{dash['margen_mes_pct']:.1f}%"],
        ["Cobrado mes", fmt_money(dash["cobrado_mes"]),
         "Por cobrar", fmt_money(dash["por_cobrar"])],
        ["Egresos mes", fmt_money(dash["egresos_mes"]),
         "Por pagar", fmt_money(dash["por_pagar"])],
    ]
    kt = Table(kpis_data, colWidths=[3.5*cm, 4*cm, 3.5*cm, 4*cm])
    kt.setStyle(TableStyle([
        ("FONT", (0,0), (-1,-1), "Helvetica", 10),
        ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#f3f4f6")),
        ("BACKGROUND", (2,0), (2,-1), colors.HexColor("#f3f4f6")),
        ("TEXTCOLOR", (1,0), (1,-1), colors.HexColor("#10b981")),
        ("TEXTCOLOR", (3,0), (3,-1), colors.HexColor("#ef4444")),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("ALIGN", (3,0), (3,-1), "RIGHT"),
        ("FONT", (1,0), (1,-1), "Helvetica-Bold", 10),
        ("FONT", (3,0), (3,-1), "Helvetica-Bold", 10),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#e5e7eb")),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    body.append(kt)
    body.append(Spacer(1, 0.5*cm))

    # Tabla de timeline
    tbl_data = [EXPORT_HEADERS]
    for b in serie:
        tbl_data.append([
            b["label"],
            fmt_money(b["vendido"]),
            fmt_money(b["cobrado"]),
            fmt_money(b["ingresos_manuales"]),
            fmt_money(b["ingresos_totales"]),
            fmt_money(b["egresos"]),
            fmt_money(b["neto"]),
            fmt_money(b["saldo_inicial"]),
            fmt_money(b["saldo_final"]),
        ])
    tbl_data.append([
        "TOTAL",
        fmt_money(totales["vendido"]),
        fmt_money(totales["cobrado"]),
        fmt_money(totales["ingresos_manuales"]),
        fmt_money(totales["ingresos_totales"]),
        fmt_money(totales["egresos"]),
        fmt_money(totales["neto"]),
        "", "",
    ])
    t = Table(tbl_data, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#374151")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONT", (0,0), (-1,0), "Helvetica-Bold", 9),
        ("FONT", (0,1), (-1,-1), "Helvetica", 8),
        ("ALIGN", (1,0), (-1,-1), "RIGHT"),
        ("ALIGN", (0,0), (0,-1), "LEFT"),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#f3f4f6")),
        ("FONT", (0,-1), (-1,-1), "Helvetica-Bold", 9),
        ("INNERGRID", (0,0), (-1,-1), 0.2, colors.HexColor("#e5e7eb")),
        ("BOX", (0,0), (-1,-1), 0.4, colors.HexColor("#9ca3af")),
        ("ROWBACKGROUNDS", (0,1), (-1,-2), [colors.white, colors.HexColor("#f9fafb")]),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    body.append(t)

    body.append(Spacer(1, 0.4*cm))
    body.append(Paragraph(
        f"<font color='#6b7280' size='8'>Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')} · "
        f"Arepas Betania · Sistema ERP</font>",
        sub_style,
    ))
    doc.build(body)
    out.seek(0)
    return StreamingResponse(
        out,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname_base}.pdf"'},
    )


# ════════════════════════════════════════════════════════════════════════════
# CRUD — Ingresos manuales
# ════════════════════════════════════════════════════════════════════════════

@router.get("/ingresos-manuales",
            dependencies=[Depends(require_internal_permission("ingresos_manuales.ver"))])
def list_ingresos_manuales(
    start_date: Optional[str] = None,
    end_date:   Optional[str] = None,
    estado:     Optional[str] = None,
    categoria_id: Optional[int] = None,
    skip:  int = Query(0,   ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = (db.query(IngresoManual)
         .options(joinedload(IngresoManual.categoria),
                  joinedload(IngresoManual.subcategoria),
                  joinedload(IngresoManual.medio_pago),
                  joinedload(IngresoManual.creador))
         .order_by(IngresoManual.fecha.desc(), IngresoManual.id.desc()))
    if start_date:
        q = q.filter(IngresoManual.fecha >= _parse_date(start_date, _today()))
    if end_date:
        q = q.filter(IngresoManual.fecha <= _parse_date(end_date, _today()))
    if estado:
        q = q.filter(IngresoManual.estado == estado)
    if categoria_id is not None:
        q = q.filter(IngresoManual.categoria_id == categoria_id)
    rows = q.offset(skip).limit(limit).all()
    return [_ingreso_manual_dict(m) for m in rows]


@router.post("/ingresos-manuales", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_internal_permission("ingresos_manuales.crear"))])
def create_ingreso_manual(
    payload: IngresoManualCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    data = payload.model_dump()
    if data.get("tipo") not in ("operativo", "no_operativo", "extraordinario", None):
        raise HTTPException(400, "tipo inválido")
    # Validar coherencia subcategoría ↔ categoría
    if data.get("subcategoria_id"):
        sub = db.query(Subcategoria).filter(Subcategoria.id == data["subcategoria_id"]).first()
        if not sub:
            raise HTTPException(404, "Subcategoría no encontrada")
        if data.get("categoria_id") and sub.categoria_id != data["categoria_id"]:
            raise HTTPException(400, "subcategoría no pertenece a la categoría")
        if not data.get("categoria_id"):
            data["categoria_id"] = sub.categoria_id
    # Validar que categoría sea del módulo ingresos
    if data.get("categoria_id"):
        cat = db.query(Categoria).filter(Categoria.id == data["categoria_id"]).first()
        if not cat:
            raise HTTPException(404, "Categoría no encontrada")
        if cat.modulo_codigo != "ingresos":
            raise HTTPException(400,
                f"Categoría '{cat.nombre}' no pertenece al módulo 'ingresos'")
    obj = IngresoManual(**data, created_by=user.id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    # Recargar con relaciones
    obj = (db.query(IngresoManual)
             .options(joinedload(IngresoManual.categoria),
                      joinedload(IngresoManual.subcategoria),
                      joinedload(IngresoManual.medio_pago),
                      joinedload(IngresoManual.creador))
             .filter(IngresoManual.id == obj.id).first())
    return _ingreso_manual_dict(obj)


@router.put("/ingresos-manuales/{ingreso_id}",
            dependencies=[Depends(require_internal_permission("ingresos_manuales.editar"))])
def update_ingreso_manual(
    ingreso_id: int,
    payload: IngresoManualCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    obj = db.query(IngresoManual).filter(IngresoManual.id == ingreso_id).first()
    if not obj:
        raise HTTPException(404, "Ingreso manual no encontrado")
    if obj.estado == "anulado":
        raise HTTPException(400, "No se puede editar un ingreso anulado")
    data = payload.model_dump(exclude_unset=True)
    if data.get("categoria_id"):
        cat = db.query(Categoria).filter(Categoria.id == data["categoria_id"]).first()
        if cat and cat.modulo_codigo != "ingresos":
            raise HTTPException(400,
                f"Categoría '{cat.nombre}' no pertenece al módulo 'ingresos'")
    for k, v in data.items():
        setattr(obj, k, v)
    obj.updated_by = user.id
    obj.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(obj)
    obj = (db.query(IngresoManual)
             .options(joinedload(IngresoManual.categoria),
                      joinedload(IngresoManual.subcategoria),
                      joinedload(IngresoManual.medio_pago),
                      joinedload(IngresoManual.creador))
             .filter(IngresoManual.id == obj.id).first())
    return _ingreso_manual_dict(obj)


@router.delete("/ingresos-manuales/{ingreso_id}",
               dependencies=[Depends(require_internal_permission("ingresos_manuales.eliminar"))])
def anular_ingreso_manual(
    ingreso_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Soft-delete: marca el ingreso como anulado."""
    obj = db.query(IngresoManual).filter(IngresoManual.id == ingreso_id).first()
    if not obj:
        raise HTTPException(404, "Ingreso manual no encontrado")
    if obj.estado == "anulado":
        raise HTTPException(400, "El ingreso ya está anulado")
    obj.estado = "anulado"
    obj.anulado_by = user.id
    obj.anulado_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "id": ingreso_id}


# ════════════════════════════════════════════════════════════════════════════
# CATEGORÍAS de ingresos — proxy para conveniencia en el frontend
# ════════════════════════════════════════════════════════════════════════════

@router.get("/categorias-ingreso",
            dependencies=[Depends(require_internal_permission("cash_flow.ver"))])
def get_categorias_ingreso(db: Session = Depends(get_db)):
    """Devuelve categorías + subcategorías del módulo ingresos para selects."""
    cats = (db.query(Categoria)
              .options(joinedload(Categoria.subcategorias))
              .filter(Categoria.modulo_codigo == "ingresos",
                      Categoria.activo == True)
              .order_by(Categoria.orden, Categoria.nombre)
              .all())
    return [
        {
            "id":     c.id,
            "nombre": c.nombre,
            "tipo":   c.tipo,
            "icono":  c.icono,
            "color":  c.color,
            "subcategorias": [
                {"id": s.id, "nombre": s.nombre, "icono": s.icono, "color": s.color}
                for s in (c.subcategorias or []) if s.activo
            ],
        }
        for c in cats
    ]


# ════════════════════════════════════════════════════════════════════════════
# MOVIMIENTOS POR MEDIO DE PAGO — vista unificada de fuentes
# ════════════════════════════════════════════════════════════════════════════

TIPOS_MOVIMIENTO_VALIDOS = {"pedido", "gasto", "movimiento", "ingreso_manual"}


@router.get("/movimientos-por-medio",
            dependencies=[Depends(require_internal_permission("cash_flow.ver"))])
def movimientos_por_medio(
    start_date: Optional[str] = None,
    end_date:   Optional[str] = None,
    medio_pago_ids: Optional[str] = Query(None, description="IDs separados por coma"),
    tipos:          Optional[str] = Query(None, description="pedido,gasto,movimiento,ingreso_manual"),
    db: Session = Depends(get_db),
):
    """
    Lista unificada de movimientos por medio de pago, agrupando 4 fuentes:
      • pedido         — pagos (abonos de clientes a pedidos)
      • gasto          — gastos pagados de contado + abonos a gastos
      • movimiento     — transferencias entre medios (genera 2 filas: salida + entrada)
      • ingreso_manual — ingresos_manuales en estado 'activo'

    Filtros opcionales: rango de fechas, lista de medios, lista de tipos.
    """
    hoy = _today()
    desde = _parse_date(start_date, hoy.replace(day=1))
    hasta = _parse_date(end_date, hoy)

    medio_ids: list[int] = []
    if medio_pago_ids:
        try:
            medio_ids = [int(x) for x in medio_pago_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="medio_pago_ids inválido")

    tipos_set: set[str] = set()
    if tipos:
        tipos_set = {t.strip() for t in tipos.split(",") if t.strip()}
        invalidos = tipos_set - TIPOS_MOVIMIENTO_VALIDOS
        if invalidos:
            raise HTTPException(status_code=400, detail=f"Tipos inválidos: {invalidos}")
    if not tipos_set:
        tipos_set = set(TIPOS_MOVIMIENTO_VALIDOS)

    params: dict = {"desde": desde, "hasta": hasta}
    medio_filter_sql = ""
    if medio_ids:
        # IDs ya validados como int — safe para inline
        medio_filter_sql = f"AND m.medio_pago_id IN ({','.join(str(i) for i in medio_ids)})"

    parts: list[str] = []

    if "pedido" in tipos_set:
        parts.append("""
            SELECT
                'pago_' || pg.id            AS id,
                'pedido'                    AS tipo,
                'ingreso'                   AS sentido,
                pg.fecha::date              AS fecha,
                pg.medio_pago_id            AS medio_pago_id,
                pg.monto::numeric           AS monto,
                CASE
                    WHEN pedidos_str IS NOT NULL
                        THEN 'Pago pedido(s) #' || pedidos_str
                    ELSE 'Pago general (sin pedido vinculado)'
                END                         AS descripcion,
                cl.nombre                   AS contraparte,
                pg.id                       AS source_id
            FROM pagos pg
            LEFT JOIN clientes cl ON cl.id = pg.cliente_id
            LEFT JOIN LATERAL (
                SELECT string_agg(pp.pedido_id::text, ', ' ORDER BY pp.pedido_id) AS pedidos_str
                FROM pagos_pedidos pp
                WHERE pp.pago_id = pg.id
            ) p ON true
            WHERE pg.medio_pago_id IS NOT NULL
              AND pg.fecha::date BETWEEN :desde AND :hasta
        """)

    if "gasto" in tipos_set:
        # gastos de contado (medio_pago_id directo, sin abonos asociados)
        parts.append("""
            SELECT
                'gasto_' || g.id                                       AS id,
                'gasto'                                                AS tipo,
                'egreso'                                               AS sentido,
                COALESCE(g.fecha_pago::date, g.fecha)                  AS fecha,
                g.medio_pago_id                                        AS medio_pago_id,
                g.monto_pagado::numeric                                AS monto,
                COALESCE(NULLIF(g.concepto,''), NULLIF(g.descripcion,''),
                         'Gasto #' || g.id)                            AS descripcion,
                pr.nombre                                              AS contraparte,
                g.id                                                   AS source_id
            FROM gastos g
            LEFT JOIN proveedores pr ON pr.id = g.proveedor_id
            WHERE g.medio_pago_id IS NOT NULL
              AND g.monto_pagado > 0
              AND g.estado <> 'anulado'
              AND NOT EXISTS (SELECT 1 FROM abonos_gastos a WHERE a.gasto_id = g.id)
              AND COALESCE(g.fecha_pago::date, g.fecha) BETWEEN :desde AND :hasta
        """)
        # abonos a gastos
        parts.append("""
            SELECT
                'abono_gasto_' || ag.id                                AS id,
                'gasto'                                                AS tipo,
                'egreso'                                               AS sentido,
                ag.fecha                                               AS fecha,
                ag.medio_pago_id                                       AS medio_pago_id,
                ag.monto::numeric                                      AS monto,
                'Abono gasto #' || g.id || ': ' ||
                  COALESCE(NULLIF(g.concepto,''), NULLIF(g.descripcion,''), 'Gasto') AS descripcion,
                pr.nombre                                              AS contraparte,
                ag.id                                                  AS source_id
            FROM abonos_gastos ag
            JOIN gastos g       ON g.id = ag.gasto_id
            LEFT JOIN proveedores pr ON pr.id = g.proveedor_id
            WHERE ag.medio_pago_id IS NOT NULL
              AND g.estado <> 'anulado'
              AND ag.fecha BETWEEN :desde AND :hasta
        """)

    if "movimiento" in tipos_set:
        # transferencia: entrada al destino
        parts.append("""
            SELECT
                'transf_in_' || t.id                                   AS id,
                'movimiento'                                           AS tipo,
                'ingreso'                                              AS sentido,
                t.fecha                                                AS fecha,
                t.destino_id                                           AS medio_pago_id,
                t.valor::numeric                                       AS monto,
                'Transferencia desde ' || mp_origen.nombre ||
                  COALESCE(' — ' || t.descripcion, '')                 AS descripcion,
                mp_origen.nombre                                       AS contraparte,
                t.id                                                   AS source_id
            FROM transferencias t
            JOIN medios_pago mp_origen ON mp_origen.id = t.origen_id
            WHERE t.fecha BETWEEN :desde AND :hasta
        """)
        # transferencia: salida del origen
        parts.append("""
            SELECT
                'transf_out_' || t.id                                  AS id,
                'movimiento'                                           AS tipo,
                'egreso'                                               AS sentido,
                t.fecha                                                AS fecha,
                t.origen_id                                            AS medio_pago_id,
                t.valor::numeric                                       AS monto,
                'Transferencia hacia ' || mp_destino.nombre ||
                  COALESCE(' — ' || t.descripcion, '')                 AS descripcion,
                mp_destino.nombre                                      AS contraparte,
                t.id                                                   AS source_id
            FROM transferencias t
            JOIN medios_pago mp_destino ON mp_destino.id = t.destino_id
            WHERE t.fecha BETWEEN :desde AND :hasta
        """)

    if "ingreso_manual" in tipos_set:
        parts.append("""
            SELECT
                'ingreso_' || im.id                                    AS id,
                'ingreso_manual'                                       AS tipo,
                'ingreso'                                              AS sentido,
                im.fecha                                               AS fecha,
                im.medio_pago_id                                       AS medio_pago_id,
                im.valor::numeric                                      AS monto,
                COALESCE(NULLIF(im.descripcion,''), 'Ingreso manual')  AS descripcion,
                cat.nombre                                             AS contraparte,
                im.id                                                  AS source_id
            FROM ingresos_manuales im
            LEFT JOIN categorias cat ON cat.id = im.categoria_id
            WHERE im.estado = 'activo'
              AND im.medio_pago_id IS NOT NULL
              AND im.fecha BETWEEN :desde AND :hasta
        """)

    if not parts:
        return {"items": [], "totales": {"ingresos": 0, "egresos": 0, "neto": 0}}

    sql_inner = " UNION ALL ".join(parts)
    sql = f"""
        SELECT m.*, mp.nombre AS medio_pago_nombre, mp.tipo AS medio_pago_tipo
        FROM ( {sql_inner} ) m
        JOIN medios_pago mp ON mp.id = m.medio_pago_id
        WHERE 1=1 {medio_filter_sql}
        ORDER BY m.fecha DESC, m.id DESC
    """

    rows = db.execute(text(sql), params).fetchall()
    items = []
    ingresos_total = 0.0
    egresos_total = 0.0
    for r in rows:
        monto = float(r.monto or 0)
        if r.sentido == "ingreso":
            ingresos_total += monto
        else:
            egresos_total += monto
        items.append({
            "id":           r.id,
            "tipo":         r.tipo,
            "sentido":      r.sentido,
            "fecha":        str(r.fecha),
            "medio_pago":   {"id": r.medio_pago_id, "nombre": r.medio_pago_nombre, "tipo": r.medio_pago_tipo},
            "monto":        monto,
            "descripcion":  r.descripcion or "",
            "contraparte":  r.contraparte or "",
            "source_id":    r.source_id,
        })

    return {
        "items": items,
        "totales": {
            "ingresos": round(ingresos_total, 2),
            "egresos":  round(egresos_total, 2),
            "neto":     round(ingresos_total - egresos_total, 2),
        },
        "filtros": {
            "desde": str(desde), "hasta": str(hasta),
            "medio_pago_ids": medio_ids,
            "tipos": sorted(tipos_set),
        },
    }

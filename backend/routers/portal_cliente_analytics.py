"""
Portal Cliente Analytics — Módulo premium de analítica del portal cliente.

Reglas:
  - Solo usuarios con permiso `portal.analytics` y con cliente_id vinculado.
  - Acceso efectivo requiere además que `clientes.analytics_enabled = TRUE`
    y que `analytics_expires_at >= NOW()` (paywall).
  - Todas las consultas filtran por user.cliente_id — jamás se acepta
    cliente_id desde el request (multi-tenant estricto).
  - Mínimo de 2 muestras por día de semana para generar recomendación.
"""
import logging
from datetime import date, datetime, timedelta
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from sql_models import Usuario, Cliente, AnalyticsSolicitud
from auth import require_permission
from utils import get_now_colombia
from pydantic import BaseModel, Field

router = APIRouter(tags=["Portal Cliente — Analytics"])
logger = logging.getLogger(__name__)

_BUFFER_DEFAULT     = 1.10
MIN_MUESTRAS_DOW    = 2

def _buffer_seguridad() -> float:
    from units import get_parametro
    return get_parametro("buffer_seguridad_forecast", _BUFFER_DEFAULT, "numero")
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def _plural_dia(nombre: str) -> str:
    """Lunes → Lunes; Sábado → Sábados. Evita plurales como 'Vierness'."""
    return nombre if nombre.endswith("s") else f"{nombre}s"


# ─────────────────────────────────────────────────────────────
# DEPENDENCIAS
# ─────────────────────────────────────────────────────────────

def _get_cliente_user(user: Usuario = Depends(require_permission("portal.analytics"))) -> Usuario:
    if not user.cliente_id:
        raise HTTPException(status_code=403, detail="Tu cuenta no está vinculada a ningún cliente.")
    return user


def _cargar_cliente(db: Session, cid: int) -> Cliente:
    cliente = db.query(Cliente).filter(Cliente.id == cid).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


def _suscripcion_activa(cliente: Cliente) -> bool:
    if not cliente.analytics_enabled:
        return False
    if not cliente.analytics_expires_at:
        return False
    return cliente.analytics_expires_at >= get_now_colombia()


def _require_suscripcion(cliente: Cliente):
    if not _suscripcion_activa(cliente):
        raise HTTPException(
            status_code=402,
            detail="Módulo analítica no activo. Contacta al administrador para activar tu suscripción.",
        )


# ─────────────────────────────────────────────────────────────
# STATUS — siempre accesible (el paywall decide qué mostrar)
# ─────────────────────────────────────────────────────────────

class SolicitudBody(BaseModel):
    mensaje: str = Field("", max_length=500)


@router.post("/solicitar", status_code=201)
def solicitar_activacion(
    body: SolicitudBody,
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """
    Registra una solicitud de activación del módulo analítica por parte del cliente.
    Si ya existe una solicitud pendiente del mismo cliente, no crea otra (idempotente).
    """
    existente = (
        db.query(AnalyticsSolicitud)
          .filter(
              AnalyticsSolicitud.cliente_id == user.cliente_id,
              AnalyticsSolicitud.estado == "pendiente",
          )
          .first()
    )
    if existente:
        return {
            "ok": True,
            "id": existente.id,
            "estado": existente.estado,
            "fecha_solicitud": existente.fecha_solicitud.isoformat(),
            "ya_existia": True,
        }

    solicitud = AnalyticsSolicitud(
        cliente_id = user.cliente_id,
        usuario_id = user.id,
        estado     = "pendiente",
        mensaje    = (body.mensaje or "").strip() or None,
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)
    logger.info("Solicitud analytics creada cliente_id=%s usuario_id=%s id=%s", user.cliente_id, user.id, solicitud.id)

    return {
        "ok": True,
        "id": solicitud.id,
        "estado": solicitud.estado,
        "fecha_solicitud": solicitud.fecha_solicitud.isoformat(),
        "ya_existia": False,
    }


@router.get("/mi-solicitud")
def mi_solicitud(
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """Retorna la solicitud más reciente del cliente (para mostrar el estado en el paywall)."""
    row = (
        db.query(AnalyticsSolicitud)
          .filter(AnalyticsSolicitud.cliente_id == user.cliente_id)
          .order_by(AnalyticsSolicitud.fecha_solicitud.desc(), AnalyticsSolicitud.id.desc())
          .first()
    )
    if not row:
        return None
    return {
        "id":              row.id,
        "estado":          row.estado,
        "fecha_solicitud": row.fecha_solicitud.isoformat() if row.fecha_solicitud else None,
        "fecha_revision":  row.fecha_revision.isoformat() if row.fecha_revision else None,
        "notas_admin":     row.notas_admin,
    }


@router.get("/status")
def status(
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """Retorna el estado de la suscripción del cliente al módulo analítica."""
    cliente = _cargar_cliente(db, user.cliente_id)
    activa = _suscripcion_activa(cliente)
    ahora = get_now_colombia()

    dias_restantes = None
    if activa and cliente.analytics_expires_at:
        delta = cliente.analytics_expires_at - ahora
        dias_restantes = max(0, delta.days)

    return {
        "enabled":         bool(cliente.analytics_enabled),
        "activa":          activa,
        "activated_at":    cliente.analytics_activated_at.isoformat() if cliente.analytics_activated_at else None,
        "expires_at":      cliente.analytics_expires_at.isoformat() if cliente.analytics_expires_at else None,
        "dias_restantes":  dias_restantes,
        "precio_mensual":  10000,
        "moneda":          "COP",
    }


# ─────────────────────────────────────────────────────────────
# HELPERS — SIEMPRE filtrados por cliente_id
# ─────────────────────────────────────────────────────────────

def _consumo_diario_cliente(db: Session, cid: int, dias: int) -> dict[str, dict]:
    """
    Retorna {fecha_str: {'ventas_cop', 'unidades', 'num_pedidos'}} para los
    últimos `dias` días, SOLO para pedidos de este cliente.
    """
    desde = date.today() - timedelta(days=dias)
    sql = text("""
        SELECT
            DATE(p.fecha AT TIME ZONE 'America/Bogota')         AS dia,
            COALESCE(SUM(p.total), 0)                           AS ventas_cop,
            COALESCE(SUM(dp.cantidad), 0)                       AS unidades,
            COUNT(DISTINCT p.id)                                AS num_pedidos
        FROM pedidos p
        JOIN detalle_pedido dp ON dp.pedido_id = p.id
        WHERE p.cliente_id = :cid
          AND p.estado <> 'cancelado'
          AND DATE(p.fecha AT TIME ZONE 'America/Bogota') >= :desde
        GROUP BY dia
        ORDER BY dia
    """)
    rows = db.execute(sql, {"cid": cid, "desde": desde}).fetchall()
    return {
        str(r.dia): {
            "ventas_cop":  float(r.ventas_cop),
            "unidades":    float(r.unidades),
            "num_pedidos": int(r.num_pedidos),
        }
        for r in rows
    }


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


# ─────────────────────────────────────────────────────────────
# DASHBOARD — resumen global del cliente
# ─────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(
    dias: int = 30,
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """Resumen: totales, ventas diarias, ticket promedio, productos distintos."""
    cliente = _cargar_cliente(db, user.cliente_id)
    _require_suscripcion(cliente)
    cid = user.cliente_id

    dias = max(7, min(dias, 180))
    desde = date.today() - timedelta(days=dias)

    consumo = _consumo_diario_cliente(db, cid, dias)

    # Serie rellena con ceros
    serie = []
    for i in range(dias):
        d = date.today() - timedelta(days=dias - 1 - i)
        datos = consumo.get(str(d), {"ventas_cop": 0, "unidades": 0, "num_pedidos": 0})
        serie.append({
            "fecha":       str(d),
            "dia_semana":  DIAS_SEMANA[d.weekday()][:3],
            "ventas_cop":  round(datos["ventas_cop"], 0),
            "unidades":    round(datos["unidades"], 1),
            "num_pedidos": datos["num_pedidos"],
        })

    total_ventas   = sum(r["ventas_cop"]  for r in serie)
    total_pedidos  = sum(r["num_pedidos"] for r in serie)
    total_unidades = sum(r["unidades"]    for r in serie)
    dias_activos   = sum(1 for r in serie if r["num_pedidos"] > 0)

    # Productos distintos comprados en el período
    prod_sql = text("""
        SELECT COUNT(DISTINCT dp.producto_id) AS n
        FROM detalle_pedido dp
        JOIN pedidos p ON p.id = dp.pedido_id
        WHERE p.cliente_id = :cid
          AND p.estado <> 'cancelado'
          AND DATE(p.fecha AT TIME ZONE 'America/Bogota') >= :desde
    """)
    productos_distintos = int(db.execute(prod_sql, {"cid": cid, "desde": desde}).fetchone().n or 0)

    return {
        "periodo_dias": dias,
        "resumen": {
            "total_ventas_cop":     round(total_ventas, 0),
            "total_pedidos":        total_pedidos,
            "total_unidades":       round(total_unidades, 1),
            "dias_activos":         dias_activos,
            "ticket_promedio_cop":  round(total_ventas / total_pedidos, 0) if total_pedidos else 0,
            "productos_distintos":  productos_distintos,
        },
        "serie_diaria": serie,
    }


# ─────────────────────────────────────────────────────────────
# VENTAS POR DÍA DE SEMANA
# ─────────────────────────────────────────────────────────────

@router.get("/ventas-por-dow")
def ventas_por_dow(
    dias: int = 90,
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """
    Agrega ventas del cliente por día de semana para identificar patrones.
    Retorna estadísticas para cada día (lun-dom).
    """
    cliente = _cargar_cliente(db, user.cliente_id)
    _require_suscripcion(cliente)
    cid = user.cliente_id

    dias = max(30, min(dias, 365))
    consumo = _consumo_diario_cliente(db, cid, dias)

    por_dow: dict[int, dict] = defaultdict(lambda: {"ventas": [], "unidades": [], "pedidos": []})
    for fecha_str, datos in consumo.items():
        d = date.fromisoformat(fecha_str)
        if datos["num_pedidos"] > 0:
            por_dow[d.weekday()]["ventas"].append(datos["ventas_cop"])
            por_dow[d.weekday()]["unidades"].append(datos["unidades"])
            por_dow[d.weekday()]["pedidos"].append(datos["num_pedidos"])

    stats = []
    for i in range(7):
        b = por_dow.get(i, {"ventas": [], "unidades": [], "pedidos": []})
        stats.append({
            "dow":              i,
            "dia":              DIAS_SEMANA[i],
            "dia_corto":        DIAS_SEMANA[i][:3],
            "muestras":         len(b["ventas"]),
            "promedio_ventas":  round(_avg(b["ventas"]), 0),
            "promedio_unidades": round(_avg(b["unidades"]), 1),
            "promedio_pedidos": round(_avg(b["pedidos"]), 1),
            "total_ventas":     round(sum(b["ventas"]), 0),
        })

    dia_pico = max(stats, key=lambda x: x["promedio_ventas"]) if any(s["muestras"] for s in stats) else None
    dia_bajo_stats = [s for s in stats if s["muestras"] > 0]
    dia_bajo = min(dia_bajo_stats, key=lambda x: x["promedio_ventas"]) if dia_bajo_stats else None

    return {
        "periodo_dias": dias,
        "por_dia_semana": stats,
        "dia_pico": dia_pico,
        "dia_bajo": dia_bajo,
    }


# ─────────────────────────────────────────────────────────────
# PRODUCTOS TOP DEL CLIENTE
# ─────────────────────────────────────────────────────────────

@router.get("/productos-top")
def productos_top(
    dias: int = 30,
    limit: int = 10,
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """Top productos que el cliente más compra."""
    cliente = _cargar_cliente(db, user.cliente_id)
    _require_suscripcion(cliente)
    cid = user.cliente_id

    dias = max(7, min(dias, 365))
    limit = max(3, min(limit, 30))
    desde = date.today() - timedelta(days=dias)

    sql = text("""
        SELECT
            pr.id,
            pr.nombre,
            pr.codigo_corto,
            SUM(dp.cantidad)  AS unidades,
            SUM(dp.subtotal)  AS ventas_cop,
            COUNT(DISTINCT p.id) AS pedidos
        FROM detalle_pedido dp
        JOIN pedidos p    ON p.id = dp.pedido_id
        JOIN productos pr ON pr.id = dp.producto_id
        WHERE p.cliente_id = :cid
          AND p.estado <> 'cancelado'
          AND DATE(p.fecha AT TIME ZONE 'America/Bogota') >= :desde
        GROUP BY pr.id, pr.nombre, pr.codigo_corto
        ORDER BY unidades DESC
        LIMIT :limit
    """)
    rows = db.execute(sql, {"cid": cid, "desde": desde, "limit": limit}).fetchall()

    total_unidades = sum(float(r.unidades) for r in rows)
    total_ventas   = sum(float(r.ventas_cop) for r in rows)

    return {
        "periodo_dias": dias,
        "total_unidades": round(total_unidades, 1),
        "total_ventas_cop": round(total_ventas, 0),
        "productos": [
            {
                "id":           r.id,
                "nombre":       r.nombre,
                "codigo":       r.codigo_corto,
                "unidades":     round(float(r.unidades), 1),
                "ventas_cop":   round(float(r.ventas_cop), 0),
                "pedidos":      int(r.pedidos),
                "pct_unidades": round(float(r.unidades) / total_unidades * 100, 1) if total_unidades else 0,
                "pct_ventas":   round(float(r.ventas_cop) / total_ventas * 100, 1) if total_ventas else 0,
            }
            for r in rows
        ],
    }


# ─────────────────────────────────────────────────────────────
# RECOMENDACIONES — motor por día de semana
# ─────────────────────────────────────────────────────────────

@router.get("/recomendaciones")
def recomendaciones(
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """
    Motor de recomendación para MAÑANA:
      - Por cada producto, promedia las cantidades compradas en los mismos
        días de semana históricos.
      - Requiere al menos 2 muestras del día de semana para recomendar.
      - Aplica buffer +10% sobre el promedio (ajuste operativo).
    """
    cliente = _cargar_cliente(db, user.cliente_id)
    _require_suscripcion(cliente)
    cid = user.cliente_id

    hoy    = date.today()
    manana = hoy + timedelta(days=1)
    dow_manana = manana.weekday()
    nombre_manana = DIAS_SEMANA[dow_manana]

    # Consulta: por producto, listar cantidades históricas agrupadas por fecha
    # para el mismo día de semana que mañana.
    sql = text("""
        SELECT
            pr.id                                  AS producto_id,
            pr.nombre                              AS nombre,
            pr.codigo_corto                        AS codigo,
            DATE(p.fecha AT TIME ZONE 'America/Bogota') AS dia,
            SUM(dp.cantidad)                       AS cantidad_dia
        FROM detalle_pedido dp
        JOIN pedidos p    ON p.id = dp.pedido_id
        JOIN productos pr ON pr.id = dp.producto_id
        WHERE p.cliente_id = :cid
          AND p.estado <> 'cancelado'
          AND DATE(p.fecha AT TIME ZONE 'America/Bogota') >= :desde
          AND EXTRACT(ISODOW FROM (p.fecha AT TIME ZONE 'America/Bogota')) = :isodow
          AND pr.activo = TRUE
        GROUP BY pr.id, pr.nombre, pr.codigo_corto, dia
        ORDER BY pr.id, dia
    """)
    desde = hoy - timedelta(days=180)
    # EXTRACT(ISODOW) devuelve 1=Lunes … 7=Domingo. Python weekday(): 0=Lun … 6=Dom
    isodow = dow_manana + 1

    rows = db.execute(sql, {"cid": cid, "desde": desde, "isodow": isodow}).fetchall()

    por_producto: dict[int, dict] = {}
    for r in rows:
        por_producto.setdefault(r.producto_id, {
            "id":       r.producto_id,
            "nombre":   r.nombre,
            "codigo":   r.codigo,
            "muestras": [],
        })
        por_producto[r.producto_id]["muestras"].append(float(r.cantidad_dia))

    buffer = _buffer_seguridad()
    recomendaciones_list = []
    productos_insuficientes = []
    for prod_id, data in por_producto.items():
        muestras = data["muestras"]
        n = len(muestras)
        promedio = _avg(muestras)
        if n >= MIN_MUESTRAS_DOW and promedio > 0:
            sugerido = round(promedio * buffer, 1)
            ultimo = muestras[-1] if muestras else 0
            tendencia = ((muestras[-1] - _avg(muestras[:-1])) / _avg(muestras[:-1]) * 100) if n >= 3 and _avg(muestras[:-1]) > 0 else 0
            recomendaciones_list.append({
                "producto_id":   prod_id,
                "nombre":        data["nombre"],
                "codigo":        data["codigo"],
                "muestras":      n,
                "promedio":      round(promedio, 1),
                "ultima_compra": round(ultimo, 1),
                "sugerido":      sugerido,
                "tendencia_pct": round(tendencia, 1),
                "confianza":     "alta" if n >= 6 else "media" if n >= 4 else "baja",
            })
        else:
            productos_insuficientes.append({
                "producto_id": prod_id,
                "nombre":      data["nombre"],
                "muestras":    n,
            })

    recomendaciones_list.sort(key=lambda x: x["sugerido"], reverse=True)

    return {
        "fecha_objetivo":           manana.isoformat(),
        "dia_semana":               nombre_manana,
        "min_muestras_requeridas":  MIN_MUESTRAS_DOW,
        "buffer_aplicado_pct":      int((buffer - 1) * 100),
        "total_recomendaciones":    len(recomendaciones_list),
        "recomendaciones":          recomendaciones_list,
        "productos_insuficientes":  productos_insuficientes,
        "descripcion": (
            f"Mañana es {nombre_manana}. Recomendaciones basadas en los últimos "
            f"{_plural_dia(nombre_manana)} que compraste (mínimo {MIN_MUESTRAS_DOW} muestras, "
            f"+{int((buffer - 1) * 100)}% buffer operativo)."
        ),
    }

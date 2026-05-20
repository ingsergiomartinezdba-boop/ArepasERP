"""
Analytics router — Módulo de analítica y forecasting para la fábrica de arepas.

Lógica de forecast de masa (por día de semana):
  - consumo_dia = SUM(detalle_pedido.cantidad × producto_insumos.cantidad)
    filtrado por insumos que son salida de una receta_coccion (masa-class).
  - Para recomendar el día D+1, se toma el promedio histórico de TODOS los días D+1
    del mismo día de semana (p.ej. si mañana es sábado, promedia todos los sábados históricos).
  - forecast = promedio_dia_semana_manana * BUFFER_SEGURIDAD (1.10)
  - Si no hay suficientes muestras del día de semana, cae back al promedio general de 7 días.

La masa se modela como un insumo más en producto_insumos. Los insumos
clasificados como "masa" son los referenciados por recetas_coccion.insumo_salida_id.
"""
import logging
from datetime import date, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from auth import require_internal_permission

router = APIRouter()
logger = logging.getLogger(__name__)

_BUFFER_DEFAULT = 1.10   # fallback si parametros_sistema no tiene la clave

def _buffer_seguridad() -> float:
    """Lee buffer_seguridad_forecast desde parametros_sistema (con fallback)."""
    from units import get_parametro
    return get_parametro("buffer_seguridad_forecast", _BUFFER_DEFAULT, "numero")
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def _consumo_diario(db: Session, dias: int) -> dict[str, float]:
    """
    Retorna {fecha_str: kilos_consumidos} de masa para los últimos `dias` días.

    Masa consumida por pedido = SUM(detalle.cantidad × producto_insumos.cantidad)
    filtrando solo los insumos que son salida de alguna receta de cocción.
    """
    desde = date.today() - timedelta(days=dias)
    sql = text("""
        WITH masa_insumos AS (
            SELECT DISTINCT insumo_salida_id AS insumo_id
            FROM recetas_coccion
            WHERE insumo_salida_id IS NOT NULL
        )
        SELECT
            DATE(p.fecha AT TIME ZONE 'America/Bogota') AS dia,
            COALESCE(SUM(dp.cantidad * pi.cantidad), 0) AS kilos
        FROM pedidos p
        JOIN detalle_pedido dp ON dp.pedido_id = p.id
        JOIN producto_insumos pi ON pi.producto_id = dp.producto_id
        JOIN masa_insumos mi ON mi.insumo_id = pi.insumo_id
        WHERE p.estado <> 'cancelado'
          AND DATE(p.fecha AT TIME ZONE 'America/Bogota') >= :desde
        GROUP BY dia
        ORDER BY dia
    """)
    rows = db.execute(sql, {"desde": desde}).fetchall()
    return {str(r.dia): float(r.kilos) for r in rows}


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


# ─────────────────────────────────────────────────────────────
# ENDPOINT 1: Forecast de masa
# ─────────────────────────────────────────────────────────────

@router.get("/forecast-masa", dependencies=[Depends(require_internal_permission("analitica.ver"))])
def forecast_masa(db: Session = Depends(get_db)):
    """
    Retorna la recomendación de kilos de masa para mañana,
    basada en el promedio histórico del mismo día de semana que será mañana.
    """
    hoy    = date.today()
    manana = hoy + timedelta(days=1)
    dow_manana = manana.weekday()  # 0=Lun … 6=Dom

    # Historial completo de consumo diario (hasta 90 días atrás para tener suficientes muestras)
    consumo_90 = _consumo_diario(db, 90)
    consumo_30 = {k: v for k, v in consumo_90.items() if date.fromisoformat(k) >= hoy - timedelta(days=30)}
    consumo_15 = {k: v for k, v in consumo_90.items() if date.fromisoformat(k) >= hoy - timedelta(days=15)}
    consumo_7  = {k: v for k, v in consumo_90.items() if date.fromisoformat(k) >= hoy - timedelta(days=7)}

    # Análisis por día de semana (todos los registros históricos)
    por_dow: dict[int, list[float]] = defaultdict(list)
    for fecha_str, kilos in consumo_90.items():
        d = date.fromisoformat(fecha_str)
        if kilos > 0:  # excluir días sin pedidos (no confundir con día de descanso)
            por_dow[d.weekday()].append(kilos)

    dow_stats = [
        {
            "dia": DIAS_SEMANA[i],
            "promedio_kg": round(_avg(por_dow.get(i, [])), 1),
            "muestras": len(por_dow.get(i, [])),
        }
        for i in range(7)
    ]
    dia_pico = max(dow_stats, key=lambda x: x["promedio_kg"]) if dow_stats else None

    # Forecast principal: promedio histórico del mismo día de semana de mañana
    muestras_dow = por_dow.get(dow_manana, [])
    avg_dow = _avg(muestras_dow)

    # Fallback: promedio 7d general si no hay suficientes muestras del día de semana
    vals_7  = list(consumo_7.values())
    vals_15 = list(consumo_15.values())
    vals_30 = list(consumo_30.values())
    avg_7   = _avg(vals_7)
    avg_15  = _avg(vals_15)
    avg_30  = _avg(vals_30)

    usar_dow = len(muestras_dow) >= 2  # mínimo 2 muestras del mismo día para ser confiable
    base_forecast = avg_dow if usar_dow else avg_7

    # Tendencia reciente del mismo día de semana (últimas 2 vs anteriores)
    tendencia_pct = 0.0
    if len(muestras_dow) >= 4:
        recientes  = _avg(muestras_dow[-2:])
        anteriores = _avg(muestras_dow[:-2])
        tendencia_pct = ((recientes - anteriores) / anteriores * 100) if anteriores > 0 else 0.0
    elif avg_15 > 0:
        tendencia_pct = ((avg_7 - avg_15) / avg_15 * 100)

    forecast_final = round(base_forecast * _buffer_seguridad(), 1)

    # Stock de masa = SUM(insumos.cantidad_actual) para insumos-salida de cocciones.
    # Este valor es el BALANCE NETO real del insumo (cocciones suman, lotes de
    # producción descuentan vía movimientos_insumos). No hay que restarle
    # consumo histórico de pedidos — eso ya está reflejado en cantidad_actual.
    stock_sql = text("""
        SELECT i.id, i.nombre, COALESCE(i.cantidad_actual, 0) AS stock_inv
        FROM insumos i
        WHERE i.activo = true
          AND i.id IN (
              SELECT DISTINCT insumo_salida_id
              FROM recetas_coccion
              WHERE insumo_salida_id IS NOT NULL
          )
        ORDER BY stock_inv DESC
        LIMIT 10
    """)
    stock_rows = db.execute(stock_sql).fetchall()

    # kg comprometidos en pedidos PENDIENTES (aún no procesados) — útil para
    # saber cuánta masa queda libre para nuevos pedidos.
    comprometido_sql = text("""
        WITH masa_insumos AS (
            SELECT DISTINCT insumo_salida_id AS insumo_id
            FROM recetas_coccion
            WHERE insumo_salida_id IS NOT NULL
        )
        SELECT COALESCE(SUM(dp.cantidad * pi.cantidad), 0) AS kg_comprometida
        FROM pedidos p
        JOIN detalle_pedido dp ON dp.pedido_id = p.id
        JOIN producto_insumos pi ON pi.producto_id = dp.producto_id
        JOIN masa_insumos mi ON mi.insumo_id = pi.insumo_id
        WHERE p.estado = 'pendiente'
    """)
    kg_comprometida = float(db.execute(comprometido_sql).fetchone().kg_comprometida)

    stock_total_inv = sum(float(r.stock_inv) for r in stock_rows)
    masa_disponible = max(0.0, stock_total_inv - kg_comprometida)

    stock_masa = [
        {"nombre": r.nombre, "cantidad": round(float(r.stock_inv), 2), "unidad": "kg"}
        for r in stock_rows
    ]
    # Resumen: stock_inventario_kg es el TOTAL en el insumo; disponible_kg
    # descuenta lo comprometido en pedidos pendientes (no los ya despachados).
    stock_masa_resumen = {
        "stock_inventario_kg": round(stock_total_inv, 2),
        "kg_comprometida":     round(kg_comprometida, 2),
        "disponible_kg":       round(masa_disponible, 2),
    }

    # Serie diaria para gráfica (últimos 30 días, rellena días sin datos con 0)
    serie = []
    for i in range(30):
        dia = date.today() - timedelta(days=29 - i)
        serie.append({
            "fecha": str(dia),
            "dia_semana": DIAS_SEMANA[dia.weekday()][:3],
            "kilos": round(consumo_30.get(str(dia), 0.0), 1),
        })

    dia_manana_nombre = DIAS_SEMANA[dow_manana]
    return {
        "forecast": {
            "manana_kg": forecast_final,
            "dia_manana": dia_manana_nombre,
            "muestras_dow": len(muestras_dow),
            "promedio_dow": round(avg_dow, 1),
            "usar_dow": usar_dow,
            "descripcion": (
                f"Mañana es {dia_manana_nombre}. "
                + (
                    f"Basado en {len(muestras_dow)} {dia_manana_nombre}s históricos "
                    f"(promedio {round(avg_dow, 1)} kg)"
                    if usar_dow else
                    f"Sin suficientes {dia_manana_nombre}s históricos — usando promedio 7 días ({round(avg_7, 1)} kg)"
                )
                + (f", tendencia {'↑' if tendencia_pct >= 0 else '↓'} {round(abs(tendencia_pct), 1)}%" if abs(tendencia_pct) > 1 else "")
                + f" + buffer de seguridad (10%) = {forecast_final} kg"
            ),
            "tendencia_pct": round(tendencia_pct, 1),
            "tendencia_tipo": "crecimiento" if tendencia_pct > 1 else "caída" if tendencia_pct < -1 else "estable",
        },
        "promedios": {
            "avg_7d":  round(avg_7,  1),
            "avg_15d": round(avg_15, 1),
            "avg_30d": round(avg_30, 1),
        },
        "por_dia_semana": dow_stats,
        "dia_pico": dia_pico,
        "stock_masa": stock_masa,
        "stock_masa_resumen": stock_masa_resumen,
        "serie_diaria": serie,
    }


# ─────────────────────────────────────────────────────────────
# ENDPOINT 2: Ventas diarias (tendencia)
# ─────────────────────────────────────────────────────────────

@router.get("/ventas", dependencies=[Depends(require_internal_permission("analitica.ver"))])
def ventas(dias: int = 30, db: Session = Depends(get_db)):
    """
    Serie de ventas diarias (COP) y consumo de masa (kg) para los últimos `dias` días.
    """
    desde = date.today() - timedelta(days=dias)
    sql = text("""
        WITH masa_insumos AS (
            SELECT DISTINCT insumo_salida_id AS insumo_id
            FROM recetas_coccion
            WHERE insumo_salida_id IS NOT NULL
        ),
        masa_por_pedido AS (
            SELECT
                p.id AS pedido_id,
                DATE(p.fecha AT TIME ZONE 'America/Bogota') AS dia,
                p.total,
                COALESCE(SUM(dp.cantidad * pi.cantidad), 0) AS masa_kg
            FROM pedidos p
            LEFT JOIN detalle_pedido dp ON dp.pedido_id = p.id
            LEFT JOIN producto_insumos pi ON pi.producto_id = dp.producto_id
            LEFT JOIN masa_insumos mi ON mi.insumo_id = pi.insumo_id AND mi.insumo_id IS NOT NULL
            WHERE p.estado <> 'cancelado'
              AND DATE(p.fecha AT TIME ZONE 'America/Bogota') >= :desde
            GROUP BY p.id, p.fecha, p.total
        )
        SELECT
            dia,
            SUM(total)               AS ventas_cop,
            SUM(masa_kg)             AS masa_kg,
            COUNT(DISTINCT pedido_id) AS num_pedidos
        FROM masa_por_pedido
        GROUP BY dia
        ORDER BY dia
    """)
    rows = db.execute(sql, {"desde": desde}).fetchall()

    serie = {str(r.dia): {"ventas_cop": float(r.ventas_cop), "masa_kg": float(r.masa_kg), "num_pedidos": int(r.num_pedidos)}
             for r in rows}

    result = []
    for i in range(dias):
        dia = date.today() - timedelta(days=dias - 1 - i)
        d = serie.get(str(dia), {"ventas_cop": 0, "masa_kg": 0, "num_pedidos": 0})
        result.append({
            "fecha": str(dia),
            "dia_semana": DIAS_SEMANA[dia.weekday()][:3],
            **d,
            "ventas_cop": round(d["ventas_cop"], 0),
            "masa_kg": round(d["masa_kg"], 1),
        })

    total_ventas = sum(r["ventas_cop"] for r in result)
    total_pedidos = sum(r["num_pedidos"] for r in result)
    dias_activos = sum(1 for r in result if r["num_pedidos"] > 0)

    return {
        "serie": result,
        "resumen": {
            "total_ventas_cop": total_ventas,
            "total_pedidos": total_pedidos,
            "dias_activos": dias_activos,
            "promedio_diario_cop": round(total_ventas / dias_activos, 0) if dias_activos else 0,
        },
    }


# ─────────────────────────────────────────────────────────────
# ENDPOINT 3: Productos top
# ─────────────────────────────────────────────────────────────

@router.get("/productos-top", dependencies=[Depends(require_internal_permission("analitica.ver"))])
def productos_top(dias: int = 30, limit: int = 10, db: Session = Depends(get_db)):
    """
    Top productos por: unidades vendidas, kilos de masa consumidos y ventas en COP.
    """
    desde = date.today() - timedelta(days=dias)
    sql = text("""
        WITH masa_insumos AS (
            SELECT DISTINCT insumo_salida_id AS insumo_id
            FROM recetas_coccion
            WHERE insumo_salida_id IS NOT NULL
        )
        SELECT
            pr.id,
            pr.nombre,
            pr.codigo_corto,
            SUM(dp.cantidad)                                                   AS unidades,
            COALESCE(SUM(dp.cantidad * COALESCE(pi.cantidad, 0)), 0)           AS masa_kg,
            SUM(dp.subtotal)                                                   AS ventas_cop
        FROM detalle_pedido dp
        JOIN pedidos p    ON p.id = dp.pedido_id
        JOIN productos pr ON pr.id = dp.producto_id
        LEFT JOIN producto_insumos pi ON pi.producto_id = pr.id
        LEFT JOIN masa_insumos mi ON mi.insumo_id = pi.insumo_id
        WHERE p.estado <> 'cancelado'
          AND DATE(p.fecha AT TIME ZONE 'America/Bogota') >= :desde
          AND (pi.insumo_id IS NULL OR mi.insumo_id IS NOT NULL)
        GROUP BY pr.id, pr.nombre, pr.codigo_corto
        ORDER BY unidades DESC
        LIMIT :limit
    """)
    rows = db.execute(sql, {"desde": desde, "limit": limit}).fetchall()

    total_unidades = sum(float(r.unidades) for r in rows)
    return [
        {
            "nombre": r.nombre,
            "codigo": r.codigo_corto,
            "unidades": int(r.unidades),
            "masa_kg": round(float(r.masa_kg), 1),
            "ventas_cop": round(float(r.ventas_cop), 0),
            "pct_unidades": round(float(r.unidades) / total_unidades * 100, 1) if total_unidades else 0,
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────
# ENDPOINT 4: Clientes top
# ─────────────────────────────────────────────────────────────

@router.get("/clientes-top", dependencies=[Depends(require_internal_permission("analitica.ver"))])
def clientes_top(dias: int = 30, limit: int = 8, db: Session = Depends(get_db)):
    """
    Top clientes por volumen de compras (COP y pedidos) en el período.
    """
    desde = date.today() - timedelta(days=dias)
    sql = text("""
        WITH masa_insumos AS (
            SELECT DISTINCT insumo_salida_id AS insumo_id
            FROM recetas_coccion
            WHERE insumo_salida_id IS NOT NULL
        )
        SELECT
            c.nombre,
            c.tipo_cliente,
            COUNT(DISTINCT p.id)                               AS num_pedidos,
            COALESCE((SELECT SUM(total) FROM pedidos WHERE cliente_id = c.id
                      AND estado <> 'cancelado'
                      AND DATE(fecha AT TIME ZONE 'America/Bogota') >= :desde), 0) AS total_cop,
            COALESCE(SUM(dp.cantidad * pi.cantidad), 0)        AS masa_kg
        FROM pedidos p
        JOIN clientes c        ON c.id = p.cliente_id
        JOIN detalle_pedido dp ON dp.pedido_id = p.id
        JOIN producto_insumos pi ON pi.producto_id = dp.producto_id
        JOIN masa_insumos mi ON mi.insumo_id = pi.insumo_id
        WHERE p.estado <> 'cancelado'
          AND DATE(p.fecha AT TIME ZONE 'America/Bogota') >= :desde
        GROUP BY c.id, c.nombre, c.tipo_cliente
        ORDER BY total_cop DESC
        LIMIT :limit
    """)
    rows = db.execute(sql, {"desde": desde, "limit": limit}).fetchall()

    total_cop = sum(float(r.total_cop) for r in rows)
    return [
        {
            "nombre": r.nombre,
            "tipo": r.tipo_cliente or "—",
            "num_pedidos": int(r.num_pedidos),
            "total_cop": round(float(r.total_cop), 0),
            "masa_kg": round(float(r.masa_kg), 1),
            "pct_ventas": round(float(r.total_cop) / total_cop * 100, 1) if total_cop else 0,
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────
# ENDPOINT 5: Rentabilidad estimada
# ─────────────────────────────────────────────────────────────

@router.get("/rentabilidad", dependencies=[Depends(require_internal_permission("analitica.ver"))])
def rentabilidad(dias: int = 30, db: Session = Depends(get_db)):
    """
    Ventas vs costos vs gastos. Devuelve dos vistas de margen neto:

      • margen_contable_cop = ventas − costo_productos − gastos_indirectos
        Asume que los gastos 'directo' son compras de insumos ya reflejadas
        en productos.costo (evita doble conteo). Es la vista útil para
        analizar rentabilidad.

      • margen_caja_cop = ventas − costo_productos − gastos_totales
        Mide flujo de caja: ingresos menos TODO lo desembolsado. Útil para
        ver si se queman recursos comprando stock acumulable.
    """
    desde = date.today() - timedelta(days=dias)

    # Ventas: SUM directo sobre pedidos (sin JOIN — evita inflar/colapsar)
    ventas = float(db.execute(text("""
        SELECT COALESCE(SUM(total), 0)
        FROM pedidos
        WHERE estado <> 'cancelado'
          AND DATE(fecha AT TIME ZONE 'America/Bogota') >= :desde
    """), {"desde": desde}).scalar())

    # Costo de productos vendidos: SUM(dp.cantidad × productos.costo)
    costo_prod = float(db.execute(text("""
        SELECT COALESCE(SUM(dp.cantidad * COALESCE(pr.costo, 0)), 0)
        FROM detalle_pedido dp
        JOIN pedidos p     ON p.id = dp.pedido_id
        JOIN productos pr  ON pr.id = dp.producto_id
        WHERE p.estado <> 'cancelado'
          AND DATE(p.fecha AT TIME ZONE 'America/Bogota') >= :desde
    """), {"desde": desde}).scalar())

    # Gastos desglosados por tipo_costo
    gastos_rows = db.execute(text("""
        SELECT COALESCE(tipo_costo, 'sin_clasificar') AS tipo,
               COALESCE(SUM(valor), 0) AS total
        FROM gastos
        WHERE estado = 'activo' AND fecha >= :desde
        GROUP BY COALESCE(tipo_costo, 'sin_clasificar')
    """), {"desde": desde}).fetchall()

    gastos_por_tipo  = {r.tipo: float(r.total) for r in gastos_rows}
    gastos_directos  = gastos_por_tipo.get("directo", 0)
    gastos_indirectos = sum(v for k, v in gastos_por_tipo.items() if k != "directo")
    gastos_totales   = gastos_directos + gastos_indirectos

    # Cálculos
    margen_bruto    = ventas - costo_prod
    margen_contable = margen_bruto - gastos_indirectos   # sin doble conteo
    margen_caja     = margen_bruto - gastos_totales      # flujo de caja

    def pct(v):
        return round(v / ventas * 100, 1) if ventas else 0

    return {
        "ventas_cop":               round(ventas, 0),
        "costo_produccion_cop":     round(costo_prod, 0),
        "gastos_directos_cop":      round(gastos_directos, 0),
        "gastos_indirectos_cop":    round(gastos_indirectos, 0),
        "gastos_operacionales_cop": round(gastos_totales, 0),  # compat: suma directos + indirectos
        "margen_bruto_cop":         round(margen_bruto, 0),
        "margen_bruto_pct":         pct(margen_bruto),
        "margen_contable_cop":      round(margen_contable, 0),
        "margen_contable_pct":      pct(margen_contable),
        "margen_caja_cop":          round(margen_caja, 0),
        "margen_caja_pct":          pct(margen_caja),
        # Compat con frontend viejo: estos apuntan a la vista contable
        "margen_neto_estimado_cop": round(margen_contable, 0),
        "margen_neto_pct":          pct(margen_contable),
    }

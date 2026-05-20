"""
Portal Cliente — ArepasERP
Endpoints exclusivos para usuarios con rol Cliente.

Reglas de seguridad:
  - Solo accede un usuario con cliente_id asignado y permiso portal.ver_pedidos
  - TODOS los filtros usan user.cliente_id — nunca se acepta cliente_id del request
  - El cliente solo ve sus propios datos
"""
import logging
from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from utils import resolver_precio_cliente
from sqlalchemy import text

from database import get_db
from sql_models import Usuario, Pedido, DetallePedido, Producto, Cliente, MedioPago, PagoRecibido, PagoPedido
from auth import require_permission, is_cliente_role
from utils import get_now_colombia

router = APIRouter(tags=["Portal Cliente"])
logger = logging.getLogger(__name__)


def _get_cliente_user(user: Usuario = Depends(require_permission("portal.ver_pedidos"))) -> Usuario:
    """Verifica que el usuario tenga un cliente_id vinculado."""
    if not user.cliente_id:
        raise HTTPException(
            status_code=403,
            detail="Tu cuenta no está vinculada a ningún cliente. Contacta al administrador."
        )
    return user


# ── Info del cliente autenticado ─────────────────────────────

@router.get("/mi-perfil")
def mi_perfil(
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    cliente = db.query(Cliente).filter(Cliente.id == user.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return {
        "id":               cliente.id,
        "nombre":           cliente.nombre,
        "condicion_pago":   cliente.condicion_pago,
        "cupo_credito":     float(cliente.cupo_credito or 0),
    }


def _build_ultimo_pedido(row, db):
    if not row:
        return None
    pid = row[0]
    items_rows = db.execute(text("""
        SELECT pr.nombre, dp.cantidad, dp.precio, dp.subtotal
        FROM detalle_pedido dp
        JOIN productos pr ON pr.id = dp.producto_id
        WHERE dp.pedido_id = :pid
    """), {"pid": pid}).fetchall()
    return {
        "id":     pid,
        "fecha":  row[1].isoformat() if row[1] else None,
        "estado": row[2],
        "total":  float(row[3] or 0),
        "pagado": float(row[4] or 0),
        "saldo":  float(row[5] or 0),
        "items":  [{"nombre": r[0], "cantidad": r[1], "precio": float(r[2]), "subtotal": float(r[3])} for r in items_rows],
    }


# ── Resumen / Dashboard del cliente ──────────────────────────

@router.get("/resumen")
def resumen(
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """Totales rápidos: pedidos activos, saldo pendiente, último pago."""
    cid = user.cliente_id

    totales = db.execute(text("""
        SELECT
            COUNT(*)                                                     AS total_pedidos,
            COALESCE(SUM(p.total), 0)                                    AS valor_total,
            COALESCE(SUM(COALESCE(pp_sum.pagado, 0)), 0)                 AS total_pagado,
            COALESCE(SUM(p.total - COALESCE(pp_sum.pagado, 0)), 0)       AS saldo_pendiente
        FROM pedidos p
        LEFT JOIN (
            SELECT pedido_id, SUM(monto) AS pagado
            FROM pagos_pedidos GROUP BY pedido_id
        ) pp_sum ON pp_sum.pedido_id = p.id
        WHERE p.cliente_id = :cid
          AND p.estado NOT IN ('cancelado')
    """), {"cid": cid}).fetchone()

    ultimo_pago = db.execute(text("""
        SELECT pr.monto, pr.fecha, mp.nombre AS medio
        FROM pagos pr
        LEFT JOIN medios_pago mp ON mp.id = pr.medio_pago_id
        WHERE pr.cliente_id = :cid
        ORDER BY pr.fecha DESC LIMIT 1
    """), {"cid": cid}).fetchone()

    ultimo_pedido = db.execute(text("""
        SELECT p.id, p.fecha, p.estado, p.total,
               COALESCE(pp_sum.pagado, 0)           AS pagado,
               p.total - COALESCE(pp_sum.pagado, 0) AS saldo
        FROM pedidos p
        LEFT JOIN (
            SELECT pedido_id, SUM(monto) AS pagado
            FROM pagos_pedidos GROUP BY pedido_id
        ) pp_sum ON pp_sum.pedido_id = p.id
        WHERE p.cliente_id = :cid
        ORDER BY p.fecha DESC, p.id DESC LIMIT 1
    """), {"cid": cid}).fetchone()

    cliente = db.execute(text("SELECT tarifa_domicilio FROM clientes WHERE id = :cid"), {"cid": cid}).fetchone()

    return {
        "total_pedidos":   int(totales[0] or 0),
        "valor_total":     float(totales[1] or 0),
        "total_pagado":    float(totales[2] or 0),
        "saldo_pendiente": float(totales[3] or 0),
        "tarifa_domicilio": float(cliente[0] or 0) if cliente else 0,
        "ultimo_pago": {
            "monto": float(ultimo_pago[0]) if ultimo_pago else None,
            "fecha": ultimo_pago[1].isoformat() if ultimo_pago and ultimo_pago[1] else None,
            "medio": ultimo_pago[2] if ultimo_pago else None,
        } if ultimo_pago else None,
        "ultimo_pedido": _build_ultimo_pedido(ultimo_pedido, db),
    }


# ── Mis pedidos ───────────────────────────────────────────────

@router.get("/mis-pedidos")
def mis_pedidos(
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """Lista completa de pedidos del cliente — todos los estados."""
    cid = user.cliente_id

    rows = db.execute(text("""
        SELECT
            p.id,
            p.fecha,
            p.estado,
            p.total,
            COALESCE(pp_sum.pagado, 0)                   AS monto_pagado,
            p.total - COALESCE(pp_sum.pagado, 0)         AS saldo,
            p.valor_domicilio,
            p.observaciones
        FROM pedidos p
        LEFT JOIN (
            SELECT pedido_id, SUM(monto) AS pagado
            FROM pagos_pedidos GROUP BY pedido_id
        ) pp_sum ON pp_sum.pedido_id = p.id
        WHERE p.cliente_id = :cid
        ORDER BY p.fecha DESC
        LIMIT 100
    """), {"cid": cid}).fetchall()

    # Cargar items de cada pedido en una sola query
    if not rows:
        return []

    pedido_ids = [r[0] for r in rows]
    items_raw = db.execute(text("""
        SELECT dp.pedido_id, pr.nombre, dp.cantidad, dp.precio, dp.subtotal
        FROM detalle_pedido dp
        JOIN productos pr ON pr.id = dp.producto_id
        WHERE dp.pedido_id = ANY(:ids)
    """), {"ids": pedido_ids}).fetchall()

    items_map: dict = {}
    for i in items_raw:
        items_map.setdefault(i[0], []).append({
            "nombre":   i[1],
            "cantidad": i[2],
            "precio":   float(i[3]),
            "subtotal": float(i[4]),
        })

    return [
        {
            "id":             r[0],
            "fecha":          r[1].isoformat() if r[1] else None,
            "estado":         r[2],
            "total":          float(r[3] or 0),
            "monto_pagado":   float(r[4] or 0),
            "saldo":          float(r[5] or 0),
            "valor_domicilio":float(r[6] or 0),
            "observaciones":  r[7],
            "items":          items_map.get(r[0], []),
        }
        for r in rows
    ]


# ── Productos disponibles para pedir ─────────────────────────

@router.get("/productos")
def productos_disponibles(
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """Lista de productos activos. Aplica precio especial del cliente si existe."""
    cid = user.cliente_id
    rows = db.execute(text("""
        SELECT p.id, p.nombre, p.precio,
               pe.precio_especial
        FROM productos p
        LEFT JOIN precios_especiales pe
               ON pe.producto_id = p.id
              AND pe.cliente_id  = :cid
              AND pe.activo      = TRUE
        WHERE p.activo = TRUE
        ORDER BY p.nombre
    """), {"cid": cid}).fetchall()
    return [
        {
            "id":             r[0],
            "nombre":         r[1],
            "precio":         float(r[3] if r[3] is not None else r[2] or 0),
            "precio_base":    float(r[2] or 0),
            "tiene_especial": r[3] is not None,
            "unidad":         "unidad",
        }
        for r in rows
    ]


# ── Crear pedido desde el portal ─────────────────────────────

class ItemPedidoPortal(BaseModel):
    producto_id: int
    cantidad:    float = Field(..., gt=0)

class NuevoPedidoPortal(BaseModel):
    fecha:          str             # YYYY-MM-DD
    items:          List[ItemPedidoPortal] = Field(..., min_length=1)
    observaciones:  Optional[str] = None
    valor_domicilio: Optional[float] = 0


@router.post("/nuevo-pedido", status_code=201)
def nuevo_pedido(
    body: NuevoPedidoPortal,
    user: Usuario = Depends(_get_cliente_user),
    db: Session = Depends(get_db),
):
    """Crea un pedido usando el cliente_id del usuario autenticado."""
    cid = user.cliente_id

    # Validar fecha
    try:
        fecha_dt = datetime.fromisoformat(body.fecha) if 'T' in body.fecha else datetime.combine(date.fromisoformat(body.fecha), datetime.min.time())
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha inválida. Use YYYY-MM-DD")

    # Calcular total
    total = 0.0
    lineas = []
    for item in body.items:
        prod = db.query(Producto).filter(Producto.id == item.producto_id, Producto.activo == True).first()
        if not prod:
            raise HTTPException(status_code=400, detail=f"Producto {item.producto_id} no disponible")
        precio, _ = resolver_precio_cliente(cid, prod.id, prod.precio, db)
        subtotal = round(precio * item.cantidad, 2)
        total   += subtotal
        lineas.append((prod.id, precio, item.cantidad, subtotal))

    total += float(body.valor_domicilio or 0)

    pedido = Pedido(
        cliente_id      = cid,
        fecha           = fecha_dt,
        estado          = "pendiente",
        total           = total,
        valor_domicilio = body.valor_domicilio or 0,
        observaciones   = body.observaciones,
    )
    db.add(pedido)
    db.flush()

    for prod_id, precio, cantidad, subtotal in lineas:
        db.add(DetallePedido(
            pedido_id       = pedido.id,
            producto_id     = prod_id,
            precio_aplicado = precio,
            cantidad        = cantidad,
            subtotal        = subtotal,
        ))

    db.commit()
    logger.info("Portal: cliente_id=%s creó pedido id=%s", cid, pedido.id)
    return {"id": pedido.id, "total": total, "estado": "pendiente"}


# ── Mis cuentas por cobrar ────────────────────────────────────

@router.get("/mi-saldo")
def mi_saldo(
    user: Usuario = Depends(require_permission("portal.ver_saldo")),
    db: Session = Depends(get_db),
):
    if not user.cliente_id:
        raise HTTPException(status_code=403, detail="Cuenta no vinculada a cliente")
    cid = user.cliente_id

    pendientes = db.execute(text("""
        SELECT
            p.id,
            p.fecha,
            p.total,
            COALESCE(pp_sum.pagado, 0)             AS pagado,
            p.total - COALESCE(pp_sum.pagado, 0)   AS saldo,
            p.estado
        FROM pedidos p
        LEFT JOIN (
            SELECT pedido_id, SUM(monto) AS pagado
            FROM pagos_pedidos GROUP BY pedido_id
        ) pp_sum ON pp_sum.pedido_id = p.id
        WHERE p.cliente_id = :cid
          AND p.estado = 'por_cobrar'
          AND (p.total - COALESCE(pp_sum.pagado, 0)) > 0
        ORDER BY p.fecha ASC
    """), {"cid": cid}).fetchall()

    historial = db.execute(text("""
        SELECT pr.id, pr.monto, pr.fecha, mp.nombre AS medio
        FROM pagos pr
        LEFT JOIN medios_pago mp ON mp.id = pr.medio_pago_id
        WHERE pr.cliente_id = :cid
        ORDER BY pr.fecha DESC
        LIMIT 20
    """), {"cid": cid}).fetchall()

    return {
        "pendientes": [
            {
                "pedido_id": r[0],
                "fecha":     r[1].isoformat() if r[1] else None,
                "total":     float(r[2] or 0),
                "pagado":    float(r[3] or 0),
                "saldo":     float(r[4] or 0),
                "estado":    r[5],
            }
            for r in pendientes
        ],
        "historial_pagos": [
            {
                "id":    h[0],
                "monto": float(h[1] or 0),
                "fecha": h[2].isoformat() if h[2] else None,
                "medio": h[3] or "-",
            }
            for h in historial
        ],
    }

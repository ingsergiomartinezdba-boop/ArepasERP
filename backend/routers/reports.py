import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func
from typing import Optional
from datetime import datetime
from database import get_db
from sql_models import Pedido, Gasto, Cliente, DetallePedido, Producto, Proveedor
from utils import get_now_colombia
from auth import require_internal_permission

router = APIRouter()
logger = logging.getLogger(__name__)


def _saldo_pedido_subquery(db: Session, pedido_id_col):
    """Calcula saldo de pedidos usando pagos_pedidos real."""
    from sqlalchemy import table, column as sa_col
    pp = table("pagos_pedidos", sa_col("pedido_id"), sa_col("monto"))
    pagado = db.query(
        func.coalesce(func.sum(pp.c.monto), 0)
    ).filter(pp.c.pedido_id == pedido_id_col).scalar_subquery()
    return pagado


@router.get("/dashboard", dependencies=[Depends(require_internal_permission("reportes.ver"))])
def get_dashboard_stats(db: Session = Depends(get_db)):
    today = get_now_colombia().date()
    month_start = today.replace(day=1)

    if today.month == 12:
        next_month = today.replace(year=today.year + 1, month=1, day=1)
    else:
        next_month = today.replace(month=today.month + 1, day=1)

    # Ventas del mes (excluye cancelados)
    ventas_mes = db.query(func.sum(Pedido.total)).filter(
        Pedido.fecha >= month_start,
        Pedido.fecha < next_month,
        Pedido.estado != 'cancelado'
    ).scalar() or 0

    # Gastos del mes
    gastos_mes = db.query(func.sum(Gasto.valor)).filter(
        Gasto.fecha >= month_start,
        Gasto.fecha < next_month
    ).scalar() or 0

    # Ventas de hoy (excluye cancelados)
    ventas_hoy = db.query(func.sum(Pedido.total)).filter(
        func.date(Pedido.fecha) == today,
        Pedido.estado != 'cancelado'
    ).scalar() or 0

    # Gastos de hoy
    gastos_hoy = db.query(func.sum(Gasto.valor)).filter(
        Gasto.fecha == today
    ).scalar() or 0

    # Deudores: pedidos pendientes con saldo calculado desde pagos_pedidos
    try:
        deudores_rows = db.execute(text("""
            SELECT
                p.id,
                p.cliente_id,
                c.nombre,
                p.total - COALESCE(SUM(pp.monto), 0) AS saldo,
                p.fecha
            FROM pedidos p
            JOIN clientes c ON c.id = p.cliente_id
            LEFT JOIN pagos_pedidos pp ON pp.pedido_id = p.id
            WHERE p.estado = 'por_cobrar'
            GROUP BY p.id, p.cliente_id, c.nombre, p.total, p.fecha
            HAVING p.total - COALESCE(SUM(pp.monto), 0) > 0
            ORDER BY p.fecha DESC
        """)).fetchall()

        deudores_data = [
            {
                "id": r[0],
                "cliente_id": r[1],
                "nombre": r[2],
                "saldo": float(r[3]) if r[3] else 0,
                "fecha": r[4].isoformat() if r[4] else None,
            }
            for r in deudores_rows
        ]
    except Exception as e:
        logger.error("Error calculando deudores: %s", e)
        deudores_data = []

    # Flujo de caja — saldo por medio de pago
    # Ingresos: pagos recibidos + transferencias entrantes + ingresos_manuales
    # Egresos:  gastos + transferencias salientes
    try:
        rows = db.execute(text(
            "SELECT id, nombre, tipo, ingresos, egresos, saldo "
            "FROM view_saldos_medios_pago"
        )).fetchall()

        flujo_caja = [
            {
                "id":       row[0],
                "medio":    row[1],
                "tipo":     row[2],
                "ingresos": float(row[3]),
                "egresos":  float(row[4]),
                "saldo":    float(row[5]),
            }
            for row in rows
        ]
    except Exception as e:
        logger.error("Error calculando flujo de caja: %s", e)
        flujo_caja = []

    return {
        "ventas_mes":       float(ventas_mes),
        "gastos_mes":       float(gastos_mes),
        "ventas_hoy":       float(ventas_hoy),
        "gastos_hoy":       float(gastos_hoy),
        "clientes_deudores": deudores_data,
        "flujo_caja":       flujo_caja,
    }


@router.get("/whatsapp-summary", dependencies=[Depends(require_internal_permission("reportes.ver"))])
def get_whatsapp_summary(date_str: Optional[str] = None, db: Session = Depends(get_db)):
    if not date_str:
        target_date = get_now_colombia().date()
    else:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()

    orders = db.query(Pedido).options(
        joinedload(Pedido.cliente),
        joinedload(Pedido.detalle).joinedload(DetallePedido.producto)
    ).filter(
        func.date(Pedido.fecha) == target_date,
        Pedido.estado == 'pendiente'
    ).all()

    if not orders:
        return {"text": f"*PEDIDOS {target_date}*\n\nNo hay pedidos pendientes para esta fecha."}

    client_ids = list({o.cliente_id for o in orders})

    # Deuda por cliente usando pagos_pedidos real
    debt_rows = db.execute(text("""
        SELECT p.cliente_id,
               SUM(p.total) - COALESCE(SUM(pp.monto), 0) AS saldo
        FROM pedidos p
        LEFT JOIN pagos_pedidos pp ON pp.pedido_id = p.id
        WHERE p.cliente_id = ANY(:ids) AND p.estado = 'pendiente'
        GROUP BY p.cliente_id
    """), {"ids": client_ids}).fetchall()
    debt_map = {r[0]: float(r[1] or 0) for r in debt_rows}

    client_data = {}
    for order in orders:
        if not order.cliente:
            continue
        cid = order.cliente_id
        if cid not in client_data:
            client_data[cid] = {
                "name": order.cliente.nombre,
                "items": [],
                "total_debt": debt_map.get(cid, 0),
                "show_balance": getattr(order.cliente, 'mostrar_saldo_whatsapp', True),
            }
        for detalle in order.detalle:
            if detalle.producto:
                code = getattr(detalle.producto, 'codigo_corto', None) or detalle.producto.nombre[:6]
                client_data[cid]['items'].append(f"{detalle.cantidad} {code}")

    sorted_clients = sorted(client_data.values(), key=lambda x: x['name'])
    summary_text = f"*PEDIDOS {target_date}*\n\n"

    for client in sorted_clients:
        if client['show_balance']:
            summary_text += f"*{client['name']}* ${client['total_debt']:,.0f}\n"
        else:
            summary_text += f"*{client['name']}*\n"
        for item_str in client['items']:
            summary_text += f"{item_str}\n"
        summary_text += "\n"

    return {"text": summary_text.strip()}


@router.get("/client-report", dependencies=[Depends(require_internal_permission("reportes.ver"))])
def get_client_report(client_id: int, start_date: str, end_date: str, db: Session = Depends(get_db)):
    s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    e_date = datetime.strptime(end_date, "%Y-%m-%d").date()

    cliente = db.query(Cliente).filter(Cliente.id == client_id).first()
    if not cliente:
        return {"error": "Cliente no encontrado"}

    orders = db.query(Pedido).options(
        joinedload(Pedido.detalle).joinedload(DetallePedido.producto)
    ).filter(
        Pedido.cliente_id == client_id,
        func.date(Pedido.fecha).between(s_date, e_date),
        Pedido.estado != 'cancelado'
    ).order_by(Pedido.fecha.asc(), Pedido.id.asc()).all()

    period_orders = []
    period_total = 0

    for order in orders:
        items = [
            f"{d.cantidad} x {d.producto.nombre if d.producto else 'Producto'}"
            for d in order.detalle
        ]
        period_total += float(order.total)
        period_orders.append({
            "id":     order.id,
            "fecha":  order.fecha.isoformat(),
            "total":  float(order.total),
            "estado": order.estado,
            "items":  items,
        })

    # Deuda pendiente real usando pagos_pedidos
    debt_row = db.execute(text("""
        SELECT COALESCE(SUM(p.total) - SUM(COALESCE(pp_sum.pagado, 0)), 0)
        FROM pedidos p
        LEFT JOIN (
            SELECT pedido_id, SUM(monto) AS pagado
            FROM pagos_pedidos
            GROUP BY pedido_id
        ) pp_sum ON pp_sum.pedido_id = p.id
        WHERE p.cliente_id = :cid
          AND p.estado = 'por_cobrar'
    """), {"cid": client_id}).scalar() or 0

    return {
        "client_name":       cliente.nombre,
        "start_date":        start_date,
        "end_date":          end_date,
        "period_total":      float(period_total),
        "total_pending_debt": float(debt_row),
        "orders":            period_orders,
    }


@router.get("/vendor-report", dependencies=[Depends(require_internal_permission("reportes.ver"))])
def get_vendor_report(vendor_id: int, start_date: str, end_date: str, db: Session = Depends(get_db)):
    try:
        s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        return {"error": "Formato de fecha inválido. Usar YYYY-MM-DD"}

    proveedor = db.query(Proveedor).filter(Proveedor.id == vendor_id).first()
    if not proveedor:
        return {"error": "Proveedor no encontrado"}

    gastos = db.query(Gasto).filter(
        Gasto.proveedor_id == vendor_id,
        Gasto.fecha.between(s_date, e_date)
    ).order_by(Gasto.fecha.asc(), Gasto.id.asc()).all()

    period_total = 0
    period_expenses = []

    for gasto in gastos:
        valor = float(gasto.valor) if gasto.valor else 0
        period_total += valor
        period_expenses.append({
            "id":    gasto.id,
            "fecha": gasto.fecha.isoformat() if gasto.fecha else None,
            "valor": valor,
        })

    return {
        "vendor_name":       proveedor.nombre,
        "start_date":        start_date,
        "end_date":          end_date,
        "period_total":      float(period_total),
        "expenses":          period_expenses,
        "total_pending_debt": 0,
    }

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import Optional
from datetime import datetime
from ..database import get_db
from ..sql_models import Pedido, Gasto, Cliente, DetallePedido, Producto, Proveedor
from ..utils import get_now_colombia

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    today = get_now_colombia().date()
    month_start = today.replace(day=1)
    
    # Calculate next month for upper bound
    if today.month == 12:
        next_month = today.replace(year=today.year + 1, month=1, day=1)
    else:
        next_month = today.replace(month=today.month + 1, day=1)
    
    # Monthly Sales (excluding cancelled)
    ventas_mes = db.query(func.sum(Pedido.total)).filter(
        Pedido.fecha >= month_start,
        Pedido.fecha < next_month,
        Pedido.estado != 'cancelado'
    ).scalar() or 0
    
    # Monthly Expenses
    gastos_mes = db.query(func.sum(Gasto.valor)).filter(
        Gasto.fecha >= month_start,
        Gasto.fecha < next_month
    ).scalar() or 0
    
    # Daily Sales
    ventas_hoy = db.query(func.sum(Pedido.total)).filter(
        func.date(Pedido.fecha) == today,
        Pedido.estado != 'cancelado'
    ).scalar() or 0
    
    # Daily Expenses
    gastos_hoy = db.query(func.sum(Gasto.valor)).filter(
        Gasto.fecha == today
    ).scalar() or 0
    
    # Detail of all pending orders to allow frontend to group and calculate age
    deudores_query = db.query(
        Pedido.id,
        Cliente.id.label('cliente_id'),
        Cliente.nombre,
        (Pedido.total - Pedido.monto_pagado).label('saldo'),
        Pedido.fecha,
        Pedido.created_at
    ).join(Cliente).filter(
        Pedido.estado.in_(['pendiente', 'parcial'])
    ).all()
    
    deudores_data = [
        {
            "id": d[0],
            "cliente_id": d[1],
            "nombre": d[2],
            "saldo": float(d[3]) if d[3] else 0,
            "fecha": (d[4] or d[5]).isoformat() if (d[4] or d[5]) else None
        }
        for d in deudores_query
    ]
    
    # Cash Flow from view
    try:
        result = db.execute(text("SELECT * FROM view_saldos_medios_pago")).fetchall()
        flujo_caja = [
            {
                "medio": row[1],
                "ingresos": float(row[3]) if row[3] else 0,
                "egresos": float(row[4]) if row[4] else 0,
                "saldo": float(row[5]) if row[5] else 0
            }
            for row in result
        ]
    except Exception as e:
        print(f"Error fetching cash flow: {e}")
        flujo_caja = []
    
    return {
        "ventas_mes": float(ventas_mes),
        "gastos_mes": float(gastos_mes),
        "ventas_hoy": float(ventas_hoy),
        "gastos_hoy": float(gastos_hoy),
        "clientes_deudores": deudores_data,
        "flujo_caja": flujo_caja
    }

@router.get("/whatsapp-summary")
def get_whatsapp_summary(date_str: Optional[str] = None, db: Session = Depends(get_db)):
    """Generate WhatsApp summary for daily orders"""
    if not date_str:
        target_date = get_now_colombia().date()
    else:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    
    # Get pending orders for the target date
    orders = db.query(Pedido).filter(
        func.date(Pedido.fecha) == target_date,
        Pedido.estado == 'pendiente'
    ).all()
    
    if not orders:
        return {"text": f"*PEDIDOS {target_date}*\n\nNo hay pedidos pendientes para esta fecha."}
    
    # Group by client
    client_data = {}
    client_ids = set()
    
    for order in orders:
        cid = order.cliente_id
        client_ids.add(cid)
        
        # Get client info
        cliente = db.query(Cliente).filter(Cliente.id == cid).first()
        if not cliente:
            continue
            
        if cid not in client_data:
            client_data[cid] = {
                "name": cliente.nombre,
                "items": [],
                "total_debt": 0,
                "show_balance": cliente.mostrar_saldo_whatsapp
            }
        
        # Get order details
        detalles = db.query(DetallePedido).filter(DetallePedido.pedido_id == order.id).all()
        for detalle in detalles:
            producto = db.query(Producto).filter(Producto.id == detalle.producto_id).first()
            if producto:
                code = producto.codigo_corto or "?"
                client_data[cid]['items'].append(f"{detalle.cantidad} {code}")
    
    # Calculate total pending debt for these clients
    for cid in client_ids:
        total_debt = db.query(func.sum(Pedido.total - Pedido.monto_pagado)).filter(
            Pedido.cliente_id == cid,
            Pedido.estado == 'pendiente'
        ).scalar() or 0
        
        if cid in client_data:
            client_data[cid]['total_debt'] = float(total_debt)
    
    # Build WhatsApp text
    sorted_clients = sorted(client_data.values(), key=lambda x: x['name'])
    
    summary_text = f"*PEDIDOS {target_date}*\n\n"
    
    for client in sorted_clients:
        name = client['name']
        debt = client['total_debt']
        items = client['items']
        show_balance = client['show_balance']
        
        if show_balance:
            summary_text += f"*{name}* ${debt:,.0f}\n"
        else:
            summary_text += f"*{name}*\n"
        
        for item_str in items:
            summary_text += f"{item_str}\n"
        
        summary_text += "\n"
    
    return {"text": summary_text.strip()}

@router.get("/client-report")
def get_client_report(client_id: int, start_date: str, end_date: str, db: Session = Depends(get_db)):
    s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    cliente = db.query(Cliente).filter(Cliente.id == client_id).first()
    if not cliente:
        return {"error": "Cliente no encontrado"}

    orders = db.query(Pedido).filter(
        Pedido.cliente_id == client_id,
        func.date(Pedido.fecha).between(s_date, e_date),
        Pedido.estado != 'cancelado'
    ).order_by(Pedido.fecha.asc()).all()

    period_orders = []
    period_total = 0

    for order in orders:
        detalles = db.query(DetallePedido).filter(DetallePedido.pedido_id == order.id).all()
        items = []
        for d in detalles:
            prod = db.query(Producto).filter(Producto.id == d.producto_id).first()
            prod_name = prod.nombre if prod else "Producto"
            items.append(f"{d.cantidad} x {prod_name}")
        
        period_total += float(order.total)
        period_orders.append({
            "id": order.id,
            "fecha": order.fecha.isoformat(),
            "total": float(order.total),
            "estado": order.estado,
            "items": items
        })

    pending_debt = db.query(func.sum(Pedido.total - Pedido.monto_pagado)).filter(
        Pedido.cliente_id == client_id,
        Pedido.estado.in_(['pendiente', 'parcial'])
    ).scalar() or 0

    return {
        "client_name": cliente.nombre,
        "start_date": start_date,
        "end_date": end_date,
        "period_total": float(period_total),
        "total_pending_debt": float(pending_debt),
        "orders": period_orders
    }

@router.get("/vendor-report")
def get_vendor_report(vendor_id: int, start_date: str, end_date: str, db: Session = Depends(get_db)):
    """Generate report for specific vendor"""
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
    ).order_by(Gasto.fecha.asc()).all()

    period_expenses = []
    period_total = 0

    for gasto in gastos:
        valor = float(gasto.valor) if gasto.valor else 0
        period_total += valor
        
        descripcion = gasto.concepto
        if gasto.categoria:
            descripcion += f" ({gasto.categoria})"
            
        period_expenses.append({
            "id": gasto.id,
            "fecha": gasto.fecha.isoformat() if gasto.fecha else None,
            "concepto": descripcion,
            "valor": valor,
            "observaciones": gasto.observaciones
        })
    
    return {
        "vendor_name": proveedor.nombre,
        "start_date": start_date,
        "end_date": end_date,
        "period_total": float(period_total),
        "expenses": period_expenses,
        "total_pending_debt": 0
    }

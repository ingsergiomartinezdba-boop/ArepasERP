from fastapi import APIRouter
from fastapi import APIRouter
from ..database import supabase
from typing import Dict, Any, Optional
from datetime import datetime

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_stats():
    today = datetime.now().date()
    month_start = today.replace(day=1)
    
    # Next month calculation for upper bound
    if today.month == 12:
        next_month = today.replace(year=today.year + 1, month=1, day=1)
    else:
        next_month = today.replace(month=today.month + 1, day=1)
        
    start_str = month_start.isoformat()
    end_str = next_month.isoformat()
    today_str = today.isoformat()

    # 1. KPIs Queries
    
    # Monthly Sales
    ventas_mes_res = supabase.table("pedidos").select("total") \
        .gte("fecha", start_str).lt("fecha", end_str).neq("estado", "cancelado").execute()
    total_ventas_mes = sum(item['total'] for item in ventas_mes_res.data)

    # Monthly Expenses
    gastos_mes_res = supabase.table("gastos").select("valor") \
        .gte("fecha", start_str).lt("fecha", end_str).execute()
    total_gastos_mes = sum(item['valor'] for item in gastos_mes_res.data)

    # Daily Sales
    ventas_hoy_res = supabase.table("pedidos").select("total") \
        .gte("fecha", f"{today_str}T00:00:00").lte("fecha", f"{today_str}T23:59:59").neq("estado", "cancelado").execute()
    total_ventas_hoy = sum(item['total'] for item in ventas_hoy_res.data)

    # Daily Expenses
    gastos_hoy_res = supabase.table("gastos").select("valor") \
        .eq("fecha", today_str).execute()
    total_gastos_hoy = sum(item['valor'] for item in gastos_hoy_res.data)

    # Debtors
    # Fallback to direct query if view doesn't exist or fails
    # deudores = supabase.table("view_clientes_deudores").select("*").execute()
    # Using direct query for reliability:
    deudores_res = supabase.table("cuentas_cobrar").select("*, clientes(nombre)") \
        .neq("estado", "pagado").order("fecha_vencimiento").execute()
    
    deudores_data = []
    for d in deudores_res.data:
        deudores_data.append({
            "cuenta_cobrar_id": d['id'],
            "cliente_id": d['cliente_id'],
            "nombre": d['clientes']['nombre'] if d['clientes'] else "Unknown",
            "saldo": d['saldo'],
            "fecha_vencimiento": d['fecha_vencimiento']
        })


    # 6. Cash Flow by Payment Method (Flujo de Caja)
    # Fetch Data
    medios_res = supabase.table("medios_pago").select("id, nombre").eq("activo", True).execute()
    
    # Inflow (Sales - only Paid)
    ingresos_res = supabase.table("pedidos").select("medio_pago_id, total") \
        .eq("estado", "pagado").execute()
        
    # Outflow (Expenses)
    egresos_res = supabase.table("gastos").select("medio_pago_id, valor").execute()
    
    # Process
    flujo_caja = []
    medios_map = {m['id']: {'nombre': m['nombre'], 'ingresos': 0, 'egresos': 0} for m in medios_res.data}
    
    for i in ingresos_res.data:
        mid = i['medio_pago_id']
        if mid in medios_map:
            medios_map[mid]['ingresos'] += i['total']
            
    for e in egresos_res.data:
        mid = e['medio_pago_id']
        if mid in medios_map:
            medios_map[mid]['egresos'] += e['valor']
            
    for mid, data in medios_map.items():
        flujo_caja.append({
            "medio": data['nombre'],
            "ingresos": data['ingresos'],
            "egresos": data['egresos'],
            "saldo": data['ingresos'] - data['egresos']
        })

    return {
        "ventas_mes": total_ventas_mes,
        "gastos_mes": total_gastos_mes,
        "ventas_hoy": total_ventas_hoy,
        "gastos_hoy": total_gastos_hoy,
        "clientes_deudores": deudores_data,
        "flujo_caja": flujo_caja
    }

@router.get("/whatsapp-summary")
def get_whatsapp_summary(date_str: Optional[str] = None):
    # Default to today if no date provided
    if not date_str:
        target_date = datetime.now().strftime("%Y-%m-%d")
    else:
        target_date = date_str

    # Fetch orders for the date
    # We join with clients and order details -> products
    response = supabase.table("pedidos")\
        .select("id, total, estado, fecha, clientes(nombre), detalle_pedido(cantidad, productos(codigo_corto))")\
        .eq("estado", "pendiente")\
        .gte("fecha", f"{target_date}T00:00:00")\
        .lte("fecha", f"{target_date}T23:59:59")\
        .order("id")\
        .execute()
    
    # Sort by Client Name using Python since Supabase join sorting can be tricky
    orders = sorted(response.data, key=lambda x: x['clientes']['nombre'] if x['clientes'] else "")

    summary_text = ""
    summary_text += f"*PEDIDOS {target_date}*\n\n"
    
    for order in orders:
        client_name = order['clientes']['nombre']
        total = order['total']
        items = order['detalle_pedido']
        
        summary_text += f"*{client_name}* ${total:,.0f}\n"
        for item in items:
            qty = item['cantidad']
            code = item['productos']['codigo_corto'] if item['productos'] else "?"
            summary_text += f"{qty} {code}\n"
        
        summary_text += "\n"
        
    return {"text": summary_text.strip()}

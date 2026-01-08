from fastapi import APIRouter
from fastapi import APIRouter
from ..database import supabase
from typing import Dict, Any, Optional
from datetime import datetime

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_stats():
    # Use the views we created
    # Note: Supabase JS/Python client allows querying views just like tables
    
    ventas = supabase.table("view_ventas_hoy").select("total_ventas").execute()
    gastos = supabase.table("view_gastos_hoy").select("total_gastos").execute()
    deudores = supabase.table("view_clientes_deudores").select("*").execute()
    
    val_ventas = float(ventas.data[0]['total_ventas']) if ventas.data else 0.0
    val_gastos = float(gastos.data[0]['total_gastos']) if gastos.data else 0.0
    
    return {
        "ventas_hoy": val_ventas,
        "gastos_hoy": val_gastos,
        "utilidad_estimada": val_ventas - val_gastos,
        "clientes_deudores": deudores.data
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

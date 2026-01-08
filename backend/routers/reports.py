from fastapi import APIRouter
from ..database import supabase
from typing import Dict, Any

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_stats():
    # Use the views we created
    # Note: Supabase JS/Python client allows querying views just like tables
    
    ventas = supabase.table("view_ventas_hoy").select("total_ventas").execute()
    gastos = supabase.table("view_gastos_hoy").select("total_gastos").execute()
    deudores = supabase.table("view_clientes_deudores").select("*").execute()
    
    total_ventas = ventas.data[0]['total_ventas'] if ventas.data else 0
    total_gastos = gastos.data[0]['total_gastos'] if gastos.data else 0
    
    return {
        "ventas_hoy": total_ventas,
        "gastos_hoy": total_gastos,
        "utilidad_estimada": float(total_ventas) - float(total_gastos),
        "clientes_deudores": deudores.data
    }

@router.get("/whatsapp-summary")
def get_whatsapp_summary():
    # Logic to aggregate today's or pending orders for the delivery summary
    # Group by Client -> List Products
    
    # 1. Fetch today's orders with details
    # Assuming "summary" is for today's delivery.
    # We might want a date filter query param later.
    
    today_orders = supabase.table("pedidos")\
        .select("*, clients:clientes(nombre), details:detalle_pedido(cantidad, productos(codigo_corto))")\
        .eq("estado", "pendiente")\
        .gte("fecha", "2024-01-01") \
        .order("id")\
        .execute() 
        # Note: simplistic date filter, in real app use proper date range for "today"
        # Since I can't easily do "today" dynamic filter in simple Postgrest without logic, 
        # I'll rely on the frontend or backend logic to filter by date if strictly needed.
        # However, for now, let's just fetch 'pendiente' orders for the summary as that's what's needed to be delivered.
        
    response = supabase.table("pedidos")\
        .select("id, total, clientes(nombre), detalle_pedido(cantidad, productos(codigo_corto))")\
        .eq("estado", "pendiente")\
        .execute()
        
    summary_text = ""
    
    for order in response.data:
        client_name = order['clientes']['nombre']
        total = order['total']
        items = order['detalle_pedido']
        
        summary_text += f"{client_name} ${total:,.0f}\n"
        for item in items:
            qty = item['cantidad']
            code = item['productos']['codigo_corto']
            summary_text += f"{qty} {code}\n"
        
        summary_text += "\n"
        
    return {"text": summary_text.strip()}

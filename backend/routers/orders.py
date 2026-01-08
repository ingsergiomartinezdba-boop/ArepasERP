from fastapi import APIRouter, HTTPException, status
from typing import List
from ..database import supabase
from ..models import OrderCreate, OrderResponse, OrderItemResponse, Product, PriceRule
from datetime import datetime

router = APIRouter()

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate):
    # 1. Calculate prices and totals
    total_order = 0
    order_items_data = []

    # Optimize: Fetch all products and price rules in fewer queries if possible
    # For now, simplistic iteration is fine for small scale factory
    
    for item in order.items:
        # Get Product
        prod_res = supabase.table("productos").select("*").eq("id", item.producto_id).execute()
        if not prod_res.data:
            raise HTTPException(status_code=400, detail=f"Product {item.producto_id} not found")
        product = prod_res.data[0]
        
        # Determine Price
        # Check rule for this client and product
        price_res = supabase.table("precios_cliente").select("precio_especial").eq("cliente_id", order.cliente_id).eq("producto_id", item.producto_id).eq("activo", True).execute()
        
        if price_res.data:
            precio_aplicado = float(price_res.data[0]['precio_especial'])
        else:
            precio_aplicado = float(product['precio_estandar'])
            
        subtotal = precio_aplicado * item.cantidad
        total_order += subtotal
        
        order_items_data.append({
            "producto_id": item.producto_id,
            "cantidad": item.cantidad,
            "precio_aplicado": precio_aplicado,
            "subtotal": subtotal
        })

    # 2. Create Order
    order_data = {
        "cliente_id": order.cliente_id,
        "fecha": order.fecha.isoformat() if order.fecha else datetime.now().isoformat(),
        "total": total_order,
        "medio_pago_id": order.medio_pago_id,
        "estado": order.estado
    }
    
    new_order_res = supabase.table("pedidos").insert(order_data).execute()
    new_order_id = new_order_res.data[0]['id']
    
    # 3. Create Order Details
    for item_data in order_items_data:
        item_data["pedido_id"] = new_order_id
        supabase.table("detalle_pedido").insert(item_data).execute()
        
    # 4. Update Accounts Receivable (Cuentas por Cobrar) if credit/pending
    if order.estado != 'pagado': # Assuming 'pagado' means fully settled immediately
        # Check if paying later
        # Create record in cuentas_cobrar
        cuenta_data = {
            "cliente_id": order.cliente_id,
            "pedido_id": new_order_id,
            "valor_total": total_order,
            "valor_pagado": 0, # Assuming 0 initial payment if not fully paid
             # Default due date? Let's say immediate for now, user can update later or we add logic
            "fecha_vencimiento": datetime.now().isoformat(),
            "estado": "pendiente"
        }
        supabase.table("cuentas_cobrar").insert(cuenta_data).execute()

    # 5. Build Response
    # Re-fetch or construct response. Constructing is faster.
    response_items = []
    for item in order_items_data:
        response_items.append(OrderItemResponse(
            id=0, # Placeholder, we didn't fetch back individual IDs
            producto_id=item['producto_id'],
            cantidad=item['cantidad'],
            precio_aplicado=item['precio_aplicado'],
            subtotal=item['subtotal']
        ))
        
    return OrderResponse(
        id=new_order_id,
        cliente_id=order.cliente_id,
        fecha=datetime.fromisoformat(order_data['fecha']),
        total=total_order,
        medio_pago_id=order.medio_pago_id,
        estado=order.estado,
        items=response_items
    )

@router.get("/", response_model=List[OrderResponse])
def get_orders():
    # Fetch orders with items
    # Supabase join syntax: select("*, detalle_pedido(*, productos(nombre))")
    response = supabase.table("pedidos").select("*, clientes(nombre), detalle_pedido(id, producto_id, cantidad, precio_aplicado, subtotal, productos(nombre))").order("fecha", desc=True).limit(50).execute()
    
    # Transform to flat structure for Pydantic models if needed or use Aliases
    orders = []
    for o in response.data:
        items = []
        for i in o['detalle_pedido']:
             items.append({
                 "id": i['id'],
                 "producto_id": i['producto_id'],
                 "producto_nombre": i['productos']['nombre'] if i['productos'] else "Unknown",
                 "cantidad": i['cantidad'],
                 "precio_aplicado": i['precio_aplicado'],
                 "subtotal": i['subtotal']
             })
        
        orders.append({
            "id": o['id'],
            "cliente_id": o['cliente_id'],
            "cliente_nombre": o['clientes']['nombre'] if o['clientes'] else "Unknown",
            "fecha": o['fecha'],
            "total": o['total'],
            "medio_pago_id": o['medio_pago_id'],
            "estado": o['estado'],
            "items": items
        })
    return orders

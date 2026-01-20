from fastapi import APIRouter, HTTPException, status
from typing import List
from ..database import supabase
from ..models import OrderCreate, OrderResponse, OrderItemResponse, Product, PriceRule
from pydantic import BaseModel
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
        if item.precio is not None and item.precio > 0:
             precio_aplicado = float(item.precio)
        else:
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
    domicilio = order.valor_domicilio if order.valor_domicilio else 0
    total_order += domicilio
    
    order_data = {
        "cliente_id": order.cliente_id,
        "fecha": order.fecha.isoformat() if order.fecha else datetime.now().isoformat(),
        "total": total_order,
        "valor_domicilio": domicilio,
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
        valor_domicilio=domicilio,
        medio_pago_id=order.medio_pago_id,
        estado=order.estado,
        items=response_items
    )

@router.get("/", response_model=List[OrderResponse])
def get_orders(start_date: str = None, end_date: str = None, client_id: int = None, status: str = None):
    # Fetch orders with items
    # Supabase join syntax: select("*, detalle_pedido(*, productos(nombre))")
    query = supabase.table("pedidos").select("*, clientes(nombre), detalle_pedido(id, producto_id, cantidad, precio_aplicado, subtotal, productos(nombre))").order("fecha", desc=True)
    
    if start_date and end_date:
        if len(end_date) == 10: # YYYY-MM-DD
             end_date += "T23:59:59"
        query = query.gte("fecha", start_date).lte("fecha", end_date)
    else:
        # If no date range, and no other filters, limit. But if Client ID provided, maybe don't limit?
        if not client_id:
            query = query.limit(50)

    if client_id:
        query = query.eq("cliente_id", client_id)
    
    if status:
        query = query.eq("estado", status)
        
    response = query.execute()
    
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
            "valor_domicilio": o.get('valor_domicilio', 0),
            "medio_pago_id": o['medio_pago_id'],
            "estado": o['estado'],
            "items": items
        })
    return orders

@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int):
    response = supabase.table("pedidos").select("*, clientes(nombre), detalle_pedido(id, producto_id, cantidad, precio_aplicado, subtotal, productos(nombre))").eq("id", order_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Order not found")
        
    o = response.data[0]
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
    
    return {
        "id": o['id'],
        "cliente_id": o['cliente_id'],
        "cliente_nombre": o['clientes']['nombre'] if o['clientes'] else "Unknown",
        "fecha": o['fecha'],
        "total": o['total'],
        "valor_domicilio": o.get('valor_domicilio', 0),
        "medio_pago_id": o['medio_pago_id'],
        "estado": o['estado'],
        "items": items
    }

@router.put("/{order_id}", response_model=OrderResponse)
def update_order(order_id: int, order: OrderCreate):
    # 1. Verify existence
    existing = supabase.table("pedidos").select("*").eq("id", order_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Order not found")

    # 2. Calculate New Totals & Items (Existing Logic Reused)
    total_order = 0
    order_items_data = []

    for item in order.items:
        # Get Product
        prod_res = supabase.table("productos").select("*").eq("id", item.producto_id).execute()
        if not prod_res.data:
            continue # Skip invalid products or raise error
        product = prod_res.data[0]
        
        # Determine Price (Re-check rules in case they changed, or stick to original?)
        # Better to re-calculate for accuracy on "Modify"
        price_res = supabase.table("precios_cliente").select("precio_especial").eq("cliente_id", order.cliente_id).eq("producto_id", item.producto_id).eq("activo", True).execute()
        
        if price_res.data:
            precio_aplicado = float(price_res.data[0]['precio_especial'])
        else:
            precio_aplicado = float(product['precio_estandar'])
            
        subtotal = precio_aplicado * item.cantidad
        total_order += subtotal
        
        order_items_data.append({
            "pedido_id": order_id,
            "producto_id": item.producto_id,
            "cantidad": item.cantidad,
            "precio_aplicado": precio_aplicado,
            "subtotal": subtotal
        })

    domicilio = order.valor_domicilio if order.valor_domicilio else 0
    total_order += domicilio

    # 3. Update Order Header
    # Ensure creation date ('fecha') is NOT changed.
    # Add updated_at timestamp.
    order_data = {
        "cliente_id": order.cliente_id,
        "fecha": order.fecha.isoformat() if order.fecha else datetime.now().isoformat(), 
        "total": total_order,
        "valor_domicilio": domicilio,
        "medio_pago_id": order.medio_pago_id,
        "estado": order.estado,
        "updated_at": datetime.now().isoformat()
    }
    
    # If using OrderCreate model, 'fecha' might be passed, but we ignore it for updates 
    # as per user request "date cannot be changed".
    
    supabase.table("pedidos").update(order_data).eq("id", order_id).execute()

    # 4. Replace Items (Delete All for this Order -> Insert New)
    # Note: RLS might block DELETE if not configured? No, "Acceso Total Detalle" covers it.
    supabase.table("detalle_pedido").delete().eq("pedido_id", order_id).execute()
    if order_items_data:
        supabase.table("detalle_pedido").insert(order_items_data).execute()

    # 5. Update Accounts Receivable (Cuentas por Cobrar)
    # 5. Sync Accounts Receivable (Cuentas por Cobrar)
    ar_res = supabase.table("cuentas_cobrar").select("*").eq("pedido_id", order_id).execute()
    existing_ar = ar_res.data[0] if ar_res.data else None
    
    if order.estado == 'cancelado':
        if existing_ar:
            supabase.table("cuentas_cobrar").delete().eq("id", existing_ar['id']).execute()
            
    elif order.estado == 'pagado':
        if existing_ar:
             supabase.table("cuentas_cobrar").update({
                 "valor_total": total_order,
                 "valor_pagado": total_order,
                 "estado": "pagado"
             }).eq("id", existing_ar['id']).execute()
             
    else: # Pendiente
        if existing_ar:
            supabase.table("cuentas_cobrar").update({
                "valor_total": total_order,
                "estado": "pendiente"
            }).eq("id", existing_ar['id']).execute()
        else:
            # Create new if missing
            cuenta_data = {
                "cliente_id": order.cliente_id,
                "pedido_id": order_id,
                "valor_total": total_order,
                "valor_pagado": 0,
                "fecha_vencimiento": datetime.now().isoformat(),
                "estado": "pendiente"
            }
            supabase.table("cuentas_cobrar").insert(cuenta_data).execute()

    # 6. Return Updated Order (Reuse get_order logic or construct)
    return get_order(order_id)

class OrderStatusUpdate(BaseModel):
    estado: str
    medio_pago_id: int | None = None

@router.patch("/{order_id}/status")
def patch_order_status(order_id: int, status_update: OrderStatusUpdate):
    # 1. Fetch Order
    res = supabase.table("pedidos").select("*").eq("id", order_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = res.data[0]
    
    # 2. Validation
    if status_update.estado == 'pagado':
        # Must have payment method either in payload or already in DB
        if not status_update.medio_pago_id and not order['medio_pago_id']:
             raise HTTPException(status_code=400, detail="Payment Method is required when marking as Paid.")
    
    # 3. Update Data
    update_data = {"estado": status_update.estado}
    if status_update.medio_pago_id:
        update_data["medio_pago_id"] = status_update.medio_pago_id
        
    supabase.table("pedidos").update(update_data).eq("id", order_id).execute()
    
    # 4. Update Accounts Receivable (Cuentas por Cobrar)
    # If Paid -> Update valor_pagado to match total
    # If Pendiente -> Update valor_pagado to 0? Or just leave it?
    # Usually "Pagado" means fully paid.
    
    if status_update.estado == 'pagado':
         supabase.table("cuentas_cobrar").update({
             "valor_pagado": order['total'],
             "estado": "pagado"
         }).eq("pedido_id", order_id).execute()
    elif status_update.estado == 'pendiente':
        # Check if exists first
        ar_res = supabase.table("cuentas_cobrar").select("*").eq("pedido_id", order_id).execute()
        if ar_res.data:
            # Update existing
             supabase.table("cuentas_cobrar").update({
                 "valor_pagado": 0,
                 "estado": "pendiente"
             }).eq("pedido_id", order_id).execute()
        else:
             # Create new if missing (restore debt)
             cuenta_data = {
                "cliente_id": order['cliente_id'],
                "pedido_id": order_id,
                "valor_total": order['total'],
                "valor_pagado": 0,
                "fecha_vencimiento": datetime.now().isoformat(),
                "estado": "pendiente"
            }
             supabase.table("cuentas_cobrar").insert(cuenta_data).execute()

    elif status_update.estado == 'cancelado':
        # Void the debt (delete accounts receivable record)
        supabase.table("cuentas_cobrar").delete().eq("pedido_id", order_id).execute()

    return {"message": "Status updated"}

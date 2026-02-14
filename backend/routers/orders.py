from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from sqlalchemy.orm import Session
from database import get_db
from sql_models import Pedido, DetallePedido, Producto, Cliente, PrecioCliente
from models import OrderCreate, OrderResponse, OrderStatusUpdate
from utils import get_now_colombia

router = APIRouter()

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    """Create a new order with automatic price calculation"""
    # 1. Calculate prices and totals
    total_order = 0
    order_items_data = []
    
    for item in order.items:
        # Get product
        product = db.query(Producto).filter(Producto.id == item.producto_id).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {item.producto_id} not found")
        
        # Determine price
        if item.precio is not None and item.precio > 0:
            precio_aplicado = float(item.precio)
        else:
            # Check for special price rule
            price_rule = db.query(PrecioCliente).filter(
                PrecioCliente.cliente_id == order.cliente_id,
                PrecioCliente.producto_id == item.producto_id,
                PrecioCliente.activo == True
            ).first()
            
            if price_rule:
                precio_aplicado = float(price_rule.precio_especial)
            else:
                precio_aplicado = float(product.precio_estandar)
        
        subtotal = precio_aplicado * item.cantidad
        total_order += subtotal
        
        order_items_data.append({
            "producto_id": item.producto_id,
            "cantidad": item.cantidad,
            "precio_aplicado": precio_aplicado,
            "subtotal": subtotal
        })
    
    # 2. Add delivery fee if applicable
    domicilio = order.valor_domicilio if order.valor_domicilio else 0
    total_order += domicilio
    
    # 3. Create order
    order_data = {
        "cliente_id": order.cliente_id,
        "fecha": order.fecha if order.fecha else get_now_colombia(),
        "total": total_order,
        "valor_domicilio": domicilio,
        "medio_pago_id": order.medio_pago_id,
        "estado": order.estado or 'pendiente',
        "observaciones": order.observaciones
    }
    
    db_order = Pedido(**order_data)
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    # 4. Create order details
    for item_data in order_items_data:
        item_data["pedido_id"] = db_order.id
        db_detail = DetallePedido(**item_data)
        db.add(db_detail)
    
    db.commit()
    
    # 5. Return order with details
    return get_order_response(db_order.id, db)

@router.get("/", response_model=List[OrderResponse])
def get_orders(
    start_date: str = None,
    end_date: str = None,
    cliente_id: int = None,
    estado: str = None,
    db: Session = Depends(get_db)
):
    """Get orders with optional filters"""
    query = db.query(Pedido).order_by(Pedido.fecha.desc())
    
    if start_date and end_date:
        query = query.filter(Pedido.fecha >= start_date, Pedido.fecha <= end_date)
    
    if cliente_id:
        query = query.filter(Pedido.cliente_id == cliente_id)
    
    if estado:
        query = query.filter(Pedido.estado == estado)
    
    orders = query.limit(100).all()
    
    return [get_order_response(order.id, db) for order in orders]

@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    """Get a specific order by ID"""
    order = db.query(Pedido).filter(Pedido.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return get_order_response(order_id, db)

@router.put("/{order_id}", response_model=OrderResponse)
def update_order(order_id: int, order_update: OrderCreate, db: Session = Depends(get_db)):
    """Update an existing order"""
    db_order = db.query(Pedido).filter(Pedido.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    try:
        # Recalculate totals
        total_order = 0
        
        # Delete existing details
        db.query(DetallePedido).filter(DetallePedido.pedido_id == order_id).delete()
        
        # Add new details
        for item in order_update.items:
            product = db.query(Producto).filter(Producto.id == item.producto_id).first()
            if not product:
                continue
            
            # Determine price
            if item.precio is not None and item.precio > 0:
                precio_aplicado = float(item.precio)
            else:
                price_rule = db.query(PrecioCliente).filter(
                    PrecioCliente.cliente_id == order_update.cliente_id,
                    PrecioCliente.producto_id == item.producto_id,
                    PrecioCliente.activo == True
                ).first()
                
                precio_aplicado = float(price_rule.precio_especial) if price_rule else float(product.precio_estandar)
            
            subtotal = precio_aplicado * item.cantidad
            total_order += subtotal
            
            db_detail = DetallePedido(
                pedido_id=order_id,
                producto_id=item.producto_id,
                cantidad=item.cantidad,
                precio_aplicado=precio_aplicado,
                subtotal=subtotal
            )
            db.add(db_detail)
        
        # 2. Update order
        domicilio = order_update.valor_domicilio if order_update.valor_domicilio else 0
        total_order += domicilio
        
        db_order.total = total_order
        db_order.valor_domicilio = domicilio
        db_order.estado = order_update.estado or db_order.estado
        db_order.medio_pago_id = order_update.medio_pago_id
        db_order.observaciones = order_update.observaciones
        
        db.commit()
        
        return get_order_response(order_id, db)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{order_id}/status")
def update_order_status(order_id: int, update_data: OrderStatusUpdate, db: Session = Depends(get_db)):
    """Update only the order status and potentially the payment method"""
    db_order = db.query(Pedido).filter(Pedido.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    db_order.estado = update_data.estado
    if update_data.medio_pago_id is not None:
        db_order.medio_pago_id = update_data.medio_pago_id
        
    db.commit()
    
    return {"message": "Status updated", "estado": update_data.estado}

@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    """Delete an order and its details"""
    db_order = db.query(Pedido).filter(Pedido.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Details will be deleted automatically due to CASCADE
    db.delete(db_order)
    db.commit()
    
    return {"message": "Order deleted"}

# Helper function
def get_order_response(order_id: int, db: Session):
    """Build order response with all details"""
    order = db.query(Pedido).filter(Pedido.id == order_id).first()
    if not order:
        return None
    
    # Get client
    cliente = db.query(Cliente).filter(Cliente.id == order.cliente_id).first()
    
    # Get details
    details = db.query(DetallePedido).filter(DetallePedido.pedido_id == order_id).all()
    
    items = []
    for detail in details:
        producto = db.query(Producto).filter(Producto.id == detail.producto_id).first()
        items.append({
            "id": detail.id,
            "producto_id": detail.producto_id,
            "producto_nombre": producto.nombre if producto else "Desconocido",
            "cantidad": detail.cantidad,
            "precio_aplicado": float(detail.precio_aplicado),
            "subtotal": float(detail.subtotal)
        })
    
    return {
        "id": order.id,
        "cliente_id": order.cliente_id,
        "cliente_nombre": cliente.nombre if cliente else "Desconocido",
        "fecha": order.fecha,
        "total": float(order.total),
        "monto_pagado": float(order.monto_pagado or 0),
        "valor_domicilio": float(order.valor_domicilio or 0),
        "medio_pago_id": order.medio_pago_id,
        "estado": order.estado,
        "observaciones": order.observaciones,
        "items": items
    }

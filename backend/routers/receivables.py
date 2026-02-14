from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List
from database import get_db
from sql_models import PagoRecibido, Pedido, Cliente, MedioPago, PagoPedido
from models import PaymentReceivedCreate, PaymentReceived
from auth import get_current_user
from utils import get_now_colombia

router = APIRouter(tags=["Receivables"])

@router.get("/ping")
def ping():
    """Health check"""
    return {"status": "ok"}

@router.get("/history", dependencies=[Depends(get_current_user)])
def get_payment_history(db: Session = Depends(get_db)):
    """Get recent payment history"""
    payments = db.query(PagoRecibido).order_by(PagoRecibido.fecha.desc()).limit(50).all()
    
    result = []
    for pago in payments:
        cliente = db.query(Cliente).filter(Cliente.id == pago.cliente_id).first()
        medio = db.query(MedioPago).filter(MedioPago.id == pago.metodo_pago_id).first()
        
        result.append({
            "id": pago.id,
            "cliente_id": pago.cliente_id,
            "cliente": cliente.nombre if cliente else "Desconocido",
            "monto": float(pago.monto),
            "fecha": pago.fecha,
            "descripcion": pago.descripcion,
            "metodo_pago_id": pago.metodo_pago_id,
            "medio_pago": medio.nombre if medio else "-"
        })
    
    return result

@router.get("/accounts", dependencies=[Depends(get_current_user)])
def get_receivable_accounts(db: Session = Depends(get_db)):
    """Get accounts receivable grouped by client"""
    # Query pending or partially paid orders
    pending_orders = db.query(Pedido).filter(Pedido.estado.in_(['pendiente', 'parcial'])).all()
    
    if not pending_orders:
        return []
    
    # Group by client
    clients_map = {}
    
    for order in pending_orders:
        cid = order.cliente_id
        debt = float(order.total) - float(order.monto_pagado or 0)
        
        if debt <= 0:
            continue
        
        if cid not in clients_map:
            cliente = db.query(Cliente).filter(Cliente.id == cid).first()
            order_date = order.fecha or order.created_at
            clients_map[cid] = {
                "cliente_id": cid,
                "nombre": cliente.nombre if cliente else "Desconocido",
                "total_deuda": 0,
                "ordenes_pendientes": 0,
                "fecha_mas_antigua": order_date
            }
        
        clients_map[cid]['total_deuda'] += debt
        clients_map[cid]['ordenes_pendientes'] += 1
        
        # Keep oldest date
        order_date = order.fecha or order.created_at
        if order_date and (not clients_map[cid]['fecha_mas_antigua'] or order_date < clients_map[cid]['fecha_mas_antigua']):
            clients_map[cid]['fecha_mas_antigua'] = order_date
    
    return list(clients_map.values())

@router.post("/payments", response_model=PaymentReceived, dependencies=[Depends(get_current_user)])
def register_payment(payment: PaymentReceivedCreate, db: Session = Depends(get_db)):
    """Register a payment and apply it to pending orders (FIFO)"""
    try:
        # 1. Create payment record
        payment_data = payment.dict()
        if not payment_data.get('fecha'):
            payment_data['fecha'] = get_now_colombia()
        
        db_payment = PagoRecibido(**payment_data)
        db.add(db_payment)
        db.commit()
        db.refresh(db_payment)
        
        payment_id = db_payment.id
        remaining_amount = float(payment.monto)
        
        # 2. Apply to oldest pending orders (FIFO)
        pending_orders = db.query(Pedido).filter(
            Pedido.cliente_id == payment.cliente_id,
            Pedido.estado.in_(['pendiente', 'parcial'])
        ).order_by(Pedido.fecha, Pedido.id).all()
        
        for order in pending_orders:
            if remaining_amount <= 0:
                break
            
            order_debt = float(order.total) - float(order.monto_pagado or 0)
            
            if order_debt <= 0:
                continue
            
            # Calculate amount to apply to this order
            amount_to_apply = min(remaining_amount, order_debt)
            
            # Create payment-order link
            pago_pedido = PagoPedido(
                pago_id=payment_id,
                pedido_id=order.id,
                monto=amount_to_apply
            )
            db.add(pago_pedido)
            
            # Update order
            order.monto_pagado = float(order.monto_pagado or 0) + amount_to_apply
            
            # Update order status
            if order.monto_pagado >= order.total:
                order.estado = 'pagado'
            elif order.monto_pagado > 0:
                order.estado = 'parcial'
            
            remaining_amount -= amount_to_apply
        
        db.commit()
        
        return db_payment
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/payments/{payment_id}", dependencies=[Depends(get_current_user)])
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    """Delete a payment and revert its application to orders"""
    try:
        # Get payment
        payment = db.query(PagoRecibido).filter(PagoRecibido.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Get payment-order links
        links = db.query(PagoPedido).filter(PagoPedido.pago_id == payment_id).all()
        
        # Revert each order
        for link in links:
            order = db.query(Pedido).filter(Pedido.id == link.pedido_id).first()
            if order:
                order.monto_pagado = float(order.monto_pagado or 0) - float(link.monto)
                
                # Update order status
                if order.monto_pagado <= 0:
                    order.estado = 'pendiente'
                    order.monto_pagado = 0
                elif order.monto_pagado < order.total:
                    order.estado = 'parcial'
            
            # Delete link
            db.delete(link)
        
        # Delete payment
        db.delete(payment)
        db.commit()
        
        return {"message": "Payment deleted and orders reverted"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/client/{client_id}/orders", dependencies=[Depends(get_current_user)])
def get_client_pending_orders(client_id: int, db: Session = Depends(get_db)):
    """Get pending orders for a specific client"""
    orders = db.query(Pedido).filter(
        Pedido.cliente_id == client_id,
        Pedido.estado.in_(['pendiente', 'parcial'])
    ).order_by(Pedido.fecha).all()
    
    result = []
    for order in orders:
        debt = float(order.total) - float(order.monto_pagado or 0)
        result.append({
            "id": order.id,
            "fecha": order.fecha,
            "total": float(order.total),
            "monto_pagado": float(order.monto_pagado or 0),
            "saldo": debt,
            "estado": order.estado
        })
    
    return result

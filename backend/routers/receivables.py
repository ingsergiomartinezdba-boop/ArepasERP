import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List
from database import get_db
from sql_models import PagoRecibido, Pedido, Cliente, MedioPago, PagoPedido
from models import PaymentReceivedCreate, PaymentReceived
from auth import get_current_user, require_internal_permission
from utils import get_now_colombia

router = APIRouter(tags=["Receivables"])
logger = logging.getLogger(__name__)

@router.get("/ping", dependencies=[Depends(require_internal_permission("cobros.ver"))])
def ping():
    return {"status": "ok"}

@router.get("/history", dependencies=[Depends(require_internal_permission("cobros.ver"))])
def get_payment_history(db: Session = Depends(get_db)):
    payments = db.query(PagoRecibido).order_by(PagoRecibido.fecha.desc(), PagoRecibido.id.desc()).limit(50).all()

    if not payments:
        return []

    client_ids = {p.cliente_id for p in payments if p.cliente_id}
    method_ids = {p.medio_pago_id for p in payments if p.medio_pago_id}

    clientes_map = {
        c.id: c.nombre
        for c in db.query(Cliente).filter(Cliente.id.in_(client_ids)).all()
    }
    medios_map = {
        m.id: m.nombre
        for m in db.query(MedioPago).filter(MedioPago.id.in_(method_ids)).all()
    }

    return [
        {
            "id": pago.id,
            "cliente_id": pago.cliente_id,
            "cliente": clientes_map.get(pago.cliente_id, "Desconocido"),
            "monto": float(pago.monto),
            "fecha": pago.fecha,
            "medio_pago_id": pago.medio_pago_id,
            "medio_pago": medios_map.get(pago.medio_pago_id, "-")
        }
        for pago in payments
    ]

@router.get("/accounts", dependencies=[Depends(require_internal_permission("cobros.ver"))])
def get_receivable_accounts(db: Session = Depends(get_db)):
    """Cuentas por cobrar — una fila por pedido pendiente de pago."""
    try:
        rows = db.execute(text("""
            SELECT
                p.id            AS pedido_id,
                p.cliente_id,
                c.nombre,
                p.fecha,
                p.estado,
                p.total - COALESCE(pp_sum.pagado, 0) AS saldo
            FROM pedidos p
            JOIN clientes c ON c.id = p.cliente_id
            LEFT JOIN (
                SELECT pedido_id, SUM(monto) AS pagado
                FROM pagos_pedidos
                GROUP BY pedido_id
            ) pp_sum ON pp_sum.pedido_id = p.id
            WHERE p.estado = 'por_cobrar'
              AND (p.total - COALESCE(pp_sum.pagado, 0)) > 0
            ORDER BY p.fecha ASC
        """)).fetchall()
    except Exception as e:
        logger.error("Error en cuentas por cobrar: %s", e)
        return []

    return [
        {
            "pedido_id":  r.pedido_id,
            "cliente_id": r.cliente_id,
            "nombre":     r.nombre,
            "fecha":      r.fecha.isoformat() if r.fecha else None,
            "estado":     r.estado,
            "saldo":      float(r.saldo or 0),
        }
        for r in rows
    ]

@router.post("/payments", response_model=PaymentReceived, dependencies=[Depends(require_internal_permission("cobros.registrar"))])
def register_payment(payment: PaymentReceivedCreate, db: Session = Depends(get_db)):
    """Register a payment and apply it to pending orders (FIFO)."""
    try:
        db_payment = PagoRecibido(
            cliente_id=payment.cliente_id,
            monto=payment.monto,
            medio_pago_id=payment.medio_pago_id,
            fecha=payment.fecha or get_now_colombia(),
        )
        db.add(db_payment)
        db.flush()

        payment_id = db_payment.id
        remaining = float(payment.monto)

        # Apply to oldest pending orders (FIFO) using pagos_pedidos balance
        pending_orders = db.execute(text("""
            SELECT p.id, p.total - COALESCE(SUM(pp.monto), 0) AS saldo
            FROM pedidos p
            LEFT JOIN pagos_pedidos pp ON pp.pedido_id = p.id
            WHERE p.cliente_id = :cid
              AND p.estado = 'por_cobrar'
            GROUP BY p.id, p.total
            HAVING p.total - COALESCE(SUM(pp.monto), 0) > 0
            ORDER BY p.fecha, p.id
        """), {"cid": payment.cliente_id}).fetchall()

        for row in pending_orders:
            if remaining <= 0:
                break
            order_id = row[0]
            saldo = float(row[1])
            amount_to_apply = min(remaining, saldo)

            db.add(PagoPedido(
                pago_id=payment_id,
                pedido_id=order_id,
                monto=amount_to_apply
            ))

            # Mark order as paid only when fully covered
            new_balance = saldo - amount_to_apply
            if new_balance <= 0.01:
                db.execute(
                    text("UPDATE pedidos SET estado='pagado' WHERE id=:id"),
                    {"id": order_id}
                )

            remaining -= amount_to_apply

        db.commit()
        db.refresh(db_payment)
        return db_payment

    except Exception as e:
        db.rollback()
        logger.error("Error registrando pago: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al registrar el pago")

@router.delete("/payments/{payment_id}", dependencies=[Depends(require_internal_permission("cobros.registrar"))])
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    """Delete a payment and revert orders to pendiente if needed."""
    try:
        payment = db.query(PagoRecibido).filter(PagoRecibido.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Pago no encontrado")

        links = db.query(PagoPedido).filter(PagoPedido.pago_id == payment_id).all()

        for link in links:
            # If order was marked pagado, revert to pendiente
            db.execute(
                text("UPDATE pedidos SET estado='pendiente' WHERE id=:id AND estado='pagado'"),
                {"id": link.pedido_id}
            )
            db.delete(link)

        db.delete(payment)
        db.commit()
        return {"message": "Pago eliminado y pedidos revertidos"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Error eliminando pago: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al eliminar el pago")

@router.get("/client/{client_id}/orders", dependencies=[Depends(require_internal_permission("cobros.ver"))])
def get_client_pending_orders(client_id: int, db: Session = Depends(get_db)):
    """Pending orders with real saldo from pagos_pedidos."""
    try:
        rows = db.execute(text("""
            SELECT
                p.id,
                p.fecha,
                p.total,
                COALESCE(SUM(pp.monto), 0) AS pagado,
                p.total - COALESCE(SUM(pp.monto), 0) AS saldo,
                p.estado
            FROM pedidos p
            LEFT JOIN pagos_pedidos pp ON pp.pedido_id = p.id
            WHERE p.cliente_id = :cid
              AND p.estado = 'por_cobrar'
            GROUP BY p.id, p.fecha, p.total, p.estado
            HAVING p.total - COALESCE(SUM(pp.monto), 0) > 0
            ORDER BY p.fecha
        """), {"cid": client_id}).fetchall()
    except Exception as e:
        logger.error("Error: %s", e)
        return []

    return [
        {
            "id": r[0],
            "fecha": r[1].isoformat() if r[1] else None,
            "total": float(r[2]),
            "monto_pagado": float(r[3]),
            "saldo": float(r[4]),
            "estado": r[5],
        }
        for r in rows
    ]

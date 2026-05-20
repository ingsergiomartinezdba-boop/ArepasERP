import logging
from fastapi import APIRouter, HTTPException, Query, Request, status, Depends
from typing import List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from database import get_db
from sql_models import Pedido, DetallePedido, Producto, Cliente, PagoRecibido, PagoPedido, ProductoInsumo, Insumo, MovimientoInsumo, Usuario
from models import OrderCreate, OrderResponse, OrderStatusUpdate
from utils import get_now_colombia, resolver_precio_cliente
from auth import require_internal_permission
from audit import auditar, snapshot

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Helpers: consumo de insumos por pedido ────────────────────────────────────

def _calcular_demanda_insumos(detalles: list, db: Session) -> dict:
    """
    Agrega la demanda total de insumos para los items del pedido.
    Retorna {insumo_id: cantidad_total_requerida}.
    """
    demanda: dict[int, float] = {}
    for det in detalles:
        producto_id = det["producto_id"] if isinstance(det, dict) else det.producto_id
        cantidad    = det["cantidad"]    if isinstance(det, dict) else det.cantidad
        pi_rows = db.query(ProductoInsumo).filter(ProductoInsumo.producto_id == producto_id).all()
        for pi in pi_rows:
            consumo = float(pi.cantidad) * float(cantidad)
            demanda[pi.insumo_id] = demanda.get(pi.insumo_id, 0.0) + consumo
    return demanda


def _validar_stock_insumos(detalles: list, db: Session) -> None:
    """
    Verifica que haya stock suficiente para satisfacer todos los items del pedido.
    Si falta algo, lanza HTTPException 409 con un mensaje detallado.
    Se debe llamar ANTES de crear el pedido / detalles, para no dejar registros
    parciales si la validación falla.
    """
    demanda = _calcular_demanda_insumos(detalles, db)
    if not demanda:
        return

    faltantes = []
    for insumo_id, cant_necesaria in demanda.items():
        insumo = db.query(Insumo).filter(Insumo.id == insumo_id).first()
        if not insumo:
            continue
        disponible = float(insumo.cantidad_actual or 0)
        if disponible + 1e-6 < cant_necesaria:   # tolerancia mínima por floats
            faltan = round(cant_necesaria - disponible, 3)
            faltantes.append(
                f"{insumo.nombre}: faltan {faltan} {insumo.unidad_medida} "
                f"(disponible {round(disponible, 3)}, requiere {round(cant_necesaria, 3)})"
            )

    if faltantes:
        msg = "No se puede guardar el pedido — stock de insumos insuficiente. " + " · ".join(faltantes)
        raise HTTPException(status_code=409, detail=msg)


def _consumir_insumos_pedido(pedido_id: int, detalles: list, db: Session):
    """Registra salida de insumos para cada ítem del pedido.

    Asume que `_validar_stock_insumos` ya se ejecutó. Si no se valida,
    cantidad_actual puede quedar negativa.
    """
    for det in detalles:
        producto_id = det["producto_id"] if isinstance(det, dict) else det.producto_id
        cantidad    = det["cantidad"]    if isinstance(det, dict) else det.cantidad
        pi_rows = db.query(ProductoInsumo).filter(ProductoInsumo.producto_id == producto_id).all()
        for pi in pi_rows:
            consumo = float(pi.cantidad) * float(cantidad)
            insumo = db.query(Insumo).filter(Insumo.id == pi.insumo_id).first()
            if not insumo:
                continue
            insumo.cantidad_actual = float(insumo.cantidad_actual) - consumo
            db.add(MovimientoInsumo(
                insumo_id    = pi.insumo_id,
                tipo         = 'salida',
                cantidad     = consumo,
                origen       = 'pedido',
                referencia_id= pedido_id,
                notas        = f'Pedido #{pedido_id}',
            ))

def _revertir_insumos_pedido(pedido_id: int, db: Session):
    """Revierte los movimientos de insumo asociados al pedido (para cancelaciones)."""
    movs = (
        db.query(MovimientoInsumo)
        .filter(MovimientoInsumo.origen == 'pedido', MovimientoInsumo.referencia_id == pedido_id)
        .all()
    )
    for mov in movs:
        insumo = db.query(Insumo).filter(Insumo.id == mov.insumo_id).first()
        if insumo:
            # salida → devolver al stock; entrada → descontar (caso revertir-revertido)
            delta = float(mov.cantidad) if mov.tipo == 'salida' else -float(mov.cantidad)
            insumo.cantidad_actual = float(insumo.cantidad_actual) + delta
        db.delete(mov)

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_internal_permission("pedidos.crear"))])
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    """Create a new order with automatic price calculation.

    Si faltan insumos para alguno de los items, NO se guarda nada y se
    devuelve un 409 con el detalle de los insumos faltantes.
    """
    # 1. Calculate prices and totals
    total_order = 0
    order_items_data = []

    for item in order.items:
        # Get product
        product = db.query(Producto).filter(Producto.id == item.producto_id).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {item.producto_id} not found")

        # Resolver precio: especial del cliente > precio base
        precio_aplicado, _ = resolver_precio_cliente(
            order.cliente_id, item.producto_id, product.precio, db
        )
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

    estado_inicial = order.estado or 'pendiente'

    # 3. Validar stock de insumos ANTES de crear nada (excepto si el pedido nace cancelado)
    if estado_inicial != 'cancelado':
        _validar_stock_insumos(order_items_data, db)

    # 4. Create order + detalles + consumo de insumos en una sola transacción
    try:
        order_data = {
            "cliente_id": order.cliente_id,
            "fecha": order.fecha if order.fecha else get_now_colombia(),
            "total": total_order,
            "valor_domicilio": domicilio,
            "estado": estado_inicial,
            "observaciones": order.observaciones,
        }
        db_order = Pedido(**order_data)
        db.add(db_order)
        db.flush()   # obtiene db_order.id sin commit todavía

        for item_data in order_items_data:
            item_data["pedido_id"] = db_order.id
            db.add(DetallePedido(**item_data))

        if estado_inicial != 'cancelado':
            _consumir_insumos_pedido(db_order.id, order_items_data, db)

        db.commit()
        db.refresh(db_order)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    # 5. Return order with details
    return get_order_response(db_order.id, db)

@router.get("/", response_model=List[OrderResponse],
            dependencies=[Depends(require_internal_permission("pedidos.ver"))])
def get_orders(
    start_date: str = None,
    end_date: str = None,
    cliente_id: int = None,
    estado: str = None,
    skip:  int = Query(0,  ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Get orders with optional filters"""
    # Orden estable: fecha DESC con desempate por id DESC. Sin el id como
    # tiebreaker, la paginación skip/limit puede devolver el mismo registro
    # en páginas consecutivas (varios pedidos con la misma fecha).
    query = db.query(Pedido).order_by(Pedido.fecha.desc(), Pedido.id.desc())

    if start_date and end_date:
        query = query.filter(Pedido.fecha >= start_date, Pedido.fecha <= end_date)

    if cliente_id:
        query = query.filter(Pedido.cliente_id == cliente_id)

    if estado:
        estados_list = [e.strip() for e in estado.split(',') if e.strip()]
        if len(estados_list) == 1:
            query = query.filter(Pedido.estado == estados_list[0])
        else:
            query = query.filter(Pedido.estado.in_(estados_list))

    orders = query.offset(skip).limit(limit).all()
    return [get_order_response(order.id, db) for order in orders]

@router.get("/{order_id}", response_model=OrderResponse,
            dependencies=[Depends(require_internal_permission("pedidos.ver"))])
def get_order(order_id: int, db: Session = Depends(get_db)):
    """Get a specific order by ID"""
    order = db.query(Pedido).filter(Pedido.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return get_order_response(order_id, db)

@router.put("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: int,
    order_update: OrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_internal_permission("pedidos.editar")),
):
    """Update an existing order"""
    db_order = db.query(Pedido).filter(Pedido.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Snapshot ANTES de modificar (para el audit log)
    antes = snapshot(db_order)

    try:
        prev_estado = db_order.estado

        # Revertir insumos del pedido anterior antes de recalcular.
        # Esto devuelve stock que luego volveremos a descontar con los nuevos items.
        if prev_estado != 'cancelado':
            _revertir_insumos_pedido(order_id, db)

        # Recalculate totals
        total_order = 0
        new_items_data = []

        # Build new details data (no las añadimos a la sesión todavía — primero validamos stock)
        for item in order_update.items:
            product = db.query(Producto).filter(Producto.id == item.producto_id).first()
            if not product:
                continue

            precio_aplicado, _ = resolver_precio_cliente(
                order_update.cliente_id, item.producto_id, product.precio, db
            )
            subtotal = precio_aplicado * item.cantidad
            total_order += subtotal
            new_items_data.append({
                "producto_id":     item.producto_id,
                "cantidad":        item.cantidad,
                "precio_aplicado": precio_aplicado,
                "subtotal":        subtotal,
            })

        # Update order fields
        domicilio = order_update.valor_domicilio if order_update.valor_domicilio else 0
        total_order += domicilio
        nuevo_estado = order_update.estado or db_order.estado

        # Validar stock ANTES de borrar detalles y aplicar cambios
        if nuevo_estado != 'cancelado':
            _validar_stock_insumos(new_items_data, db)

        # Delete existing details (después de validar)
        db.query(DetallePedido).filter(DetallePedido.pedido_id == order_id).delete()

        # Add new details
        for item_data in new_items_data:
            db.add(DetallePedido(pedido_id=order_id, **item_data))

        db_order.total = total_order
        db_order.valor_domicilio = domicilio
        db_order.estado = nuevo_estado
        db_order.observaciones = order_update.observaciones
        if order_update.fecha:
            db_order.fecha = order_update.fecha

        # Consumir insumos con los nuevos items (si el pedido no queda cancelado)
        if nuevo_estado != 'cancelado':
            _consumir_insumos_pedido(order_id, new_items_data, db)

        db.commit()
        db.refresh(db_order)

        # Auditar después del commit exitoso
        auditar(db, user, "pedido", order_id, "update",
                antes=antes, despues=snapshot(db_order), request=request)

        return get_order_response(order_id, db)

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error("Error in orders router: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.patch("/{order_id}/status")
def update_order_status(
    order_id: int,
    update_data: OrderStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_internal_permission("pedidos.editar")),
):
    """Update order status, creating/removing pagos_recibidos records to keep balances accurate"""
    db_order = db.query(Pedido).filter(Pedido.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")

    prev_estado = db_order.estado
    nuevo_estado = update_data.estado

    # --- Gestión de insumos según cambio de estado ---
    if nuevo_estado == 'cancelado' and prev_estado != 'cancelado':
        # Cancelar pedido → devolver insumos al stock
        _revertir_insumos_pedido(order_id, db)
    elif prev_estado == 'cancelado' and nuevo_estado != 'cancelado':
        # Reactivar pedido cancelado → descontar insumos de nuevo
        detalles = db.query(DetallePedido).filter(DetallePedido.pedido_id == order_id).all()
        _consumir_insumos_pedido(order_id, detalles, db)

    # --- Always remove old payment records linked to this order (clean slate) ---
    old_links = db.query(PagoPedido).filter(PagoPedido.pedido_id == order_id).all()
    for link in old_links:
        pago = db.query(PagoRecibido).filter(PagoRecibido.id == link.pago_id).first()
        if pago:
            db.delete(pago)
        db.delete(link)
    db.flush()

    # --- Update order fields ---
    db_order.estado = nuevo_estado

    if nuevo_estado == 'pagado' and update_data.medio_pago_id:
        total = float(db_order.total)
        pago = PagoRecibido(
            cliente_id=db_order.cliente_id,
            monto=total,
            medio_pago_id=update_data.medio_pago_id,
            fecha=get_now_colombia()
        )
        db.add(pago)
        db.flush()

        db.add(PagoPedido(pago_id=pago.id, pedido_id=order_id, monto=total))

    db.commit()

    # Auditar cambio de estado — uso de "update" + nota explicativa
    auditar(db, user, "pedido", order_id, "update",
            antes={"estado": prev_estado},
            despues={"estado": nuevo_estado, "medio_pago_id": update_data.medio_pago_id},
            request=request,
            nota=f"estado: {prev_estado} → {nuevo_estado}")

    return {"message": "Status updated", "estado": nuevo_estado}

@router.post("/recalcular-insumos",
             dependencies=[Depends(require_internal_permission("pedidos.editar"))])
def recalcular_insumos_pedidos(db: Session = Depends(get_db)):
    """
    Recalcula el consumo de insumos para todos los pedidos no cancelados
    que aún no tienen movimientos de insumo registrados.
    Útil para sincronizar pedidos creados antes de implementar este control.
    """
    estados_activos = ['pendiente', 'por_cobrar', 'pagado']
    pedidos = db.query(Pedido).filter(Pedido.estado.in_(estados_activos)).all()
    procesados = 0
    for pedido in pedidos:
        ya_tiene_movs = db.query(MovimientoInsumo).filter(
            MovimientoInsumo.origen == 'pedido',
            MovimientoInsumo.referencia_id == pedido.id
        ).first()
        if ya_tiene_movs:
            continue
        detalles = db.query(DetallePedido).filter(DetallePedido.pedido_id == pedido.id).all()
        if detalles:
            _consumir_insumos_pedido(pedido.id, detalles, db)
            procesados += 1
    db.commit()
    return {"ok": True, "pedidos_procesados": procesados}

@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_internal_permission("pedidos.eliminar")),
):
    """Delete an order and its details"""
    db_order = db.query(Pedido).filter(Pedido.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Snapshot ANTES de borrar — el objeto ya no existirá después del delete
    antes = snapshot(db_order)

    # Details will be deleted automatically due to CASCADE
    db.delete(db_order)
    db.commit()

    auditar(db, user, "pedido", order_id, "delete", antes=antes, request=request)

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
    
    # Resolve primary phone and address for WhatsApp copy feature
    cliente_telefono = None
    cliente_direccion = None
    cliente_maps_url = None
    cliente_lat = None
    cliente_lng = None
    cliente_detalles = []

    if cliente:
        from sql_models import ClienteContacto as ClienteDetalle
        detalles = (
            db.query(ClienteDetalle)
            .filter(ClienteDetalle.cliente_id == cliente.id)
            .order_by(ClienteDetalle.es_principal.desc(), ClienteDetalle.id.asc())
            .all()
        )
        if detalles:
            principal = detalles[0]
            cliente_telefono = principal.telefono
            cliente_direccion = principal.direccion
            cliente_maps_url = principal.maps_url or (
                f"https://maps.google.com/?q={principal.lat},{principal.lng}"
                if principal.lat and principal.lng else None
            )
            cliente_lat = float(principal.lat) if principal.lat else None
            cliente_lng = float(principal.lng) if principal.lng else None
        cliente_detalles = [
            {
                "id": d.id,
                "etiqueta": "Principal" if d.es_principal else f"Dirección {i+1}",
                "telefono": d.telefono,
                "direccion": d.direccion,
                "maps_url": d.maps_url or (
                    f"https://maps.google.com/?q={d.lat},{d.lng}" if d.lat and d.lng else None
                ),
                "lat": float(d.lat) if d.lat else None,
                "lng": float(d.lng) if d.lng else None,
                "es_principal": bool(d.es_principal),
            }
            for i, d in enumerate(detalles)
        ]

    # Obtener el medio de pago del último pago registrado para este pedido.
    # Desempate por id DESC: si hay varios pagos en la misma fecha, "último"
    # es el de mayor id (más reciente cronológicamente al haberse insertado).
    ultimo_pago = (
        db.query(PagoRecibido)
        .join(PagoPedido, PagoPedido.pago_id == PagoRecibido.id)
        .filter(PagoPedido.pedido_id == order_id)
        .order_by(PagoRecibido.fecha.desc(), PagoRecibido.id.desc())
        .first()
    )
    medio_pago_id = ultimo_pago.medio_pago_id if ultimo_pago else None
    monto_pagado = float(
        db.query(func.coalesce(func.sum(PagoPedido.monto), 0))
        .filter(PagoPedido.pedido_id == order_id)
        .scalar()
    )

    return {
        "id": order.id,
        "cliente_id": order.cliente_id,
        "cliente_nombre": cliente.nombre if cliente else "Desconocido",
        "cliente_telefono": cliente_telefono,
        "cliente_direccion": cliente_direccion,
        "cliente_maps_url": cliente_maps_url,
        "cliente_lat": cliente_lat,
        "cliente_lng": cliente_lng,
        "cliente_detalles": cliente_detalles,
        "fecha": order.fecha,
        "total": float(order.total),
        "monto_pagado": monto_pagado,
        "valor_domicilio": float(order.valor_domicilio or 0),
        "medio_pago_id": medio_pago_id,
        "estado": order.estado,
        "observaciones": order.observaciones,
        "items": items
    }

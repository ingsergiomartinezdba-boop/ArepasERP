import logging
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Query, status, Depends
from typing import List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from database import get_db
from sql_models import Cliente, Pedido, ClienteContacto, Usuario, PrecioEspecial, Producto, AnalyticsActivacion, AnalyticsSolicitud
from models import Client, ClientCreate, ClientUpdate
from auth import require_permission, require_internal_permission
from utils import get_now_colombia

router = APIRouter()
logger = logging.getLogger(__name__)


def _load_client(client_id: int, db: Session) -> Cliente:
    client = (
        db.query(Cliente)
        .options(joinedload(Cliente.contactos))
        .filter(Cliente.id == client_id)
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


def _sync_detalles(db: Session, cliente_id: int, detalles: list):
    """Reemplaza todos los registros de detalle del cliente."""
    db.query(ClienteContacto).filter(ClienteContacto.cliente_id == cliente_id).delete()
    for d in detalles:
        tiene_datos = (d.telefono and d.telefono.strip()) or (d.direccion and d.direccion.strip())
        if not tiene_datos:
            continue
        db.add(ClienteContacto(
            cliente_id=cliente_id,
            telefono=d.telefono.strip() if d.telefono else None,
            direccion=d.direccion.strip() if d.direccion else None,
            lat=d.lat,
            lng=d.lng,
            maps_url=d.maps_url,
            es_principal=d.es_principal or False,
        ))


@router.get("/", response_model=List[Client])
def get_clients(
    skip:  int = Query(0,   ge=0),
    limit: int = Query(200, ge=1, le=1000),
    _: Usuario = Depends(require_internal_permission("clientes.ver")),
    db: Session = Depends(get_db),
):
    clients = (
        db.query(Cliente)
        .options(joinedload(Cliente.contactos))
        .order_by(Cliente.nombre)
        .offset(skip).limit(limit)
        .all()
    )
    return clients


@router.get("/{client_id}", response_model=Client)
def get_client(
    client_id: int,
    _: Usuario = Depends(require_internal_permission("clientes.ver")),
    db: Session = Depends(get_db),
):
    return _load_client(client_id, db)


@router.post("/", response_model=Client, status_code=status.HTTP_201_CREATED)
def create_client(
    client: ClientCreate,
    _: Usuario = Depends(require_internal_permission("clientes.crear")),
    db: Session = Depends(get_db),
):
    try:
        data = client.model_dump(exclude={"detalles"})
        safe_fields = {"tipo_documento", "documento", "nombre", "tipo_cliente", "ciudad",
                       "canal_venta", "condicion_pago", "cupo_credito", "tarifa_domicilio", "mostrar_saldo_whatsapp"}
        data = {k: v for k, v in data.items() if k in safe_fields}

        db_client = Cliente(**data)
        db.add(db_client)
        db.flush()

        _sync_detalles(db, db_client.id, client.detalles or [])
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Error creando cliente: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al crear el cliente")

    return _load_client(db_client.id, db)


@router.put("/{client_id}", response_model=Client)
def update_client(
    client_id: int,
    client: ClientUpdate,
    _: Usuario = Depends(require_internal_permission("clientes.editar")),
    db: Session = Depends(get_db),
):
    db_client = db.query(Cliente).filter(Cliente.id == client_id).first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    try:
        data = client.model_dump(exclude={"detalles"})
        safe_fields = {"tipo_documento", "documento", "nombre", "tipo_cliente", "ciudad",
                       "canal_venta", "condicion_pago", "cupo_credito", "tarifa_domicilio", "mostrar_saldo_whatsapp"}
        for key in safe_fields:
            if key in data:
                setattr(db_client, key, data[key])

        _sync_detalles(db, client_id, client.detalles or [])
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Error actualizando cliente %s: %s", client_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al actualizar el cliente")

    return _load_client(client_id, db)

# ── Precios Especiales ────────────────────────────────────────────────────────

class PrecioClienteItem(BaseModel):
    producto_id:     int
    precio_especial: float = Field(..., ge=0)


@router.get("/{client_id}/precios")
def get_precios_cliente(
    client_id: int,
    _: Usuario = Depends(require_internal_permission("clientes.ver")),
    db: Session = Depends(get_db),
):
    """Devuelve los precios especiales activos del cliente + el precio base de cada producto."""
    rows = (
        db.query(Producto, PrecioEspecial)
        .outerjoin(
            PrecioEspecial,
            (PrecioEspecial.producto_id == Producto.id) &
            (PrecioEspecial.cliente_id  == client_id)   &
            (PrecioEspecial.activo      == True)
        )
        .filter(Producto.activo == True)
        .order_by(Producto.nombre)
        .all()
    )
    return [
        {
            "producto_id":     p.id,
            "producto_nombre": p.nombre,
            "codigo_corto":    p.codigo_corto,
            "precio_base":     float(p.precio),
            "precio_especial": float(pe.precio_especial) if pe else None,
            "tiene_especial":  pe is not None,
        }
        for p, pe in rows
    ]


@router.put("/{client_id}/precios")
def set_precios_cliente(
    client_id: int,
    items: List[PrecioClienteItem],
    _: Usuario = Depends(require_internal_permission("clientes.editar")),
    db: Session = Depends(get_db),
):
    """
    Reemplaza todos los precios especiales del cliente.
    Items vacíos o precio <= 0 eliminan el precio especial del producto.
    """
    if not db.query(Cliente).filter(Cliente.id == client_id).first():
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    producto_ids_enviados = {i.producto_id for i in items if i.precio_especial > 0}

    # Desactivar los que ya no están en la lista
    db.query(PrecioEspecial).filter(
        PrecioEspecial.cliente_id == client_id,
        ~PrecioEspecial.producto_id.in_(producto_ids_enviados) if producto_ids_enviados
        else PrecioEspecial.producto_id.isnot(None)
    ).delete(synchronize_session=False)

    # Upsert los que vienen
    for item in items:
        if item.precio_especial <= 0:
            continue
        pe = db.query(PrecioEspecial).filter(
            PrecioEspecial.cliente_id  == client_id,
            PrecioEspecial.producto_id == item.producto_id,
        ).first()
        if pe:
            pe.precio_especial = item.precio_especial
            pe.activo = True
        else:
            db.add(PrecioEspecial(
                cliente_id      = client_id,
                producto_id     = item.producto_id,
                precio_especial = item.precio_especial,
                activo          = True,
            ))

    db.commit()
    return {"ok": True, "actualizados": len(producto_ids_enviados)}


# ─── Módulo Analítica premium (activar/desactivar) ────────────────────

class AnalyticsActivacionBody(BaseModel):
    dias:          int = Field(30, ge=1, le=365)
    monto:         float = Field(10000, ge=0)
    medio_pago:    Optional[str] = None
    referencia:    Optional[str] = None
    observaciones: Optional[str] = None


@router.post("/{client_id}/analytics/activar")
def activar_analytics(
    client_id: int,
    body: AnalyticsActivacionBody,
    user: Usuario = Depends(require_internal_permission("clientes.analytics_toggle")),
    db: Session = Depends(get_db),
):
    """Activa el módulo analítica para el cliente por `dias` días."""
    cliente = db.query(Cliente).filter(Cliente.id == client_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    ahora   = get_now_colombia()
    fecha_fin = ahora + timedelta(days=body.dias)

    cliente.analytics_enabled      = True
    cliente.analytics_activated_at = ahora
    cliente.analytics_expires_at   = fecha_fin

    db.add(AnalyticsActivacion(
        cliente_id    = client_id,
        activado_por  = user.id,
        fecha_inicio  = ahora,
        fecha_fin     = fecha_fin,
        monto         = body.monto,
        medio_pago    = body.medio_pago,
        referencia    = body.referencia,
        observaciones = body.observaciones,
    ))
    db.commit()
    logger.info("Analytics activado cliente=%s por usuario=%s hasta %s", client_id, user.id, fecha_fin)

    return {
        "ok":           True,
        "cliente_id":   client_id,
        "activated_at": ahora.isoformat(),
        "expires_at":   fecha_fin.isoformat(),
        "dias":         body.dias,
        "monto":        body.monto,
    }


@router.post("/{client_id}/analytics/desactivar")
def desactivar_analytics(
    client_id: int,
    user: Usuario = Depends(require_internal_permission("clientes.analytics_toggle")),
    db: Session = Depends(get_db),
):
    """Desactiva el módulo analítica para el cliente (sin borrar el historial)."""
    cliente = db.query(Cliente).filter(Cliente.id == client_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    cliente.analytics_enabled    = False
    cliente.analytics_expires_at = get_now_colombia()
    db.commit()
    logger.info("Analytics desactivado cliente=%s por usuario=%s", client_id, user.id)
    return {"ok": True, "cliente_id": client_id}


@router.get("/{client_id}/analytics/historial")
def historial_analytics(
    client_id: int,
    _: Usuario = Depends(require_internal_permission("clientes.analytics_toggle")),
    db: Session = Depends(get_db),
):
    """Historial de activaciones/pagos del módulo analítica del cliente."""
    if not db.query(Cliente.id).filter(Cliente.id == client_id).first():
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    rows = (
        db.query(AnalyticsActivacion)
          .filter(AnalyticsActivacion.cliente_id == client_id)
          .order_by(AnalyticsActivacion.fecha_inicio.desc(), AnalyticsActivacion.id.desc())
          .limit(50)
          .all()
    )
    return [
        {
            "id":            r.id,
            "fecha_inicio":  r.fecha_inicio.isoformat() if r.fecha_inicio else None,
            "fecha_fin":     r.fecha_fin.isoformat() if r.fecha_fin else None,
            "monto":         float(r.monto or 0),
            "medio_pago":    r.medio_pago,
            "referencia":    r.referencia,
            "observaciones": r.observaciones,
        }
        for r in rows
    ]


# ─── Solicitudes de activación del módulo analítica ───────────────────

@router.get("/analytics/solicitudes/pendientes-count")
def contar_solicitudes_pendientes(
    _: Usuario = Depends(require_internal_permission("clientes.analytics_toggle")),
    db: Session = Depends(get_db),
):
    """Cantidad de solicitudes pendientes (para el popup/badge en el menú admin)."""
    n = db.query(AnalyticsSolicitud).filter(AnalyticsSolicitud.estado == "pendiente").count()
    return {"pendientes": n}


@router.get("/analytics/solicitudes")
def listar_solicitudes(
    estado: Optional[str] = None,
    _: Usuario = Depends(require_internal_permission("clientes.analytics_toggle")),
    db: Session = Depends(get_db),
):
    """Lista las solicitudes de activación. Opcionalmente filtra por estado."""
    q = (
        db.query(AnalyticsSolicitud, Cliente.nombre, Cliente.documento)
          .join(Cliente, Cliente.id == AnalyticsSolicitud.cliente_id)
    )
    if estado:
        q = q.filter(AnalyticsSolicitud.estado == estado)
    q = q.order_by(AnalyticsSolicitud.fecha_solicitud.desc(), AnalyticsSolicitud.id.desc()).limit(200)
    rows = q.all()

    return [
        {
            "id":              s.id,
            "cliente_id":      s.cliente_id,
            "cliente_nombre":  nombre,
            "cliente_doc":     documento,
            "fecha_solicitud": s.fecha_solicitud.isoformat() if s.fecha_solicitud else None,
            "estado":          s.estado,
            "mensaje":         s.mensaje,
            "notas_admin":     s.notas_admin,
            "fecha_revision":  s.fecha_revision.isoformat() if s.fecha_revision else None,
        }
        for (s, nombre, documento) in rows
    ]


class RevisarSolicitudBody(BaseModel):
    estado:      str = Field(..., pattern="^(revisada|activada|rechazada)$")
    notas_admin: Optional[str] = None


@router.put("/analytics/solicitudes/{sid}")
def revisar_solicitud(
    sid: int,
    body: RevisarSolicitudBody,
    user: Usuario = Depends(require_internal_permission("clientes.analytics_toggle")),
    db: Session = Depends(get_db),
):
    """Marca una solicitud como revisada / activada / rechazada."""
    s = db.query(AnalyticsSolicitud).filter(AnalyticsSolicitud.id == sid).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    s.estado         = body.estado
    s.notas_admin    = body.notas_admin
    s.revisada_por   = user.id
    s.fecha_revision = get_now_colombia()
    db.commit()
    logger.info("Solicitud analytics id=%s estado=%s por usuario=%s", sid, body.estado, user.id)
    return {"ok": True, "id": sid, "estado": body.estado}

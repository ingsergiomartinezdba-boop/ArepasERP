from datetime import datetime, timezone, timedelta
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from sqlalchemy.orm import Session

# Define Colombia Timezone (UTC-5)
COLOMBIA_TZ = timezone(timedelta(hours=-5))

def get_now_colombia() -> datetime:
    """Returns current time in Colombia timezone"""
    return datetime.now(COLOMBIA_TZ)

def to_colombia_time(dt: datetime) -> datetime:
    """Converts a datetime to Colombia timezone"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=COLOMBIA_TZ)
    return dt.astimezone(COLOMBIA_TZ)


def resolver_precio_cliente(cliente_id: int, producto_id: int, precio_base: float, db) -> tuple[float, bool]:
    """
    Devuelve (precio, es_especial).
    Busca en precios_especiales; si no existe usa precio_base.
    """
    from sql_models import PrecioEspecial
    pe = db.query(PrecioEspecial).filter(
        PrecioEspecial.cliente_id  == cliente_id,
        PrecioEspecial.producto_id == producto_id,
        PrecioEspecial.activo      == True,
    ).first()
    if pe:
        return float(pe.precio_especial), True
    return float(precio_base), False

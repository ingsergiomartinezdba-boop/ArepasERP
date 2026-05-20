"""
Catálogo de unidades + helpers de conversión.

Lee `unidades_medida` desde la BD con cache en memoria (TTL configurable).
La cache se refresca automáticamente cuando expira el TTL, o se puede forzar
con `invalidate_cache()` (útil al crear/editar/borrar unidades).

API pública (compatible con el código viejo):
    UNIDADES               -> tuple de códigos activos
    GRUPOS                 -> dict {codigo: [otros códigos del mismo grupo]}
    convertir(c, a, b)     -> convierte c de unidad a → b
    es_unidad_valida(u)    -> bool
    invalidate_cache()     -> fuerza recarga al próximo acceso
"""
from __future__ import annotations
import threading
import time
from typing import Optional

from sqlalchemy.orm import Session

from database import SessionLocal
from sql_models import UnidadMedida


_CACHE_TTL_SEC = 60                       # refresca cada 60s
_cache_lock = threading.RLock()
_cache: dict = {
    "loaded_at": 0.0,
    "unidades":  {},       # {codigo: {grupo, factor_base, nombre}}
    "por_grupo": {},       # {grupo: [codigos]}
}


def _load_from_db(db: Optional[Session] = None) -> None:
    """Recarga la cache desde la BD. Thread-safe."""
    own_session = db is None
    s = db or SessionLocal()
    try:
        rows = s.query(UnidadMedida).filter(UnidadMedida.activo == True).all()
        unidades = {
            r.codigo: {
                "nombre":      r.nombre,
                "grupo":       r.grupo,
                "factor_base": float(r.factor_base),
            }
            for r in rows
        }
        por_grupo: dict[str, list[str]] = {}
        for codigo, info in unidades.items():
            por_grupo.setdefault(info["grupo"], []).append(codigo)

        with _cache_lock:
            _cache["unidades"]  = unidades
            _cache["por_grupo"] = por_grupo
            _cache["loaded_at"] = time.time()
    finally:
        if own_session:
            s.close()


def _ensure_loaded() -> None:
    if time.time() - _cache["loaded_at"] > _CACHE_TTL_SEC:
        _load_from_db()


def invalidate_cache() -> None:
    """Fuerza recarga en el próximo acceso. Llamar después de POST/PUT/DELETE de unidades."""
    with _cache_lock:
        _cache["loaded_at"] = 0.0


# ── API pública ───────────────────────────────────────────────────────────────

def _unidades_dict() -> dict:
    _ensure_loaded()
    return _cache["unidades"]


class _UnidadesList:
    """Wrapper que se comporta como tupla pero refleja la BD en tiempo real."""
    def __iter__(self):
        return iter(_unidades_dict().keys())

    def __contains__(self, item):
        return item in _unidades_dict()

    def __len__(self):
        return len(_unidades_dict())

    def __getitem__(self, i):
        return tuple(_unidades_dict().keys())[i]

    def __repr__(self):
        return repr(tuple(_unidades_dict().keys()))


class _GruposDict:
    """Wrapper que se comporta como dict pero refleja la BD en tiempo real."""
    def __getitem__(self, key):
        _ensure_loaded()
        # Devuelve lista con la unidad pedida primero, luego el resto del mismo grupo
        info = _cache["unidades"].get(key)
        if not info:
            return [key]
        grupo = info["grupo"]
        rest = [c for c in _cache["por_grupo"].get(grupo, []) if c != key]
        return [key, *rest]

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def __contains__(self, key):
        return key in _unidades_dict()


UNIDADES = _UnidadesList()
GRUPOS   = _GruposDict()


def convertir(cantidad: float, desde: str, hasta: str) -> float:
    """Convierte cantidad de unidad `desde` a unidad `hasta` (mismo grupo).

    Fórmula: cantidad × (factor_base_desde / factor_base_hasta).
    Lanza ValueError si las unidades no son compatibles.
    """
    if cantidad is None:
        return cantidad
    if not desde or not hasta:
        return cantidad

    d = desde.lower().strip()
    h = hasta.lower().strip()
    if d == h:
        return cantidad

    u = _unidades_dict()
    info_d = u.get(d)
    info_h = u.get(h)
    if not info_d or not info_h:
        raise ValueError(f"Unidad desconocida: '{desde}' o '{hasta}'")
    if info_d["grupo"] != info_h["grupo"]:
        raise ValueError(f"No se puede convertir de '{desde}' ({info_d['grupo']}) a '{hasta}' ({info_h['grupo']})")

    factor = info_d["factor_base"] / info_h["factor_base"]
    return round(cantidad * factor, 6)


def es_unidad_valida(u: str) -> bool:
    return bool(u) and u.lower().strip() in _unidades_dict()


def get_parametro(clave: str, default=None, tipo: str = "texto"):
    """Lee un valor de parametros_sistema. Cache simple en memoria.

    tipo: 'numero' | 'porcentaje' | 'booleano' | 'hora' | 'texto'
          Determina el casting del retorno.
    """
    s = SessionLocal()
    try:
        from sql_models import ParametroSistema
        row = s.query(ParametroSistema).filter(ParametroSistema.clave == clave).first()
        if not row:
            return default
        v = row.valor
        if tipo in ("numero", "porcentaje"):
            try: return float(v)
            except ValueError: return default
        if tipo == "booleano":
            return v.lower() in ("true", "1", "yes", "si")
        return v
    finally:
        s.close()

"""
Helper de auditoría — registra operaciones sensibles en la tabla `audit_log`.

Diseño:
  - Función `auditar(...)` no lanza excepciones al caller bajo ninguna
    circunstancia. Un fallo de auditoría jamás debe romper la transacción
    funcional. Si la BD de auditoría cae, se loguea y se sigue.
  - Snapshots como JSONB. Se serializan con default=str para tolerar
    Decimal, datetime, date, UUID, etc.
  - Helper opcional `snapshot()` para convertir un modelo SQLAlchemy a dict
    seguro (sin campos sensibles como password_hash).

Uso típico en un router:

    from fastapi import Request
    from audit import auditar, snapshot

    @router.delete("/{id}", status_code=204)
    def borrar_gasto(id: int, request: Request,
                     db: Session = Depends(get_db),
                     user: Usuario = Depends(require_permission("gastos.eliminar"))):
        g = db.query(Gasto).get(id) or _404()
        antes = snapshot(g)
        db.delete(g); db.commit()
        auditar(db, user, "gasto", id, "delete", antes=antes, request=request)
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ── Serialización JSON tolerante ─────────────────────────────────────────────
def _json_default(obj: Any) -> Any:
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, set):
        return list(obj)
    return str(obj)


def _to_jsonb(value: Optional[dict]) -> Optional[str]:
    if value is None:
        return None
    try:
        return json.dumps(value, default=_json_default, ensure_ascii=False)
    except Exception as e:  # noqa: BLE001
        logger.warning("Audit: no se pudo serializar a JSON (%s) — se guarda repr()", e)
        return json.dumps({"_repr": repr(value)[:2000]})


# Campos sensibles que NUNCA se snapshotean
_FIELDS_BLOCKED = {"password_hash", "password", "token", "secret_key", "api_key"}


def snapshot(model: Any) -> Optional[dict]:
    """Convierte un modelo SQLAlchemy (o cualquier objeto con __dict__) a dict
    excluyendo campos sensibles. Devuelve None si no hay nada que snapshotear.
    """
    if model is None:
        return None
    raw = getattr(model, "__dict__", None)
    if not isinstance(raw, dict):
        return None
    out = {}
    for k, v in raw.items():
        if k.startswith("_"):
            continue
        if k.lower() in _FIELDS_BLOCKED:
            continue
        out[k] = v
    return out or None


# ── API principal ────────────────────────────────────────────────────────────
def auditar(
    db: Session,
    user: Any,
    entidad: str,
    entidad_id: Optional[int],
    accion: str,
    *,
    antes: Optional[dict] = None,
    despues: Optional[dict] = None,
    request: Optional[Request] = None,
    nota: Optional[str] = None,
) -> None:
    """Inserta una fila en audit_log. Nunca lanza al caller.

    Args:
        db: sesión SQLAlchemy. Se hace flush + commit propios.
        user: objeto Usuario (o cualquier objeto con .id y .email). Puede ser None
              para acciones de sistema.
        entidad: nombre de la entidad afectada (ej. 'pedido', 'gasto').
        entidad_id: id de la fila afectada. None si no aplica (ej. login).
        accion: una de las definidas en el CHECK de la tabla.
        antes/despues: dicts con el snapshot. Se serializan a JSONB.
        request: fastapi.Request para extraer IP y User-Agent.
        nota: texto libre para acciones que no encajan en antes/después.
    """
    try:
        ip = None
        ua = None
        rid = None
        if request is not None:
            ip = request.client.host if request.client else None
            ua = request.headers.get("user-agent")
            rid_header = request.headers.get("x-request-id")
            if rid_header:
                try:
                    rid = uuid.UUID(rid_header)
                except (ValueError, TypeError):
                    rid = None

        usuario_id = getattr(user, "id", None) if user is not None else None
        usuario_email = getattr(user, "email", None) if user is not None else None

        db.execute(
            text(
                """
                INSERT INTO audit_log
                    (usuario_id, usuario_email, entidad, entidad_id, accion,
                     datos_antes, datos_despues, ip, user_agent, request_id, nota)
                VALUES
                    (:uid, :uemail, :ent, :eid, :acc,
                     CAST(:ant AS jsonb), CAST(:des AS jsonb),
                     :ip, :ua, :rid, :nota)
                """
            ),
            {
                "uid":   usuario_id,
                "uemail": usuario_email,
                "ent":   entidad[:50],
                "eid":   entidad_id,
                "acc":   accion,
                "ant":   _to_jsonb(antes),
                "des":   _to_jsonb(despues),
                "ip":    ip,
                "ua":    (ua or "")[:1000] or None,
                "rid":   str(rid) if rid else None,
                "nota":  (nota or "")[:2000] or None,
            },
        )
        db.commit()
    except Exception as e:  # noqa: BLE001
        # Auditoría no debe romper jamás el flujo de negocio
        logger.error("Audit log failed (entidad=%s accion=%s id=%s): %s",
                     entidad, accion, entidad_id, e)
        try:
            db.rollback()
        except Exception:
            pass

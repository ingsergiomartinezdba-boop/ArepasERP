"""
Configuración general del sistema — ArepasERP.

Este módulo era el dueño de la tabla `configuracion` (clave-valor genérica).
La tabla fue reemplazada por `parametros_sistema` del módulo Parámetros.

Este router se mantiene para no romper los clientes existentes que
consumen /api/config/horario-corte, pero internamente lee/escribe en
`parametros_sistema`.
"""
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from database import get_db
from sql_models import ParametroSistema, Usuario
from auth import require_permission, require_internal_permission

router = APIRouter(tags=["Configuración"])

CLAVE_HORARIO = "horario_corte_pedidos"


class HorarioCorteBody(BaseModel):
    hora: str   # formato "HH:MM"

    @field_validator("hora")
    @classmethod
    def validar_hora(cls, v):
        if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", v):
            raise ValueError("Formato de hora inválido. Use HH:MM (24h)")
        return v


@router.get("/horario-corte")
def get_horario_corte(db: Session = Depends(get_db)):
    """Retorna la hora límite para pedir 'para hoy'.

    Lee desde parametros_sistema. Si el parámetro no existe (escenario raro,
    debería estar seedeado por migration_parametros_v1.sql), devuelve un
    default seguro.
    """
    p = db.query(ParametroSistema).filter(ParametroSistema.clave == CLAVE_HORARIO).first()
    return {"hora": p.valor if p else "15:00"}


@router.put("/horario-corte")
def set_horario_corte(
    body: HorarioCorteBody,
    _: Usuario = Depends(require_internal_permission("configuracion.editar")),
    db: Session = Depends(get_db),
):
    """Actualiza la hora límite. Requiere permiso configuracion.editar."""
    p = db.query(ParametroSistema).filter(ParametroSistema.clave == CLAVE_HORARIO).first()
    if not p:
        raise HTTPException(
            status_code=500,
            detail=("Parámetro 'horario_corte_pedidos' no existe en parametros_sistema. "
                    "Aplicar migration_parametros_v1.sql."),
        )
    p.valor = body.hora
    db.commit()
    return {"hora": body.hora}

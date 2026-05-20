import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from database import get_db
from sql_models import MedioPago, Usuario
from models import Transfer, TransferCreate
from utils import get_now_colombia
from auth import require_internal_permission
from audit import auditar

router = APIRouter(tags=["transfers"])
logger = logging.getLogger(__name__)

TABLE_EXISTS_SQL = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transferencias')"

def _table_exists(db: Session) -> bool:
    return db.execute(text(TABLE_EXISTS_SQL)).scalar()


# ── DEBE ir ANTES de /{id} para que FastAPI no lo confunda ──
@router.get("/balances", dependencies=[Depends(require_internal_permission("transferencias.ver"))])
def get_balances(db: Session = Depends(get_db)):
    """Saldo acumulado por medio de pago (ingresos de pagos - egresos de gastos)."""
    try:
        rows = db.execute(text(
            "SELECT id, nombre, tipo, ingresos, egresos, saldo FROM view_saldos_medios_pago"
        )).fetchall()
        return [
            {"id": r[0], "nombre": r[1], "tipo": r[2],
             "ingresos": float(r[3]), "egresos": float(r[4]), "saldo": float(r[5])}
            for r in rows
        ]
    except Exception as e:
        logger.error("Error fetching balances: %s", e, exc_info=True)
        return []


@router.get("/", response_model=List[Transfer], dependencies=[Depends(require_internal_permission("transferencias.ver"))])
def get_transfers(db: Session = Depends(get_db)):
    if not _table_exists(db):
        return []

    rows = db.execute(text(
        "SELECT t.id, t.origen_id, t.destino_id, t.valor, t.fecha, t.descripcion, "
        "o.nombre AS origen_nombre, d.nombre AS destino_nombre "
        "FROM transferencias t "
        "LEFT JOIN medios_pago o ON o.id = t.origen_id "
        "LEFT JOIN medios_pago d ON d.id = t.destino_id "
        "ORDER BY t.fecha DESC LIMIT 100"
    )).fetchall()

    return [
        {"id": r[0], "origen_id": r[1], "destino_id": r[2],
         "valor": float(r[3]), "fecha": r[4], "descripcion": r[5],
         "origen_nombre": r[6], "destino_nombre": r[7]}
        for r in rows
    ]


@router.post("/", response_model=Transfer)
def create_transfer(
    transfer: TransferCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_internal_permission("transferencias.crear")),
):
    if not _table_exists(db):
        raise HTTPException(status_code=503, detail="Tabla transferencias no existe. Ejecutar migración.")
    try:
        fecha = transfer.fecha or get_now_colombia().date()
        result = db.execute(text(
            "INSERT INTO transferencias (origen_id, destino_id, valor, fecha, descripcion) "
            "VALUES (:o, :d, :v, :f, :desc) RETURNING id"
        ), {"o": transfer.origen_id, "d": transfer.destino_id, "v": transfer.valor,
            "f": fecha, "desc": transfer.descripcion})
        new_id = result.scalar()
        db.commit()

        methods = {m.id: m.nombre for m in db.query(MedioPago).all()}
        auditar(db, user, "transferencia", new_id, "create",
                despues={
                    "origen_id": transfer.origen_id,
                    "destino_id": transfer.destino_id,
                    "valor": float(transfer.valor),
                    "fecha": str(fecha),
                    "descripcion": transfer.descripcion,
                },
                request=request)

        return {
            "id": new_id, "origen_id": transfer.origen_id, "destino_id": transfer.destino_id,
            "valor": float(transfer.valor), "fecha": fecha, "descripcion": transfer.descripcion,
            "origen_nombre": methods.get(transfer.origen_id, "Desconocido"),
            "destino_nombre": methods.get(transfer.destino_id, "Desconocido")
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Error creating transfer: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al registrar la transferencia")


@router.put("/{id}", response_model=Transfer, dependencies=[Depends(require_internal_permission("transferencias.crear"))])
def update_transfer(id: int, transfer: TransferCreate, db: Session = Depends(get_db)):
    if not _table_exists(db):
        raise HTTPException(status_code=503, detail="Tabla transferencias no existe.")

    db.execute(text(
        "UPDATE transferencias SET origen_id=:o, destino_id=:d, valor=:v, descripcion=:desc WHERE id=:id"
    ), {"o": transfer.origen_id, "d": transfer.destino_id, "v": transfer.valor,
        "desc": transfer.descripcion, "id": id})
    db.commit()

    methods = {m.id: m.nombre for m in db.query(MedioPago).all()}
    return {
        "id": id, "origen_id": transfer.origen_id, "destino_id": transfer.destino_id,
        "valor": float(transfer.valor), "fecha": transfer.fecha, "descripcion": transfer.descripcion,
        "origen_nombre": methods.get(transfer.origen_id, "Desconocido"),
        "destino_nombre": methods.get(transfer.destino_id, "Desconocido")
    }


@router.delete("/{id}")
def delete_transfer(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_internal_permission("transferencias.crear")),
):
    if not _table_exists(db):
        raise HTTPException(status_code=503, detail="Tabla transferencias no existe.")

    # Snapshot ANTES de borrar — necesitamos saber qué se borró
    row = db.execute(text(
        "SELECT origen_id, destino_id, valor, fecha, descripcion FROM transferencias WHERE id = :id"
    ), {"id": id}).fetchone()
    antes = None
    if row:
        antes = {
            "origen_id": row[0], "destino_id": row[1],
            "valor": float(row[2]), "fecha": str(row[3]),
            "descripcion": row[4],
        }

    db.execute(text("DELETE FROM transferencias WHERE id = :id"), {"id": id})
    db.commit()

    auditar(db, user, "transferencia", id, "delete", antes=antes, request=request)

    return {"message": "Transfer deleted successfully"}

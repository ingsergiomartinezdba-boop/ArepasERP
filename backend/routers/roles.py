"""
Router RBAC — Roles, Permisos y Usuarios
Endpoints administrativos protegidos por permiso roles.ver / roles.editar / etc.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from sql_models import Rol, Permiso, RolPermiso, Usuario
from models import (
    RolCreate, RolUpdate, RolOut, RolSimple,
    PermisoOut, AsignarPermisosBody,
    UsuarioCreate, UsuarioUpdate, UsuarioOut,
)
from auth import get_current_user, require_permission, require_internal_permission, get_password_hash, get_user_permissions

router = APIRouter()
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# PERMISOS — Solo lectura (los permisos son del sistema)
# ═══════════════════════════════════════════════════════════════

@router.get("/permisos", response_model=List[PermisoOut])
def listar_permisos(
    modulo: Optional[str] = Query(None),
    _: Usuario = Depends(require_internal_permission("roles.ver")),
    db: Session = Depends(get_db),
):
    """Retorna todos los permisos del sistema, opcionalmente filtrado por módulo."""
    q = db.query(Permiso)
    if modulo:
        q = q.filter(Permiso.modulo == modulo)
    return q.order_by(Permiso.modulo, Permiso.accion).all()


# ═══════════════════════════════════════════════════════════════
# ROLES — CRUD
# ═══════════════════════════════════════════════════════════════

@router.get("/", response_model=List[RolSimple])
def listar_roles(
    _: Usuario = Depends(require_internal_permission("roles.ver")),
    db: Session = Depends(get_db),
):
    return db.query(Rol).order_by(Rol.nombre).all()


@router.get("/{rol_id}", response_model=RolOut)
def obtener_rol(
    rol_id: int,
    _: Usuario = Depends(require_internal_permission("roles.ver")),
    db: Session = Depends(get_db),
):
    rol = db.query(Rol).options(joinedload(Rol.permisos)).filter(Rol.id == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return rol


@router.post("/", response_model=RolOut, status_code=status.HTTP_201_CREATED)
def crear_rol(
    body: RolCreate,
    _: Usuario = Depends(require_internal_permission("roles.crear")),
    db: Session = Depends(get_db),
):
    if db.query(Rol).filter(Rol.nombre == body.nombre).first():
        raise HTTPException(status_code=400, detail="Ya existe un rol con ese nombre")
    rol = Rol(**body.model_dump())
    db.add(rol)
    db.commit()
    db.refresh(rol)
    return rol


@router.put("/{rol_id}", response_model=RolOut)
def actualizar_rol(
    rol_id: int,
    body: RolUpdate,
    _: Usuario = Depends(require_internal_permission("roles.editar")),
    db: Session = Depends(get_db),
):
    rol = db.query(Rol).filter(Rol.id == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    data = body.model_dump(exclude_unset=True)
    if "nombre" in data and data["nombre"] != rol.nombre:
        if db.query(Rol).filter(Rol.nombre == data["nombre"]).first():
            raise HTTPException(status_code=400, detail="Nombre de rol ya en uso")

    for k, v in data.items():
        setattr(rol, k, v)
    db.commit()
    db.refresh(rol)
    # Reload permisos
    return db.query(Rol).options(joinedload(Rol.permisos)).filter(Rol.id == rol_id).first()


@router.delete("/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_rol(
    rol_id: int,
    _: Usuario = Depends(require_internal_permission("roles.eliminar")),
    db: Session = Depends(get_db),
):
    rol = db.query(Rol).filter(Rol.id == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    # Verificar que no tenga usuarios asignados
    usuarios_con_rol = db.query(Usuario).filter(Usuario.rol_id == rol_id).count()
    if usuarios_con_rol > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: {usuarios_con_rol} usuario(s) tienen este rol asignado"
        )
    db.delete(rol)
    db.commit()


# ═══════════════════════════════════════════════════════════════
# PERMISOS DE UN ROL — Gestión
# ═══════════════════════════════════════════════════════════════

@router.get("/{rol_id}/permisos", response_model=List[PermisoOut])
def permisos_del_rol(
    rol_id: int,
    _: Usuario = Depends(require_internal_permission("roles.ver")),
    db: Session = Depends(get_db),
):
    rol = db.query(Rol).options(joinedload(Rol.permisos)).filter(Rol.id == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return rol.permisos


@router.put("/{rol_id}/permisos", response_model=RolOut)
def asignar_permisos(
    rol_id: int,
    body: AsignarPermisosBody,
    _: Usuario = Depends(require_internal_permission("roles.editar")),
    db: Session = Depends(get_db),
):
    """
    Reemplaza todos los permisos del rol por los indicados en permiso_ids.
    Enviar lista vacía para quitar todos los permisos.
    """
    rol = db.query(Rol).filter(Rol.id == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    # Validar que todos los permiso_ids existen
    if body.permiso_ids:
        count = db.query(Permiso).filter(Permiso.id.in_(body.permiso_ids)).count()
        if count != len(body.permiso_ids):
            raise HTTPException(status_code=400, detail="Uno o más permisos no existen")

    # Eliminar asignaciones actuales
    db.query(RolPermiso).filter(RolPermiso.rol_id == rol_id).delete()

    # Insertar nuevas
    for pid in body.permiso_ids:
        db.add(RolPermiso(rol_id=rol_id, permiso_id=pid))

    db.commit()
    return db.query(Rol).options(joinedload(Rol.permisos)).filter(Rol.id == rol_id).first()


@router.post("/{rol_id}/permisos/{permiso_id}", status_code=status.HTTP_201_CREATED)
def agregar_permiso(
    rol_id: int,
    permiso_id: int,
    _: Usuario = Depends(require_internal_permission("roles.editar")),
    db: Session = Depends(get_db),
):
    """Agrega un permiso específico a un rol (sin afectar el resto)."""
    if not db.query(Rol).filter(Rol.id == rol_id).first():
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    if not db.query(Permiso).filter(Permiso.id == permiso_id).first():
        raise HTTPException(status_code=404, detail="Permiso no encontrado")

    exists = db.query(RolPermiso).filter_by(rol_id=rol_id, permiso_id=permiso_id).first()
    if not exists:
        db.add(RolPermiso(rol_id=rol_id, permiso_id=permiso_id))
        db.commit()
    return {"ok": True}


@router.delete("/{rol_id}/permisos/{permiso_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_permiso(
    rol_id: int,
    permiso_id: int,
    _: Usuario = Depends(require_internal_permission("roles.editar")),
    db: Session = Depends(get_db),
):
    """Quita un permiso específico de un rol."""
    deleted = db.query(RolPermiso).filter_by(rol_id=rol_id, permiso_id=permiso_id).delete()
    db.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")


# ═══════════════════════════════════════════════════════════════
# USUARIOS — CRUD administrativo
# ═══════════════════════════════════════════════════════════════

@router.get("/usuarios/", response_model=List[UsuarioOut])
def listar_usuarios(
    _: Usuario = Depends(require_internal_permission("usuarios.ver")),
    db: Session = Depends(get_db),
):
    usuarios = db.query(Usuario).options(joinedload(Usuario.rol_obj)).order_by(Usuario.nombre).all()
    result = []
    for u in usuarios:
        permisos = get_user_permissions(u, db)
        out = UsuarioOut(
            id=u.id,
            email=u.email,
            nombre=u.nombre,
            rol=u.rol,
            rol_id=u.rol_id,
            cliente_id=u.cliente_id,
            activo=u.activo,
            rol_nombre=u.rol_obj.nombre if u.rol_obj else None,
            permisos=list(permisos),
        )
        result.append(out)
    return result


@router.post("/usuarios/", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    body: UsuarioCreate,
    _: Usuario = Depends(require_internal_permission("usuarios.crear")),
    db: Session = Depends(get_db),
):
    if db.query(Usuario).filter(Usuario.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email ya registrado")

    rol_nombre = "user"
    if body.rol_id:
        rol = db.query(Rol).filter(Rol.id == body.rol_id).first()
        if not rol:
            raise HTTPException(status_code=400, detail="Rol no encontrado")
        rol_nombre = rol.nombre.lower()

    u = Usuario(
        email=body.email,
        nombre=body.nombre,
        password_hash=get_password_hash(body.password),
        rol=rol_nombre,
        rol_id=body.rol_id,
        cliente_id=body.cliente_id,
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    permisos = get_user_permissions(u, db)
    return UsuarioOut(
        id=u.id, email=u.email, nombre=u.nombre,
        rol=u.rol, rol_id=u.rol_id, cliente_id=u.cliente_id, activo=u.activo,
        rol_nombre=u.rol_obj.nombre if u.rol_obj else None,
        permisos=list(permisos),
    )


@router.put("/usuarios/{usuario_id}", response_model=UsuarioOut)
def actualizar_usuario(
    usuario_id: int,
    body: UsuarioUpdate,
    current: Usuario = Depends(require_internal_permission("usuarios.editar")),
    db: Session = Depends(get_db),
):
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    data = body.model_dump(exclude_unset=True)
    if "rol_id" in data and data["rol_id"] is not None:
        rol = db.query(Rol).filter(Rol.id == data["rol_id"]).first()
        if not rol:
            raise HTTPException(status_code=400, detail="Rol no encontrado")

    # Si viene password: hashear y guardar en la columna correcta
    if "password" in data:
        pwd = data.pop("password")
        if pwd:
            u.password_hash = get_password_hash(pwd)

    for k, v in data.items():
        setattr(u, k, v)
    db.commit()
    db.refresh(u)

    # Recargar con relación
    u = db.query(Usuario).options(joinedload(Usuario.rol_obj)).filter(Usuario.id == usuario_id).first()
    permisos = get_user_permissions(u, db)
    return UsuarioOut(
        id=u.id, email=u.email, nombre=u.nombre,
        rol=u.rol, rol_id=u.rol_id, cliente_id=u.cliente_id, activo=u.activo,
        rol_nombre=u.rol_obj.nombre if u.rol_obj else None,
        permisos=list(permisos),
    )


@router.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_usuario(
    usuario_id: int,
    hard: bool = False,
    current: Usuario = Depends(require_internal_permission("usuarios.eliminar")),
    db: Session = Depends(get_db),
):
    """Elimina un usuario.

    Por defecto hace soft-delete (activo=false).
    Con ?hard=true intenta hard-delete; falla 409 si tiene FKs activas.
    """
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if u.id == current.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    if hard:
        from sqlalchemy.exc import IntegrityError
        try:
            db.delete(u)
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail=("Este usuario tiene registros asociados (pedidos, gastos, "
                        "movimientos, etc.) y no se puede borrar físicamente. "
                        "Quitá el parámetro hard=true para hacer un soft-delete."),
            )
    else:
        u.activo = False
        db.commit()

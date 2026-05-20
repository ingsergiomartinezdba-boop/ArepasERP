"""
Router: Parámetros
==================
CRUD de los catálogos parametrizables:
  • /unidades              — unidades de medida (peso/volumen/unidad)
  • /parametros            — parámetros escalares del sistema
  • /tipos-producto        — clasificación de productos
  • /tipos-cliente         — segmentación de clientes

Las filas marcadas con sistema=true no se pueden borrar (pero sí desactivar
o editar nombre/descripción).
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
from sql_models import (
    UnidadMedida, ParametroSistema, TipoProducto, TipoCliente,
    ModuloApp, Categoria, Subcategoria, Gasto,
)
from models import (
    UnidadMedidaCreate, UnidadMedidaUpdate, UnidadMedidaResponse,
    ParametroSistemaCreate, ParametroSistemaUpdate, ParametroSistemaResponse,
    TipoProductoCreate, TipoProductoUpdate, TipoProductoResponse,
    TipoClienteCreate, TipoClienteUpdate, TipoClienteResponse,
    ModuloAppResponse,
    CategoriaCreate, CategoriaUpdate, CategoriaResponse,
    SubcategoriaCreate, SubcategoriaUpdate, SubcategoriaResponse,
)
from units import invalidate_cache as invalidate_unidades_cache

# Protección de permisos:
#   - Lectura (GET): se aplica a nivel de router en main.py (parametros.ver)
#   - Escritura (POST/PUT/DELETE): se chequea por endpoint (parametros.editar)
from auth import require_internal_permission as _rp
from sql_models import Usuario as _U

router = APIRouter(tags=["parametros"])


# ─────────────────────────────────────────────────────────────────────────────
# UNIDADES DE MEDIDA
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/unidades", response_model=List[UnidadMedidaResponse])
def list_unidades(activo: Optional[bool] = None, db: Session = Depends(get_db)):
    q = db.query(UnidadMedida).order_by(UnidadMedida.grupo, UnidadMedida.codigo)
    if activo is not None:
        q = q.filter(UnidadMedida.activo == activo)
    return q.all()


@router.post("/unidades", response_model=UnidadMedidaResponse, status_code=201, dependencies=[Depends(_rp("parametros.editar"))])
def crear_unidad(data: UnidadMedidaCreate, db: Session = Depends(get_db)):
    if db.query(UnidadMedida).filter(UnidadMedida.codigo == data.codigo).first():
        raise HTTPException(409, f"Ya existe una unidad con código '{data.codigo}'")
    u = UnidadMedida(**data.model_dump(), sistema=False)
    db.add(u); db.commit(); db.refresh(u)
    invalidate_unidades_cache()
    return u


@router.put("/unidades/{codigo}", response_model=UnidadMedidaResponse, dependencies=[Depends(_rp("parametros.editar"))])
def actualizar_unidad(codigo: str, data: UnidadMedidaUpdate, db: Session = Depends(get_db)):
    u = db.query(UnidadMedida).filter(UnidadMedida.codigo == codigo).first()
    if not u:
        raise HTTPException(404, f"Unidad '{codigo}' no encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(u, k, v)
    db.commit(); db.refresh(u)
    invalidate_unidades_cache()
    return u


@router.delete("/unidades/{codigo}", status_code=204, dependencies=[Depends(_rp("parametros.editar"))])
def eliminar_unidad(codigo: str, db: Session = Depends(get_db)):
    u = db.query(UnidadMedida).filter(UnidadMedida.codigo == codigo).first()
    if not u:
        raise HTTPException(404, "Unidad no encontrada")
    if u.sistema:
        raise HTTPException(400, "No se puede eliminar una unidad del sistema. Desactivala en su lugar.")
    try:
        db.delete(u); db.commit()
        invalidate_unidades_cache()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "La unidad está en uso (insumos, recetas) — no se puede eliminar")


# ─────────────────────────────────────────────────────────────────────────────
# PARÁMETROS DEL SISTEMA
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/parametros", response_model=List[ParametroSistemaResponse])
def list_parametros(categoria: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(ParametroSistema).order_by(ParametroSistema.categoria, ParametroSistema.nombre)
    if categoria:
        q = q.filter(ParametroSistema.categoria == categoria)
    return q.all()


@router.get("/parametros/{clave}", response_model=ParametroSistemaResponse)
def get_parametro(clave: str, db: Session = Depends(get_db)):
    p = db.query(ParametroSistema).filter(ParametroSistema.clave == clave).first()
    if not p:
        raise HTTPException(404, f"Parámetro '{clave}' no encontrado")
    return p


@router.post("/parametros", response_model=ParametroSistemaResponse, status_code=201, dependencies=[Depends(_rp("parametros.editar"))])
def crear_parametro(data: ParametroSistemaCreate, db: Session = Depends(get_db)):
    if db.query(ParametroSistema).filter(ParametroSistema.clave == data.clave).first():
        raise HTTPException(409, f"Ya existe un parámetro con clave '{data.clave}'")
    p = ParametroSistema(**data.model_dump(), sistema=False)
    db.add(p); db.commit(); db.refresh(p)
    return p


@router.put("/parametros/{clave}", response_model=ParametroSistemaResponse, dependencies=[Depends(_rp("parametros.editar"))])
def actualizar_parametro(clave: str, data: ParametroSistemaUpdate, db: Session = Depends(get_db)):
    p = db.query(ParametroSistema).filter(ParametroSistema.clave == clave).first()
    if not p:
        raise HTTPException(404, "Parámetro no encontrado")

    nuevo_valor = data.valor if data.valor is not None else p.valor

    # Validación según tipo
    if data.valor is not None:
        if p.tipo in ("numero", "porcentaje"):
            try:
                num = float(nuevo_valor)
            except ValueError:
                raise HTTPException(400, f"Valor '{nuevo_valor}' no es un número válido")
            if p.min_valor is not None and num < float(p.min_valor):
                raise HTTPException(400, f"Valor mínimo permitido: {p.min_valor}")
            if p.max_valor is not None and num > float(p.max_valor):
                raise HTTPException(400, f"Valor máximo permitido: {p.max_valor}")
        elif p.tipo == "booleano" and nuevo_valor.lower() not in ("true", "false", "1", "0"):
            raise HTTPException(400, "Valor booleano debe ser true/false/1/0")
        elif p.tipo == "hora":
            import re
            if not re.match(r"^\d{1,2}:\d{2}$", nuevo_valor):
                raise HTTPException(400, "Formato hora inválido (HH:MM)")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return p


@router.delete("/parametros/{clave}", status_code=204, dependencies=[Depends(_rp("parametros.editar"))])
def eliminar_parametro(clave: str, db: Session = Depends(get_db)):
    p = db.query(ParametroSistema).filter(ParametroSistema.clave == clave).first()
    if not p:
        raise HTTPException(404, "Parámetro no encontrado")
    if p.sistema:
        raise HTTPException(400, "No se puede eliminar un parámetro del sistema")
    db.delete(p); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# TIPOS DE PRODUCTO
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tipos-producto", response_model=List[TipoProductoResponse])
def list_tipos_producto(activo: Optional[bool] = None, db: Session = Depends(get_db)):
    q = db.query(TipoProducto).order_by(TipoProducto.orden, TipoProducto.codigo)
    if activo is not None:
        q = q.filter(TipoProducto.activo == activo)
    return q.all()


@router.post("/tipos-producto", response_model=TipoProductoResponse, status_code=201, dependencies=[Depends(_rp("parametros.editar"))])
def crear_tipo_producto(data: TipoProductoCreate, db: Session = Depends(get_db)):
    if db.query(TipoProducto).filter(TipoProducto.codigo == data.codigo).first():
        raise HTTPException(409, f"Ya existe un tipo con código '{data.codigo}'")
    t = TipoProducto(**data.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return t


@router.put("/tipos-producto/{codigo}", response_model=TipoProductoResponse, dependencies=[Depends(_rp("parametros.editar"))])
def actualizar_tipo_producto(codigo: str, data: TipoProductoUpdate, db: Session = Depends(get_db)):
    t = db.query(TipoProducto).filter(TipoProducto.codigo == codigo).first()
    if not t:
        raise HTTPException(404, "Tipo de producto no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit(); db.refresh(t)
    return t


@router.delete("/tipos-producto/{codigo}", status_code=204, dependencies=[Depends(_rp("parametros.editar"))])
def eliminar_tipo_producto(codigo: str, db: Session = Depends(get_db)):
    t = db.query(TipoProducto).filter(TipoProducto.codigo == codigo).first()
    if not t:
        raise HTTPException(404, "Tipo de producto no encontrado")
    db.delete(t); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# TIPOS DE CLIENTE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tipos-cliente", response_model=List[TipoClienteResponse])
def list_tipos_cliente(activo: Optional[bool] = None, db: Session = Depends(get_db)):
    q = db.query(TipoCliente).order_by(TipoCliente.orden, TipoCliente.codigo)
    if activo is not None:
        q = q.filter(TipoCliente.activo == activo)
    return q.all()


@router.post("/tipos-cliente", response_model=TipoClienteResponse, status_code=201, dependencies=[Depends(_rp("parametros.editar"))])
def crear_tipo_cliente(data: TipoClienteCreate, db: Session = Depends(get_db)):
    if db.query(TipoCliente).filter(TipoCliente.codigo == data.codigo).first():
        raise HTTPException(409, f"Ya existe un tipo con código '{data.codigo}'")
    t = TipoCliente(**data.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return t


@router.put("/tipos-cliente/{codigo}", response_model=TipoClienteResponse, dependencies=[Depends(_rp("parametros.editar"))])
def actualizar_tipo_cliente(codigo: str, data: TipoClienteUpdate, db: Session = Depends(get_db)):
    t = db.query(TipoCliente).filter(TipoCliente.codigo == codigo).first()
    if not t:
        raise HTTPException(404, "Tipo de cliente no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit(); db.refresh(t)
    return t


@router.delete("/tipos-cliente/{codigo}", status_code=204, dependencies=[Depends(_rp("parametros.editar"))])
def eliminar_tipo_cliente(codigo: str, db: Session = Depends(get_db)):
    t = db.query(TipoCliente).filter(TipoCliente.codigo == codigo).first()
    if not t:
        raise HTTPException(404, "Tipo de cliente no encontrado")
    db.delete(t); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULOS — catálogo de módulos que pueden tener categorías propias
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/modulos", response_model=List[ModuloAppResponse])
def list_modulos(activo: Optional[bool] = None, db: Session = Depends(get_db)):
    q = db.query(ModuloApp).order_by(ModuloApp.orden, ModuloApp.codigo)
    if activo is not None:
        q = q.filter(ModuloApp.activo == activo)
    return q.all()


# ─────────────────────────────────────────────────────────────────────────────
# CATEGORÍAS GENÉRICAS — reutilizables por cualquier módulo
# ─────────────────────────────────────────────────────────────────────────────

def _subcategoria_to_dict(s: Subcategoria) -> dict:
    return {
        "id": s.id, "categoria_id": s.categoria_id, "nombre": s.nombre,
        "icono": s.icono, "color": s.color, "activo": s.activo,
        "sistema": s.sistema, "orden": s.orden,
        "metadata_json": s.metadata_json,
        "created_at": s.created_at,
    }


def _categoria_to_dict(c: Categoria, include_subs: bool = True) -> dict:
    d = {
        "id": c.id,
        "modulo_codigo": c.modulo_codigo,
        "nombre": c.nombre,
        "tipo": c.tipo,
        "tipo_costo": c.tipo_costo,
        "icono": c.icono,
        "color": c.color,
        "activo": c.activo,
        "sistema": c.sistema,
        "orden": c.orden,
        "metadata_json": c.metadata_json,
        "created_at": c.created_at,
        "subcategorias": [],
    }
    if include_subs:
        d["subcategorias"] = [_subcategoria_to_dict(s) for s in c.subcategorias]
    return d


@router.get("/categorias", response_model=List[CategoriaResponse])
def list_categorias(
    modulo: Optional[str] = None,
    activo: Optional[bool] = None,
    include_subs: bool = True,
    db: Session = Depends(get_db),
):
    """
    Lista categorías del módulo solicitado. Si `modulo` no se especifica,
    devuelve todas las categorías de todos los módulos.
    """
    from sqlalchemy.orm import selectinload
    q = db.query(Categoria)
    if include_subs:
        q = q.options(selectinload(Categoria.subcategorias))
    q = q.order_by(Categoria.modulo_codigo, Categoria.orden, Categoria.nombre)
    if modulo:
        q = q.filter(Categoria.modulo_codigo == modulo)
    if activo is not None:
        q = q.filter(Categoria.activo == activo)
    return [_categoria_to_dict(c, include_subs=include_subs) for c in q.all()]


@router.post("/categorias", response_model=CategoriaResponse, status_code=201, dependencies=[Depends(_rp("parametros.editar"))])
def crear_categoria(data: CategoriaCreate, db: Session = Depends(get_db)):
    # Validar módulo
    if not db.query(ModuloApp).filter(ModuloApp.codigo == data.modulo_codigo).first():
        raise HTTPException(404, f"Módulo '{data.modulo_codigo}' no existe en modulos_app")
    # Validar unicidad (modulo_codigo, nombre)
    if db.query(Categoria).filter(
        Categoria.modulo_codigo == data.modulo_codigo,
        Categoria.nombre == data.nombre,
    ).first():
        raise HTTPException(409, f"Ya existe la categoría '{data.nombre}' en módulo '{data.modulo_codigo}'")
    c = Categoria(**data.model_dump(), sistema=False)
    db.add(c); db.commit(); db.refresh(c)
    return _categoria_to_dict(c)


@router.put("/categorias/{cat_id}", response_model=CategoriaResponse, dependencies=[Depends(_rp("parametros.editar"))])
def actualizar_categoria(cat_id: int, data: CategoriaUpdate, db: Session = Depends(get_db)):
    c = db.query(Categoria).filter(Categoria.id == cat_id).first()
    if not c:
        raise HTTPException(404, "Categoría no encontrada")
    payload = data.model_dump(exclude_unset=True)
    if c.sistema and "nombre" in payload and payload["nombre"] != c.nombre:
        raise HTTPException(400, "No se puede renombrar una categoría del sistema. Cambia icono/color/orden si lo necesitas.")
    if "nombre" in payload and payload["nombre"] != c.nombre:
        dup = db.query(Categoria).filter(
            Categoria.modulo_codigo == c.modulo_codigo,
            Categoria.nombre == payload["nombre"],
            Categoria.id != cat_id,
        ).first()
        if dup:
            raise HTTPException(409, f"Ya existe '{payload['nombre']}' en módulo '{c.modulo_codigo}'")
    for k, v in payload.items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return _categoria_to_dict(c)


@router.delete("/categorias/{cat_id}", status_code=204, dependencies=[Depends(_rp("parametros.editar"))])
def eliminar_categoria(cat_id: int, db: Session = Depends(get_db)):
    """Eliminación protegida: bloqueada si la categoría es sistema o tiene registros asociados."""
    c = db.query(Categoria).filter(Categoria.id == cat_id).first()
    if not c:
        raise HTTPException(404, "Categoría no encontrada")
    if c.sistema:
        raise HTTPException(400, "No se puede eliminar una categoría del sistema. Desactívala en su lugar.")
    # Si es del módulo gastos, verificar que no tenga gastos asociados
    if c.modulo_codigo == "gastos":
        en_uso = db.query(Gasto.id).filter(Gasto.categoria_id == cat_id).first()
        if en_uso:
            raise HTTPException(
                409,
                "La categoría tiene gastos históricos asociados. Desactívala en lugar de eliminarla.",
            )
    try:
        db.delete(c); db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "No se puede eliminar: la categoría está en uso.")


# ─────────────────────────────────────────────────────────────────────────────
# SUBCATEGORÍAS GENÉRICAS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/subcategorias", response_model=List[SubcategoriaResponse])
def list_subcategorias(
    categoria_id: Optional[int] = None,
    modulo: Optional[str] = None,
    activo: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Subcategoria).join(Categoria, Subcategoria.categoria_id == Categoria.id)
    q = q.order_by(Subcategoria.categoria_id, Subcategoria.orden, Subcategoria.nombre)
    if categoria_id is not None:
        q = q.filter(Subcategoria.categoria_id == categoria_id)
    if modulo:
        q = q.filter(Categoria.modulo_codigo == modulo)
    if activo is not None:
        q = q.filter(Subcategoria.activo == activo)
    return [_subcategoria_to_dict(s) for s in q.all()]


@router.post("/subcategorias", response_model=SubcategoriaResponse, status_code=201, dependencies=[Depends(_rp("parametros.editar"))])
def crear_subcategoria(data: SubcategoriaCreate, db: Session = Depends(get_db)):
    cat = db.query(Categoria).filter(Categoria.id == data.categoria_id).first()
    if not cat:
        raise HTTPException(404, "Categoría padre no encontrada")
    if db.query(Subcategoria).filter(
        Subcategoria.categoria_id == data.categoria_id,
        Subcategoria.nombre == data.nombre,
    ).first():
        raise HTTPException(409, f"Ya existe la subcategoría '{data.nombre}' en esta categoría")
    s = Subcategoria(**data.model_dump(), sistema=False)
    db.add(s); db.commit(); db.refresh(s)
    return _subcategoria_to_dict(s)


@router.put("/subcategorias/{sub_id}", response_model=SubcategoriaResponse, dependencies=[Depends(_rp("parametros.editar"))])
def actualizar_subcategoria(sub_id: int, data: SubcategoriaUpdate, db: Session = Depends(get_db)):
    s = db.query(Subcategoria).filter(Subcategoria.id == sub_id).first()
    if not s:
        raise HTTPException(404, "Subcategoría no encontrada")
    payload = data.model_dump(exclude_unset=True)
    if s.sistema and "nombre" in payload and payload["nombre"] != s.nombre:
        raise HTTPException(400, "No se puede renombrar una subcategoría del sistema.")
    if "nombre" in payload and payload["nombre"] != s.nombre:
        dup = db.query(Subcategoria).filter(
            Subcategoria.categoria_id == s.categoria_id,
            Subcategoria.nombre == payload["nombre"],
            Subcategoria.id != sub_id,
        ).first()
        if dup:
            raise HTTPException(409, f"Ya existe la subcategoría '{payload['nombre']}' en esta categoría")
    for k, v in payload.items():
        setattr(s, k, v)
    db.commit(); db.refresh(s)
    return _subcategoria_to_dict(s)


@router.delete("/subcategorias/{sub_id}", status_code=204, dependencies=[Depends(_rp("parametros.editar"))])
def eliminar_subcategoria(sub_id: int, db: Session = Depends(get_db)):
    s = db.query(Subcategoria).filter(Subcategoria.id == sub_id).first()
    if not s:
        raise HTTPException(404, "Subcategoría no encontrada")
    if s.sistema:
        raise HTTPException(400, "No se puede eliminar una subcategoría del sistema. Desactívala.")
    # ON DELETE SET NULL en gastos.subcategoria_id desvincula pero no destruye gastos históricos
    db.delete(s); db.commit()

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime

# ── Auth ──────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str

# ── RBAC — Permisos ───────────────────────────────────────────

class PermisoOut(BaseModel):
    id:          int
    codigo:      str
    descripcion: Optional[str]
    modulo:      str
    accion:      str

    class Config:
        from_attributes = True

# ── RBAC — Roles ──────────────────────────────────────────────

class RolCreate(BaseModel):
    nombre:      str = Field(..., min_length=2, max_length=50)
    descripcion: Optional[str] = None
    activo:      bool = True

class RolUpdate(BaseModel):
    nombre:      Optional[str] = Field(None, min_length=2, max_length=50)
    descripcion: Optional[str] = None
    activo:      Optional[bool] = None

class RolOut(BaseModel):
    id:          int
    nombre:      str
    descripcion: Optional[str]
    activo:      bool
    permisos:    List[PermisoOut] = []

    class Config:
        from_attributes = True

class RolSimple(BaseModel):
    """Versión sin permisos anidados — para listas."""
    id:          int
    nombre:      str
    descripcion: Optional[str]
    activo:      bool

    class Config:
        from_attributes = True

class AsignarPermisosBody(BaseModel):
    permiso_ids: List[int]

# ── RBAC — Usuarios ───────────────────────────────────────────

class UsuarioCreate(BaseModel):
    email:      str = Field(..., max_length=255)
    nombre:     str = Field(..., min_length=2, max_length=100)
    password:   str = Field(..., min_length=6)
    rol_id:     Optional[int] = None
    cliente_id: Optional[int] = None

class UsuarioUpdate(BaseModel):
    nombre:     Optional[str] = Field(None, min_length=2, max_length=100)
    password:   Optional[str] = Field(None, min_length=6, max_length=72)
    rol_id:     Optional[int] = None
    cliente_id: Optional[int] = None
    activo:     Optional[bool] = None

class UsuarioOut(BaseModel):
    id:         int
    email:      str
    nombre:     str
    rol:        str            # legacy string
    rol_id:     Optional[int]
    cliente_id: Optional[int] = None
    activo:     bool
    rol_nombre: Optional[str] = None
    permisos:   List[str] = []  # lista de codigos — para el frontend

    class Config:
        from_attributes = True

# --- Suppliers ---

class SupplierBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    contacto: Optional[str] = Field(None, max_length=255)
    telefono: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=255)
    direccion: Optional[str] = Field(None, max_length=500)
    activo: Optional[bool] = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(SupplierBase):
    pass

class Supplier(SupplierBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Clients ---

class ClienteDetalleSchema(BaseModel):
    """Un registro de contacto del cliente (teléfono y/o dirección)."""
    id: Optional[int] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    maps_url: Optional[str] = None
    es_principal: Optional[bool] = False

    class Config:
        from_attributes = True


_CONDICION_PAGO_VALID = {"contado", "credito"}
_TIPO_DOC_VALID       = {"CC", "NIT", "CE", "PP", "otro"}

class ClientBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    documento: Optional[str] = Field(None, max_length=30)
    tipo_documento: Optional[str] = Field(None, max_length=10)
    tipo_cliente: Optional[str] = Field(None, max_length=50)
    ciudad: Optional[str] = Field("Bogotá", max_length=100)
    canal_venta: Optional[str] = Field(None, max_length=50)
    condicion_pago: Optional[str] = Field("contado", max_length=20)
    cupo_credito: Optional[float] = Field(0, ge=0, le=100_000_000)
    tarifa_domicilio: Optional[float] = Field(0, ge=0, le=1_000_000)
    mostrar_saldo_whatsapp: Optional[bool] = True

    @field_validator("condicion_pago")
    @classmethod
    def validate_condicion_pago(cls, v):
        if v and v not in _CONDICION_PAGO_VALID:
            raise ValueError(f"condicion_pago debe ser uno de: {_CONDICION_PAGO_VALID}")
        return v


class ClientCreate(ClientBase):
    detalles: Optional[List[ClienteDetalleSchema]] = []


class ClientUpdate(ClientBase):
    detalles: Optional[List[ClienteDetalleSchema]] = []


class Client(ClientBase):
    id: int
    created_at: Optional[datetime] = None
    detalles: List[ClienteDetalleSchema] = []
    analytics_enabled: Optional[bool] = False
    analytics_activated_at: Optional[datetime] = None
    analytics_expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Products ---

class ProductBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    codigo_corto: Optional[str] = Field(None, max_length=20)
    tipo_producto: Optional[str] = Field(None, max_length=50)
    precio: float = Field(0, ge=0, le=100_000_000)
    costo: float = Field(0, ge=0, le=100_000_000)
    activo: Optional[bool] = True

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Price Rules ---

class PriceRuleBase(BaseModel):
    cliente_id: int
    producto_id: int
    precio_especial: float
    activo: Optional[bool] = True

class PriceRuleCreate(PriceRuleBase):
    pass

class PriceRule(PriceRuleBase):
    id: int

    class Config:
        from_attributes = True

# --- Orders ---

class OrderItemCreate(BaseModel):
    producto_id: int
    cantidad: int
    precio: Optional[float] = None

_ESTADO_PEDIDO_VALID = {"pendiente", "pagado", "por_cobrar", "cancelado"}

class OrderCreate(BaseModel):
    cliente_id: int = Field(..., gt=0)
    medio_pago_id: Optional[int] = Field(None, gt=0)
    items: List[OrderItemCreate] = Field(..., min_length=1)
    fecha: Optional[datetime] = None
    valor_domicilio: Optional[float] = Field(0, ge=0, le=1_000_000)
    estado: Optional[str] = Field("pendiente", max_length=20)
    observaciones: Optional[str] = Field(None, max_length=1000)

    @field_validator("estado")
    @classmethod
    def validate_estado(cls, v):
        if v and v not in _ESTADO_PEDIDO_VALID:
            raise ValueError(f"estado debe ser uno de: {_ESTADO_PEDIDO_VALID}")
        return v

class OrderStatusUpdate(BaseModel):
    estado: str = Field(..., max_length=20)
    medio_pago_id: Optional[int] = Field(None, gt=0)

    @field_validator("estado")
    @classmethod
    def validate_estado(cls, v):
        if v not in _ESTADO_PEDIDO_VALID:
            raise ValueError(f"estado debe ser uno de: {_ESTADO_PEDIDO_VALID}")
        return v

class OrderItemResponse(BaseModel):
    id: int
    producto_id: int
    producto_nombre: Optional[str] = None
    cantidad: int
    precio_aplicado: float
    subtotal: float

class ClienteDetalleSimple(BaseModel):
    id: int
    etiqueta: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    maps_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    es_principal: Optional[bool] = False

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    cliente_id: int
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_direccion: Optional[str] = None
    cliente_maps_url: Optional[str] = None
    cliente_lat: Optional[float] = None
    cliente_lng: Optional[float] = None
    cliente_detalles: Optional[List[ClienteDetalleSimple]] = []
    fecha: datetime
    total: float
    monto_pagado: Optional[float] = 0
    valor_domicilio: Optional[float] = 0
    medio_pago_id: Optional[int] = None
    estado: str
    observaciones: Optional[str] = None
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True

# --- Catálogo genérico: módulos + categorías + subcategorías ---

class ModuloAppBase(BaseModel):
    codigo: str = Field(..., min_length=1, max_length=40)
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    icono: Optional[str] = Field(None, max_length=30)
    color: Optional[str] = Field(None, max_length=20)
    activo: bool = True
    orden: int = 0


class ModuloAppResponse(ModuloAppBase):
    sistema: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubcategoriaBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    icono: Optional[str] = Field(None, max_length=30)
    color: Optional[str] = Field(None, max_length=20)
    activo: bool = True
    orden: int = 0
    metadata_json: Optional[dict] = None


class SubcategoriaCreate(SubcategoriaBase):
    categoria_id: int


class SubcategoriaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    icono: Optional[str] = Field(None, max_length=30)
    color: Optional[str] = Field(None, max_length=20)
    activo: Optional[bool] = None
    orden: Optional[int] = None
    metadata_json: Optional[dict] = None


class SubcategoriaResponse(SubcategoriaBase):
    id: int
    categoria_id: int
    sistema: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CategoriaBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    tipo: Optional[str] = Field(None, max_length=50)
    tipo_costo: Optional[str] = None  # directo | indirecto | None (solo módulo 'gastos')
    icono: Optional[str] = Field(None, max_length=30)
    color: Optional[str] = Field(None, max_length=20)
    activo: bool = True
    orden: int = 0
    metadata_json: Optional[dict] = None


class CategoriaCreate(CategoriaBase):
    modulo_codigo: str = Field(..., min_length=1, max_length=40)


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    tipo: Optional[str] = Field(None, max_length=50)
    tipo_costo: Optional[str] = None
    icono: Optional[str] = Field(None, max_length=30)
    color: Optional[str] = Field(None, max_length=20)
    activo: Optional[bool] = None
    orden: Optional[int] = None
    metadata_json: Optional[dict] = None


class CategoriaResponse(CategoriaBase):
    id: int
    modulo_codigo: str
    sistema: bool = False
    created_at: Optional[datetime] = None
    subcategorias: List[SubcategoriaResponse] = []

    class Config:
        from_attributes = True


# --- Expenses ---

class ExpenseBase(BaseModel):
    valor: float
    fecha: date
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    proveedor_id: Optional[int] = None
    medio_pago_id: Optional[int] = None
    insumo_id: Optional[int] = None
    cantidad_insumo: Optional[float] = None
    estado: Optional[str] = 'activo'
    estado_pago: Optional[str] = None  # 'pagado' | 'credito' | 'pendiente' (None = usar default BD)


class ExpenseCreate(ExpenseBase):
    pass


class Expense(ExpenseBase):
    id: int
    created_at: Optional[datetime] = None
    categoria_nombre: Optional[str] = None
    subcategoria_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    insumo_nombre: Optional[str] = None
    # Pago / saldo
    monto_pagado: Optional[float] = 0
    saldo_pendiente: Optional[float] = 0
    estado_pago: Optional[str] = 'pendiente'
    # Auditoría — solo informativa
    created_by: Optional[int] = None
    created_by_nombre: Optional[str] = None
    updated_at: Optional[datetime] = None
    anulado_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GastoAdjuntoResponse(BaseModel):
    id: int
    gasto_id: int
    nombre_archivo: str
    mime_type: Optional[str] = None
    tamano_bytes: int
    subido_por: Optional[int] = None
    subido_por_nombre: Optional[str] = None
    notas: Optional[str] = None
    created_at: Optional[datetime] = None
    download_url: Optional[str] = None

    class Config:
        from_attributes = True


# --- Ingresos Manuales (Cash Flow) ---

class IngresoManualBase(BaseModel):
    valor: float = Field(..., gt=0)
    fecha: date
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    medio_pago_id: Optional[int] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = 'operativo'   # operativo | no_operativo | extraordinario


class IngresoManualCreate(IngresoManualBase):
    pass


class IngresoManualResponse(IngresoManualBase):
    id: int
    estado: Optional[str] = 'activo'
    categoria_nombre: Optional[str] = None
    subcategoria_nombre: Optional[str] = None
    medio_pago_nombre: Optional[str] = None
    created_by: Optional[int] = None
    created_by_nombre: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    anulado_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Payment Methods ---

class PaymentMethodBase(BaseModel):
    nombre: str
    tipo: Optional[str] = None
    activo: Optional[bool] = True

class PaymentMethodCreate(PaymentMethodBase):
    pass

class PaymentMethodUpdate(PaymentMethodBase):
    pass

class PaymentMethod(PaymentMethodBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Transfers ---

class TransferBase(BaseModel):
    origen_id: int
    destino_id: int
    valor: float
    fecha: Optional[date] = None
    descripcion: Optional[str] = None

class TransferCreate(TransferBase):
    pass

class Transfer(TransferBase):
    id: int
    created_at: Optional[datetime] = None
    origen_nombre: Optional[str] = None
    destino_nombre: Optional[str] = None

    class Config:
        from_attributes = True

# --- Payments Received (cxc) ---

class PaymentReceivedCreate(BaseModel):
    cliente_id: int
    monto: float
    fecha: Optional[datetime] = None
    medio_pago_id: Optional[int] = None         # real DB column name

class PaymentReceived(PaymentReceivedCreate):
    id: int

    class Config:
        from_attributes = True

# --- Inventory ---

class InventarioItem(BaseModel):
    producto_id: int
    cantidad: float
    producto_nombre: Optional[str] = None
    tipo_producto: Optional[str] = None

    class Config:
        from_attributes = True


class MovimientoCreate(BaseModel):
    producto_id: int
    tipo: str       # entrada | salida | ajuste
    cantidad: float
    origen: Optional[str] = None
    referencia_id: Optional[int] = None
    fecha: Optional[datetime] = None


class MovimientoResponse(MovimientoCreate):
    id: int
    fecha: datetime
    producto_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class AjusteInventario(BaseModel):
    producto_id: int
    cantidad_nueva: float
    motivo: Optional[str] = None


# --- Lotes de Producción con Costos ---

class LoteInsumoCreate(BaseModel):
    insumo_id: int
    cantidad: float
    unidad_consumo: Optional[str] = None  # unidad en que el usuario ingresó la cantidad


class LoteInsumoResponse(BaseModel):
    id: int
    insumo_id: Optional[int] = None
    insumo_nombre: Optional[str] = None
    cantidad: float           # ya convertida a unidad base del insumo
    cantidad_original: Optional[float] = None   # como la ingresó el usuario
    unidad_consumo: Optional[str] = None        # unidad original del usuario
    unidad_medida: Optional[str] = None         # unidad base del insumo
    costo_unitario_snapshot: float = 0
    costo_linea: float = 0

    class Config:
        from_attributes = True


class LoteProduccionCreate(BaseModel):
    producto_final_id: Optional[int] = None
    cantidad_producida: int
    insumos: List[LoteInsumoCreate]
    observaciones: Optional[str] = None
    fecha: Optional[datetime] = None


class LoteProduccionResponse(BaseModel):
    id: int
    fecha: datetime
    producto_final_id: Optional[int] = None
    producto_final_nombre: Optional[str] = None
    cantidad_producida: int
    costo_total: float
    costo_por_unidad: float
    observaciones: Optional[str] = None
    insumos_usados: List[LoteInsumoResponse] = []

    class Config:
        from_attributes = True


# --- Recetas de Cocción ---

class RecetaInsumoCreate(BaseModel):
    insumo_id: int
    cantidad: float
    unidad: str


class RecetaInsumoResponse(BaseModel):
    id: int
    insumo_id: int
    insumo_nombre: Optional[str] = None
    cantidad: float
    unidad: str

    class Config:
        from_attributes = True


class RecetaCoccionCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    insumo_salida_id: Optional[int] = None
    masa_salida_kg: float
    insumos: List[RecetaInsumoCreate]


class RecetaCoccionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    insumo_salida_id: Optional[int] = None
    masa_salida_kg: Optional[float] = None
    activa: Optional[bool] = None
    insumos: Optional[List[RecetaInsumoCreate]] = None


class RecetaCoccionResponse(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    insumo_salida_id: Optional[int] = None
    insumo_salida_nombre: Optional[str] = None
    masa_salida_kg: float
    activa: bool
    insumos: List[RecetaInsumoResponse] = []

    class Config:
        from_attributes = True


class EjecutarCoccionCreate(BaseModel):
    receta_id: int
    bultos: float = 1.0
    masa_obtenida_kg: Optional[float] = None   # Si None → receta.masa_salida_kg × bultos
    observaciones: Optional[str] = None
    fecha: Optional[datetime] = None


class CoccionUpdate(BaseModel):
    fecha: Optional[datetime] = None


class CoccionInsumoResponse(BaseModel):
    id: int
    insumo_id: Optional[int] = None
    insumo_nombre: str
    cantidad: float
    unidad: str
    costo_unitario: float = 0
    costo_linea: float = 0

    class Config:
        from_attributes = True


class CoccionResponse(BaseModel):
    id: int
    receta_id: int
    receta_nombre: Optional[str] = None
    bultos: float
    masa_obtenida_kg: float
    costo_total: float = 0
    costo_por_kg: float = 0
    observaciones: Optional[str] = None
    fecha: datetime
    insumos_usados: List[CoccionInsumoResponse] = []

    class Config:
        from_attributes = True


# --- Production ---

class ProduccionProcesoCreate(BaseModel):
    producto_entrada_id: int
    cantidad_entrada_kg: float
    producto_salida_id: int
    cantidad_salida_kg: float
    observaciones: Optional[str] = None
    fecha: Optional[datetime] = None


class ProduccionProcesoResponse(BaseModel):
    id: int
    fecha: datetime
    producto_entrada_id: int
    cantidad_entrada_kg: float
    producto_salida_id: int
    cantidad_salida_kg: float
    rendimiento: Optional[float] = None
    observaciones: Optional[str] = None
    producto_entrada_nombre: Optional[str] = None
    producto_salida_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class ProduccionDetalleCreate(BaseModel):
    producto_final_id: int
    cantidad_producida: int
    producto_consumido_id: int
    cantidad_consumida_kg: float
    fecha: Optional[datetime] = None


class ProduccionDetalleResponse(BaseModel):
    id: int
    fecha: datetime
    producto_final_id: int
    cantidad_producida: int
    producto_consumido_id: int
    cantidad_consumida_kg: float
    producto_final_nombre: Optional[str] = None
    producto_consumido_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# MÓDULO PARÁMETROS — schemas
# ============================================================================

class UnidadMedidaBase(BaseModel):
    codigo:      str = Field(..., min_length=1, max_length=20)
    nombre:      str = Field(..., min_length=1, max_length=80)
    grupo:       str = Field(..., pattern=r"^(peso|volumen|unidad)$")
    factor_base: float = Field(..., gt=0)
    activo:      bool = True


class UnidadMedidaCreate(UnidadMedidaBase):
    pass


class UnidadMedidaUpdate(BaseModel):
    nombre:      Optional[str]   = None
    grupo:       Optional[str]   = None
    factor_base: Optional[float] = None
    activo:      Optional[bool]  = None


class UnidadMedidaResponse(UnidadMedidaBase):
    sistema: bool = False

    class Config:
        from_attributes = True


class ParametroSistemaBase(BaseModel):
    clave:       str = Field(..., min_length=1, max_length=60)
    valor:       str
    tipo:        str = Field(..., pattern=r"^(numero|texto|booleano|porcentaje|hora)$")
    nombre:      str = Field(..., min_length=1, max_length=120)
    descripcion: Optional[str] = None
    categoria:   str = Field(..., min_length=1, max_length=40)
    min_valor:   Optional[float] = None
    max_valor:   Optional[float] = None


class ParametroSistemaCreate(ParametroSistemaBase):
    pass


class ParametroSistemaUpdate(BaseModel):
    valor:       Optional[str]   = None
    nombre:      Optional[str]   = None
    descripcion: Optional[str]   = None
    categoria:   Optional[str]   = None


class ParametroSistemaResponse(ParametroSistemaBase):
    sistema: bool = False

    class Config:
        from_attributes = True


class TipoProductoBase(BaseModel):
    codigo:      str = Field(..., min_length=1, max_length=30)
    nombre:      str = Field(..., min_length=1, max_length=80)
    descripcion: Optional[str] = None
    color:       Optional[str] = None
    icono:       Optional[str] = None
    activo:      bool = True
    orden:       int  = 0


class TipoProductoCreate(TipoProductoBase):
    pass


class TipoProductoUpdate(BaseModel):
    nombre:      Optional[str]  = None
    descripcion: Optional[str]  = None
    color:       Optional[str]  = None
    icono:       Optional[str]  = None
    activo:      Optional[bool] = None
    orden:       Optional[int]  = None


class TipoProductoResponse(TipoProductoBase):
    class Config:
        from_attributes = True


class TipoClienteBase(BaseModel):
    codigo:      str = Field(..., min_length=1, max_length=30)
    nombre:      str = Field(..., min_length=1, max_length=80)
    descripcion: Optional[str] = None
    color:       Optional[str] = None
    activo:      bool = True
    orden:       int  = 0


class TipoClienteCreate(TipoClienteBase):
    pass


class TipoClienteUpdate(BaseModel):
    nombre:      Optional[str]  = None
    descripcion: Optional[str]  = None
    color:       Optional[str]  = None
    activo:      Optional[bool] = None
    orden:       Optional[int]  = None


class TipoClienteResponse(TipoClienteBase):
    class Config:
        from_attributes = True

"""
ORM Models — ArepasERP
Schema normalizado v4 (3FN)

Alineado con: database/schema_normalizado_v4.sql
Denormalizaciones intencionadas documentadas con [DENORM].
Snapshots documentados con [SNAPSHOT].
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey,
    Numeric, DateTime, Date, Text, UniqueConstraint,
    CheckConstraint, Computed,
)
from sqlalchemy.dialects.postgresql import JSONB as JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# =========================================
# CATÁLOGOS / TABLAS MAESTRAS
# =========================================

# =========================================
# RBAC — Roles y Permisos
# =========================================

class Permiso(Base):
    __tablename__ = "permisos"

    id          = Column(Integer, primary_key=True, index=True)
    codigo      = Column(String(100), unique=True, nullable=False)  # "clientes.ver"
    descripcion = Column(Text)
    modulo      = Column(String(50), nullable=False)
    accion      = Column(String(30), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    roles = relationship("Rol", secondary="roles_permisos", back_populates="permisos")


class Rol(Base):
    __tablename__ = "roles"

    id          = Column(Integer, primary_key=True, index=True)
    nombre      = Column(String(50), unique=True, nullable=False)
    descripcion = Column(Text)
    activo      = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    permisos  = relationship("Permiso", secondary="roles_permisos", back_populates="roles")
    usuarios  = relationship("Usuario", back_populates="rol_obj")


class RolPermiso(Base):
    """Tabla junction M:N entre roles y permisos."""
    __tablename__ = "roles_permisos"

    rol_id     = Column(Integer, ForeignKey("roles.id",    ondelete="CASCADE"), primary_key=True)
    permiso_id = Column(Integer, ForeignKey("permisos.id", ondelete="CASCADE"), primary_key=True)


class Usuario(Base):
    __tablename__ = "usuarios"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    nombre        = Column(String(100), nullable=False)
    rol           = Column(String(20), nullable=False, default="user")  # legacy — mantener compatibilidad
    rol_id        = Column(Integer, ForeignKey("roles.id",     ondelete="SET NULL"), nullable=True)
    cliente_id    = Column(Integer, ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True)
    activo        = Column(Boolean, nullable=False, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    rol_obj = relationship("Rol", back_populates="usuarios")


class MedioPago(Base):
    __tablename__ = "medios_pago"

    id            = Column(Integer, primary_key=True, index=True)
    nombre        = Column(String(100), nullable=False, unique=True)
    tipo          = Column(String(30), nullable=False)
    activo        = Column(Boolean, nullable=False, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ModuloApp(Base):
    """Catálogo de módulos del sistema que pueden tener categorías propias."""
    __tablename__ = "modulos_app"

    codigo      = Column(String(40), primary_key=True)
    nombre      = Column(String(100), nullable=False)
    descripcion = Column(Text)
    icono       = Column(String(30))
    color       = Column(String(20))
    activo      = Column(Boolean, nullable=False, default=True)
    sistema     = Column(Boolean, nullable=False, default=False)
    orden       = Column(Integer, nullable=False, default=0)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    categorias = relationship("Categoria", back_populates="modulo")


class Categoria(Base):
    """
    Catálogo genérico de categorías reutilizable por cualquier módulo.
    UNIQUE(modulo_codigo, nombre) — el mismo nombre puede existir en módulos distintos.
    """
    __tablename__ = "categorias"
    __table_args__ = (
        UniqueConstraint("modulo_codigo", "nombre", name="uq_categorias_modulo_nombre"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    modulo_codigo = Column(String(40), ForeignKey("modulos_app.codigo", ondelete="RESTRICT"), nullable=False)
    nombre        = Column(String(100), nullable=False)
    tipo          = Column(String(50), nullable=True)      # semántica por módulo
    tipo_costo    = Column(String(20), nullable=True)      # solo aplica a modulo='gastos'
    icono         = Column(String(30), nullable=True)
    color         = Column(String(20), nullable=True)
    activo        = Column(Boolean, nullable=False, default=True)
    sistema       = Column(Boolean, nullable=False, default=False)
    orden         = Column(Integer, nullable=False, default=0)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    modulo        = relationship("ModuloApp", back_populates="categorias")
    subcategorias = relationship(
        "Subcategoria",
        back_populates="categoria",
        cascade="all, delete-orphan",
        order_by="Subcategoria.orden, Subcategoria.nombre",
    )
    gastos = relationship("Gasto", back_populates="categoria_rel")


class Subcategoria(Base):
    """Subcategoría bajo una Categoria. El módulo se infiere por categoria.modulo_codigo."""
    __tablename__ = "subcategorias"
    __table_args__ = (
        UniqueConstraint("categoria_id", "nombre", name="uq_subcategorias_categoria_nombre"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    categoria_id  = Column(Integer, ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=False)
    nombre        = Column(String(100), nullable=False)
    icono         = Column(String(30), nullable=True)
    color         = Column(String(20), nullable=True)
    activo        = Column(Boolean, nullable=False, default=True)
    sistema       = Column(Boolean, nullable=False, default=False)
    orden         = Column(Integer, nullable=False, default=0)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    categoria = relationship("Categoria", back_populates="subcategorias")


class Proveedor(Base):
    # NOTA 3FN: tipo_insumo eliminado — un proveedor puede vender múltiples tipos de insumo.
    __tablename__ = "proveedores"

    id         = Column(Integer, primary_key=True, index=True)
    nombre     = Column(String(255), nullable=False)
    contacto   = Column(String(100))
    telefono   = Column(String(30))        # tipo correcto: String, no Date
    email      = Column(String(255))
    direccion  = Column(Text)
    activo     = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# =========================================
# CLIENTES
# =========================================

class Cliente(Base):
    __tablename__ = "clientes"

    id                     = Column(Integer, primary_key=True, index=True)
    nombre                 = Column(String(255), nullable=False)
    tipo_documento         = Column(String(10))   # CC|NIT|CE|PPN|TI|otro
    documento              = Column(String(30), unique=True)  # UNIQUE pero nullable
    tipo_cliente           = Column(String(30))   # mayorista|minorista|local|distribuidor
    ciudad                 = Column(String(100), default="Bogotá")
    canal_venta            = Column(String(30))   # whatsapp|local|domicilio
    condicion_pago         = Column(String(20), nullable=False, default="contado")
    cupo_credito           = Column(Numeric(12, 2), nullable=False, default=0)
    tarifa_domicilio       = Column(Numeric(12, 2), nullable=False, default=0)
    mostrar_saldo_whatsapp = Column(Boolean, nullable=False, default=True)
    analytics_enabled      = Column(Boolean, nullable=False, default=False)
    analytics_activated_at = Column(DateTime(timezone=True))
    analytics_expires_at   = Column(DateTime(timezone=True))
    created_at             = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Tabla renombrada a cliente_contactos (antes cliente_detalle)
    contactos = relationship("ClienteContacto", back_populates="cliente",
                             cascade="all, delete-orphan")

    # Compatibilidad — alias para código existente que usa .detalles
    @property
    def detalles(self):
        return self.contactos


class ClienteContacto(Base):
    """
    Contactos de cada cliente (teléfonos + direcciones de entrega).
    Tabla real en DB: cliente_detalle (renombrada a cliente_contactos en migration v4, pendiente).
    CORRECCIÓN: telefono era tipo DATE en el dump original — ahora VARCHAR(30).
    """
    __tablename__ = "cliente_contactos"

    id           = Column(Integer, primary_key=True, index=True)
    cliente_id   = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    telefono     = Column(String(30))      # CORREGIDO: antes era tipo DATE en el dump original
    direccion    = Column(Text)
    lat          = Column(Numeric(10, 7))
    lng          = Column(Numeric(10, 7))
    maps_url     = Column(Text)
    es_principal = Column(Boolean, nullable=False, default=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    cliente = relationship("Cliente", back_populates="contactos")


# =========================================
# PRODUCTOS
# =========================================

class Producto(Base):
    __tablename__ = "productos"

    id            = Column(Integer, primary_key=True, index=True)
    nombre        = Column(Text, nullable=False)
    codigo_corto  = Column(String(20), unique=True)
    tipo_producto = Column(String(30))   # arepa|masa|queso|bebida|otro
    precio        = Column(Numeric(10, 2), nullable=False, default=0)
    costo         = Column(Numeric(10, 2), nullable=False, default=0)
    activo        = Column(Boolean, nullable=False, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    insumos_producto = relationship("ProductoInsumo", back_populates="producto", cascade="all, delete-orphan")


class ProductoInsumo(Base):
    """Insumos de empaque/presentación asociados a un producto (ej: bolsa)."""
    __tablename__ = "producto_insumos"
    __table_args__ = (UniqueConstraint("producto_id", "insumo_id"),)

    id          = Column(Integer, primary_key=True, index=True)
    producto_id = Column(Integer, ForeignKey("productos.id", ondelete="CASCADE"), nullable=False)
    insumo_id   = Column(Integer, ForeignKey("insumos.id",   ondelete="RESTRICT"), nullable=False)
    cantidad    = Column(Numeric(12, 4), nullable=False, default=1)

    producto = relationship("Producto", back_populates="insumos_producto")
    insumo   = relationship("Insumo")


class PrecioEspecial(Base):
    """
    Precios acordados por cliente. Sobreescribe Producto.precio en pedidos.
    Renombrado de precios_cliente a precios_especiales.
    """
    __tablename__ = "precios_especiales"
    __table_args__ = (UniqueConstraint("cliente_id", "producto_id"),)

    id              = Column(Integer, primary_key=True, index=True)
    cliente_id      = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    producto_id     = Column(Integer, ForeignKey("productos.id", ondelete="CASCADE"), nullable=False)
    precio_especial = Column(Numeric(10, 2), nullable=False)
    activo          = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    cliente  = relationship("Cliente")
    producto = relationship("Producto")


# =========================================
# PEDIDOS
# =========================================

class Pedido(Base):
    __tablename__ = "pedidos"

    id              = Column(Integer, primary_key=True, index=True)
    cliente_id      = Column(Integer, ForeignKey("clientes.id", ondelete="RESTRICT"), nullable=False)
    fecha           = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    estado          = Column(String(20), nullable=False, default="pendiente")
    # [DENORM] snapshot del total — calculado en app
    total           = Column(Numeric(12, 2), nullable=False, default=0)
    # [DENORM] suma de pagos recibidos — actualizado en app
    monto_pagado    = Column(Numeric(12, 2), nullable=False, default=0)
    valor_domicilio = Column(Numeric(12, 2), nullable=False, default=0)
    medio_pago_id   = Column(Integer, ForeignKey("medios_pago.id", ondelete="SET NULL"))
    observaciones   = Column(Text)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    cliente = relationship("Cliente")
    detalle = relationship("DetallePedido", back_populates="pedido", cascade="all, delete-orphan")


class DetallePedido(Base):
    __tablename__ = "detalle_pedido"

    id              = Column(Integer, primary_key=True, index=True)
    pedido_id       = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False)
    producto_id     = Column(Integer, ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    cantidad        = Column(Integer, nullable=False)
    # [SNAPSHOT] precio al momento de la venta — puede diferir del precio actual del producto
    precio_aplicado = Column("precio", Numeric(10, 2), nullable=False)
    # [DENORM] cantidad × precio_aplicado — snapshot inmutable
    subtotal        = Column(Numeric(12, 2), nullable=False)

    pedido   = relationship("Pedido", back_populates="detalle")
    producto = relationship("Producto")


# =========================================
# PAGOS (CxC — cobros recibidos de clientes)
# Tabla renombrada de pagos_recibidos a pagos
# Columna renombrada de metodo_pago_id a medio_pago_id
# =========================================

class PagoRecibido(Base):
    __tablename__ = "pagos"

    id            = Column(Integer, primary_key=True, index=True)
    cliente_id    = Column(Integer, ForeignKey("clientes.id", ondelete="RESTRICT"), nullable=False)
    monto         = Column(Numeric(12, 2), nullable=False)
    medio_pago_id = Column(Integer, ForeignKey("medios_pago.id", ondelete="SET NULL"))
    fecha         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    cliente    = relationship("Cliente")
    medio_pago = relationship("MedioPago")


class PagoPedido(Base):
    """
    Tabla junction M:N entre pagos y pedidos.
    PK compuesta (pago_id, pedido_id) — sin surrogate key redundante.
    """
    __tablename__ = "pagos_pedidos"

    pago_id   = Column(Integer, ForeignKey("pagos.id",   ondelete="CASCADE"), primary_key=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), primary_key=True)
    monto     = Column(Numeric(12, 2), nullable=False)


# =========================================
# GASTOS
# =========================================

class Gasto(Base):
    """
    Gastos operacionales.
    NOTA: La DB real aún tiene columnas de texto libre (concepto, categoria, tipo_gasto).
    La migración migration_normalizacion_v4.sql agrega categoria_id y descripcion.
    El ORM mapea las columnas que existen en ambas versiones + las nuevas como nullable.
    """
    __tablename__ = "gastos"

    id              = Column(Integer, primary_key=True, index=True)
    valor           = Column(Numeric(12, 2), nullable=False)
    fecha           = Column(Date, server_default=func.current_date(), nullable=False)
    # Columnas legacy (existen en DB actual)
    concepto        = Column(String(255))
    categoria       = Column(String(100))           # texto libre — reemplazado por categoria_id en v4
    tipo_gasto      = Column(String(50))
    observaciones   = Column(Text)
    pedido_id       = Column(Integer)               # legacy, sin FK activo
    fecha_pago      = Column(DateTime(timezone=True))
    # FK a categorias (genérica multi-módulo, modulo_codigo='gastos')
    categoria_id    = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    proveedor_id    = Column(Integer, ForeignKey("proveedores.id", ondelete="SET NULL"))
    medio_pago_id   = Column(Integer, ForeignKey("medios_pago.id", ondelete="SET NULL"))
    # Campos de insumo — agregados por migration_insumos_v1.sql
    insumo_id       = Column(Integer, ForeignKey("insumos.id"), nullable=True)
    cantidad_insumo = Column(Numeric(12, 3))
    estado          = Column(String(20), nullable=False, default='activo')  # activo | anulado
    # Clasificación contable — migration_costos_produccion.sql
    tipo_costo      = Column(String(20), nullable=True)   # directo | servicio | indirecto
    centro_costo    = Column(String(20), nullable=True)   # produccion | administracion | ventas
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    # Seguimiento de deuda — migration_abonos_gastos_v1.sql
    monto_pagado    = Column(Numeric(12, 2), nullable=False, default=0)
    estado_pago     = Column(String(20), nullable=False, default='pendiente')  # pendiente | parcial | pagado
    # Jerarquía de categorías — migration_categorias_genericas_v1.sql
    subcategoria_id = Column(Integer, ForeignKey("subcategorias.id", ondelete="SET NULL"), nullable=True)
    # Auditoría — migration_gastos_auditoria_adjuntos_v1.sql
    created_by      = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    updated_by      = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    updated_at      = Column(DateTime(timezone=True), nullable=True)
    anulado_by      = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    anulado_at      = Column(DateTime(timezone=True), nullable=True)

    categoria_rel    = relationship("Categoria", foreign_keys=[categoria_id], back_populates="gastos")
    subcategoria_rel = relationship("Subcategoria", foreign_keys=[subcategoria_id])
    proveedor        = relationship("Proveedor")
    insumo           = relationship("Insumo")
    abonos           = relationship("AbonoGasto", back_populates="gasto", cascade="all, delete-orphan")
    adjuntos         = relationship("GastoAdjunto", back_populates="gasto", cascade="all, delete-orphan")
    creador          = relationship("Usuario", foreign_keys=[created_by])


class GastoAdjunto(Base):
    """Facturas, comprobantes y soportes adjuntos a un gasto."""
    __tablename__ = "gastos_adjuntos"

    id             = Column(Integer, primary_key=True, index=True)
    gasto_id       = Column(Integer, ForeignKey("gastos.id", ondelete="CASCADE"), nullable=False)
    nombre_archivo = Column(String(255), nullable=False)
    ruta_archivo   = Column(Text, nullable=False)
    mime_type      = Column(String(100), nullable=True)
    tamano_bytes   = Column(Integer, nullable=False)
    subido_por     = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    notas          = Column(Text, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    gasto = relationship("Gasto", back_populates="adjuntos")


class AbonoGasto(Base):
    __tablename__ = "abonos_gastos"

    id            = Column(Integer, primary_key=True, index=True)
    gasto_id      = Column(Integer, ForeignKey("gastos.id", ondelete="CASCADE"), nullable=False)
    monto         = Column(Numeric(12, 2), nullable=False)
    fecha         = Column(Date, server_default=func.current_date(), nullable=False)
    medio_pago_id = Column(Integer, ForeignKey("medios_pago.id", ondelete="SET NULL"))
    notas         = Column(Text)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    gasto      = relationship("Gasto", back_populates="abonos")
    medio_pago = relationship("MedioPago")


# =========================================
# INGRESOS MANUALES — migration_cash_flow_v1.sql
# =========================================

class IngresoManual(Base):
    """
    Ingresos extraordinarios o no operativos no derivados de ventas:
    aportes de socios, préstamos, devoluciones positivas, intereses, etc.
    Categorías compartidas con modulo_codigo='ingresos'.
    """
    __tablename__ = "ingresos_manuales"

    id              = Column(Integer, primary_key=True, index=True)
    fecha           = Column(Date, server_default=func.current_date(), nullable=False)
    valor           = Column(Numeric(14, 2), nullable=False)
    categoria_id    = Column(Integer, ForeignKey("categorias.id",    ondelete="SET NULL"), nullable=True)
    subcategoria_id = Column(Integer, ForeignKey("subcategorias.id", ondelete="SET NULL"), nullable=True)
    medio_pago_id   = Column(Integer, ForeignKey("medios_pago.id",   ondelete="SET NULL"), nullable=True)
    descripcion     = Column(Text)
    tipo            = Column(String(20), nullable=False, default='operativo')
    estado          = Column(String(20), nullable=False, default='activo')
    created_by      = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by      = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    updated_at      = Column(DateTime(timezone=True), nullable=True)
    anulado_by      = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    anulado_at      = Column(DateTime(timezone=True), nullable=True)

    categoria    = relationship("Categoria",    foreign_keys=[categoria_id])
    subcategoria = relationship("Subcategoria", foreign_keys=[subcategoria_id])
    medio_pago   = relationship("MedioPago",    foreign_keys=[medio_pago_id])
    creador      = relationship("Usuario",      foreign_keys=[created_by])


# =========================================
# TRANSFERENCIAS
# =========================================

class Transferencia(Base):
    __tablename__ = "transferencias"

    id          = Column(Integer, primary_key=True, index=True)
    origen_id   = Column(Integer, ForeignKey("medios_pago.id", ondelete="RESTRICT"), nullable=False)
    destino_id  = Column(Integer, ForeignKey("medios_pago.id", ondelete="RESTRICT"), nullable=False)
    valor       = Column(Numeric(12, 2), nullable=False)
    fecha       = Column(Date, server_default=func.current_date(), nullable=False)
    descripcion = Column(Text)
    creado_por  = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    origen  = relationship("MedioPago", foreign_keys=[origen_id])
    destino = relationship("MedioPago", foreign_keys=[destino_id])


# =========================================
# INVENTARIO DE PRODUCTOS
# =========================================

class Inventario(Base):
    """[DENORM] Cache del stock de productos. Fuente de verdad: movimientos_inventario."""
    __tablename__ = "inventario"

    producto_id = Column(Integer, ForeignKey("productos.id"), primary_key=True)
    cantidad    = Column(Numeric(12, 2), nullable=False, default=0)

    producto = relationship("Producto")


class MovimientoInventario(Base):
    """Log de todos los movimientos de inventario de productos terminados."""
    __tablename__ = "movimientos_inventario"

    id            = Column(Integer, primary_key=True, index=True)
    producto_id   = Column(Integer, ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    tipo          = Column(Text, nullable=False)    # entrada|salida|ajuste
    cantidad      = Column(Numeric(12, 2), nullable=False)
    origen        = Column(Text)                   # coccion|produccion|venta|ajuste_manual
    # Informativo: ID del proceso/pedido. Sin FK por ser polimórfico.
    referencia_id = Column(Integer)
    fecha         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    producto = relationship("Producto")


# =========================================
# INSUMOS
# =========================================

class Insumo(Base):
    """
    Materias primas e insumos de producción.
    [DENORM] cantidad_actual = cache del stock. Mantenido por triggers.
    """
    __tablename__ = "insumos"

    id              = Column(Integer, primary_key=True, index=True)
    nombre          = Column(String(255), nullable=False, unique=True)
    unidad_medida   = Column(String(20), nullable=False, default="kg")  # kg|gramo|litro|unidad|ml|cm3|tonelada
    # [DENORM] cache del stock — fuente de verdad: SUM(movimientos_insumos)
    cantidad_actual = Column(Numeric(12, 3), nullable=False, default=0)
    # Último costo unitario conocido — actualizado al registrar gastos de insumo
    costo_unitario  = Column(Numeric(14, 6), nullable=False, default=0)
    activo          = Column(Boolean, nullable=False, default=True)
    proveedor_id    = Column(Integer, ForeignKey("proveedores.id", ondelete="SET NULL"), nullable=True)
    # Unidades base (en unidad_medida) que contiene un paquete/presentación de compra.
    # Ej: 50 (bulto de 50 kg), 1000 (caja de 1000 bolsas), 2.5 (bloque de 2.5 kg).
    # NULL si el insumo se compra suelto por unidad base.
    unidades_por_paquete = Column(Numeric(10, 3), nullable=True)
    # [GENERATED] costo_paquete = costo_unitario × unidades_por_paquete. Read-only.
    # Columna GENERATED ALWAYS en BD; Computed() evita que SQLAlchemy la incluya en INSERT/UPDATE.
    costo_paquete   = Column(
        Numeric(14, 2),
        Computed("ROUND(costo_unitario * COALESCE(unidades_por_paquete, 1), 2)", persisted=True),
        nullable=True,
    )
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    proveedor       = relationship("Proveedor")

    movimientos = relationship("MovimientoInsumo", back_populates="insumo")
    proveedores_rel = relationship(
        "InsumoProveedor", back_populates="insumo", cascade="all, delete-orphan"
    )


class InsumoProveedor(Base):
    """Relación N:M insumo↔proveedor con último costo y unidades por paquete.
    Mantenida por trigger fn_gasto_actualiza_insumo al registrar gastos.
    """
    __tablename__ = "insumo_proveedores"

    id                    = Column(Integer, primary_key=True, index=True)
    insumo_id             = Column(Integer, ForeignKey("insumos.id", ondelete="CASCADE"), nullable=False)
    proveedor_id          = Column(Integer, ForeignKey("proveedores.id", ondelete="CASCADE"), nullable=False)
    ultimo_costo_unitario = Column(Numeric(14, 6))
    ultima_compra_fecha   = Column(Date)
    unidades_por_paquete  = Column(Numeric(10, 3))
    activo                = Column(Boolean, nullable=False, default=True)
    created_at            = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at            = Column(DateTime(timezone=True))

    __table_args__ = (UniqueConstraint("insumo_id", "proveedor_id", name="insumo_proveedores_insumo_id_proveedor_id_key"),)

    insumo    = relationship("Insumo", back_populates="proveedores_rel")
    proveedor = relationship("Proveedor")


class MovimientoInsumo(Base):
    """Log de movimientos de inventario de insumos."""
    __tablename__ = "movimientos_insumos"

    id            = Column(Integer, primary_key=True, index=True)
    insumo_id     = Column(Integer, ForeignKey("insumos.id", ondelete="RESTRICT"), nullable=False)
    tipo          = Column(String(20), nullable=False)   # entrada|salida|ajuste
    cantidad      = Column(Numeric(12, 3), nullable=False)
    costo_total   = Column(Numeric(14, 2))
    origen        = Column(String(30))    # gasto|produccion|ajuste_manual|reversion_lote
    # Informativo: ID del gasto o lote. Sin FK por ser polimórfico.
    referencia_id = Column(Integer)
    notas         = Column(Text)
    fecha         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    insumo = relationship("Insumo", back_populates="movimientos")


# =========================================
# ALIAS DE COMPATIBILIDAD
# Permite que código existente importe ClienteDetalle sin romper.
# =========================================
ClienteDetalle = ClienteContacto


# =========================================
# COSTEO DE PRODUCCIÓN
# =========================================

class FacturaServicio(Base):
    """
    Facturas de servicios públicos (gas, agua, luz).
    costo_unitario = valor / consumo → calculado en app al guardar.
    """
    __tablename__ = "facturas_servicio"

    id             = Column(Integer, primary_key=True, index=True)
    tipo           = Column(String(20), nullable=False)   # gas | agua | luz | otro
    periodo        = Column(String(7),  nullable=False)   # YYYY-MM
    valor          = Column(Numeric(14, 2), nullable=False)
    consumo        = Column(Numeric(12, 3))               # m³ o kWh
    unidad         = Column(String(20), nullable=False, default="m3")
    costo_unitario = Column(Numeric(14, 6))               # calculado: valor/consumo
    proveedor_id   = Column(Integer, ForeignKey("proveedores.id", ondelete="SET NULL"), nullable=True)
    notas          = Column(Text)
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    proveedor = relationship("Proveedor")


# =========================================
# PRODUCCIÓN
# =========================================

class ProduccionProceso(Base):
    """Cocción: producto de entrada (maíz) → producto de salida (masa)."""
    __tablename__ = "produccion_proceso"

    id                  = Column(Integer, primary_key=True, index=True)
    fecha               = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    producto_entrada_id = Column(Integer, ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    cantidad_entrada_kg = Column(Numeric(12, 3), nullable=False)
    producto_salida_id  = Column(Integer, ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    cantidad_salida_kg  = Column(Numeric(12, 3), nullable=False)
    # [DENORM] (salida/entrada)×100 — calculado en app al insertar
    rendimiento         = Column(Numeric(5, 2))
    observaciones       = Column(Text)

    # Consumo de servicios — migration_costos_produccion.sql
    consumo_gas_m3   = Column(Numeric(10, 3), nullable=True)
    consumo_agua_m3  = Column(Numeric(10, 3), nullable=True)

    producto_entrada = relationship("Producto", foreign_keys=[producto_entrada_id])
    producto_salida  = relationship("Producto", foreign_keys=[producto_salida_id])


class ProduccionDetalle(Base):
    """Elaboración: masa cocida → producto terminado (arepas)."""
    __tablename__ = "produccion_detalle"

    id                    = Column(Integer, primary_key=True, index=True)
    fecha                 = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    producto_consumido_id = Column(Integer, ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    cantidad_consumida_kg = Column(Numeric(12, 3), nullable=False)
    producto_final_id     = Column(Integer, ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    cantidad_producida    = Column(Integer, nullable=False)
    observaciones         = Column(Text)

    producto_final     = relationship("Producto", foreign_keys=[producto_final_id])
    producto_consumido = relationship("Producto", foreign_keys=[producto_consumido_id])


# =========================================
# LOTES DE PRODUCCIÓN CON COSTOS
# =========================================

class LoteProduccion(Base):
    """
    Registro de un lote de producción con múltiples insumos y cálculo de costo.
    [SNAPSHOT] costo_total y costo_por_unidad son inmutables una vez registrados.
    """
    __tablename__ = "lotes_produccion"

    id                 = Column(Integer, primary_key=True, index=True)
    fecha              = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    producto_final_id  = Column(Integer, ForeignKey("productos.id", ondelete="SET NULL"))
    cantidad_producida = Column(Integer, nullable=False)
    # [SNAPSHOT] calculado al crear el lote — no recalcular aunque cambien precios
    costo_total        = Column(Numeric(14, 2), nullable=False, default=0)
    costo_por_unidad   = Column(Numeric(14, 6), nullable=False, default=0)
    observaciones      = Column(Text)
    created_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    producto_final = relationship("Producto", foreign_keys=[producto_final_id])
    insumos_usados = relationship("LoteProduccionInsumo", back_populates="lote",
                                  cascade="all, delete-orphan")


# =========================================
# RECETAS DE COCCIÓN
# =========================================

class RecetaCoccion(Base):
    """
    Fórmula reutilizable de cocción: define qué insumos y en qué cantidades
    se necesitan por 'bulto', y cuánta masa produce ese bulto.
    """
    __tablename__ = "recetas_coccion"

    id                 = Column(Integer, primary_key=True, index=True)
    nombre             = Column(String(150), nullable=False)
    descripcion        = Column(Text)
    insumo_salida_id   = Column(Integer, ForeignKey("insumos.id", ondelete="RESTRICT"), nullable=True)
    masa_salida_kg     = Column(Numeric(10, 3), nullable=False, default=0)
    activa             = Column(Boolean, nullable=False, default=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    insumo_salida = relationship("Insumo", foreign_keys=[insumo_salida_id])
    insumos       = relationship("RecetaCoccionInsumo", back_populates="receta",
                                 cascade="all, delete-orphan")
    cocciones     = relationship("Coccion", back_populates="receta")


class RecetaCoccionInsumo(Base):
    """Línea de insumo para una receta de cocción (cantidad por 1 bulto)."""
    __tablename__ = "recetas_coccion_insumos"
    __table_args__ = (UniqueConstraint("receta_id", "insumo_id", name="uq_receta_insumo"),)

    id        = Column(Integer, primary_key=True, index=True)
    receta_id = Column(Integer, ForeignKey("recetas_coccion.id", ondelete="CASCADE"), nullable=False)
    insumo_id = Column(Integer, ForeignKey("insumos.id", ondelete="RESTRICT"), nullable=False)
    cantidad  = Column(Numeric(12, 4), nullable=False)
    unidad    = Column(String(30), nullable=False)

    receta = relationship("RecetaCoccion", back_populates="insumos")
    insumo = relationship("Insumo")


class Coccion(Base):
    """Registro histórico de cada ejecución de una receta de cocción."""
    __tablename__ = "cocciones"

    id               = Column(Integer, primary_key=True, index=True)
    receta_id        = Column(Integer, ForeignKey("recetas_coccion.id", ondelete="RESTRICT"), nullable=False)
    bultos           = Column(Numeric(8, 2), nullable=False, default=1)
    masa_obtenida_kg = Column(Numeric(12, 3), nullable=False, default=0)
    observaciones    = Column(Text)
    fecha            = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    consumo_gas_m3   = Column(Numeric(10, 3), nullable=True)
    consumo_agua_m3  = Column(Numeric(10, 3), nullable=True)

    receta          = relationship("RecetaCoccion", back_populates="cocciones")
    insumos_usados  = relationship("CoccionInsumo", back_populates="coccion",
                                   cascade="all, delete-orphan")


class CoccionInsumo(Base):
    """Snapshot de los insumos consumidos en una cocción ejecutada."""
    __tablename__ = "cocciones_insumos"

    id            = Column(Integer, primary_key=True, index=True)
    coccion_id    = Column(Integer, ForeignKey("cocciones.id", ondelete="CASCADE"), nullable=False)
    insumo_id     = Column(Integer, ForeignKey("insumos.id", ondelete="SET NULL"), nullable=True)
    insumo_nombre = Column(String(255), nullable=False)  # [SNAPSHOT]
    cantidad      = Column(Numeric(12, 4), nullable=False)
    unidad        = Column(String(30), nullable=False)

    coccion = relationship("Coccion", back_populates="insumos_usados")
    insumo  = relationship("Insumo")


class LoteProduccionInsumo(Base):
    """
    Líneas de insumos de un lote de producción.
    3FN: insumo_nombre y unidad_medida ELIMINADOS — dependen de insumo_id, no de la PK.
         Obtener via JOIN a insumos cuando se necesiten.
    [SNAPSHOT] costo_unitario_snapshot = precio por unidad AL MOMENTO del lote.
    """
    __tablename__ = "lotes_produccion_insumos"
    __table_args__ = (UniqueConstraint("lote_id", "insumo_id", name="uq_lote_insumo"),)

    id                      = Column(Integer, primary_key=True, index=True)
    lote_id                 = Column(Integer, ForeignKey("lotes_produccion.id", ondelete="CASCADE"),
                                     nullable=False)
    insumo_id               = Column(Integer, ForeignKey("insumos.id", ondelete="RESTRICT"),
                                     nullable=False)
    cantidad                = Column(Numeric(12, 3), nullable=False)
    # [SNAPSHOT VÁLIDO] precio/unidad en el momento del lote (histórico)
    costo_unitario_snapshot = Column(Numeric(14, 6), nullable=False, default=0)
    # [DENORM] cantidad × costo_unitario_snapshot — snapshot inmutable
    costo_linea             = Column(Numeric(14, 2), nullable=False, default=0)

    lote   = relationship("LoteProduccion", back_populates="insumos_usados")
    insumo = relationship("Insumo")


# =========================================
# =========================================
# CONFIGURACIÓN (reemplazada por ParametroSistema)
# La clase Configuracion fue eliminada al migrar a parametros_sistema.
# La tabla `configuracion` se descarta en migration_parametros_v1.sql.
# =========================================


# =========================================
# MÓDULO PARÁMETROS — catálogos editables desde la UI
# =========================================

class UnidadMedida(Base):
    """Catálogo de unidades de medida. Conversiones derivadas de factor_base."""
    __tablename__ = "unidades_medida"

    codigo      = Column(String(20), primary_key=True)
    nombre      = Column(String(80), nullable=False)
    grupo       = Column(String(20), nullable=False)   # peso | volumen | unidad
    factor_base = Column(Numeric(20, 10), nullable=False)
    activo      = Column(Boolean, nullable=False, default=True)
    sistema     = Column(Boolean, nullable=False, default=False)
    creado_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ParametroSistema(Base):
    """Parámetros escalares parametrizables (reemplaza constantes hardcodeadas)."""
    __tablename__ = "parametros_sistema"

    clave           = Column(String(60), primary_key=True)
    valor           = Column(Text, nullable=False)
    tipo            = Column(String(20), nullable=False)  # numero|texto|booleano|porcentaje|hora
    nombre          = Column(String(120), nullable=False)
    descripcion     = Column(Text)
    categoria       = Column(String(40), nullable=False)
    min_valor       = Column(Numeric)
    max_valor       = Column(Numeric)
    sistema         = Column(Boolean, nullable=False, default=False)
    actualizado_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_por = Column(Integer)


class TipoProducto(Base):
    """Catálogo de tipos/clasificación de productos."""
    __tablename__ = "tipos_producto"

    codigo      = Column(String(30), primary_key=True)
    nombre      = Column(String(80), nullable=False)
    descripcion = Column(Text)
    color       = Column(String(20))
    icono       = Column(String(30))
    activo      = Column(Boolean, nullable=False, default=True)
    orden       = Column(Integer, nullable=False, default=0)
    creado_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class TipoCliente(Base):
    """Catálogo de segmentos de cliente."""
    __tablename__ = "tipos_cliente"

    codigo      = Column(String(30), primary_key=True)
    nombre      = Column(String(80), nullable=False)
    descripcion = Column(Text)
    color       = Column(String(20))
    activo      = Column(Boolean, nullable=False, default=True)
    orden       = Column(Integer, nullable=False, default=0)
    creado_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AnalyticsActivacion(Base):
    """
    Historial de activaciones del módulo analítica premium del portal cliente.
    Cada registro = un pago/activación de 30 días.
    """
    __tablename__ = "analytics_activaciones"

    id            = Column(Integer, primary_key=True, index=True)
    cliente_id    = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, index=True)
    activado_por  = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    fecha_inicio  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fecha_fin     = Column(DateTime(timezone=True), nullable=False)
    monto         = Column(Numeric(12, 2), nullable=False, default=10000)
    medio_pago    = Column(String(50))
    referencia    = Column(String(100))
    observaciones = Column(Text)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AnalyticsSolicitud(Base):
    """
    Solicitud de un cliente para activar el módulo analítica premium.
    El admin revisa estas peticiones desde un panel en la configuración.
    """
    __tablename__ = "analytics_solicitudes"

    id              = Column(Integer, primary_key=True, index=True)
    cliente_id      = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, index=True)
    usuario_id      = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    fecha_solicitud = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    estado          = Column(String(20), nullable=False, default="pendiente")  # pendiente|revisada|activada|rechazada
    revisada_por    = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    fecha_revision  = Column(DateTime(timezone=True))
    mensaje         = Column(Text)
    notas_admin     = Column(Text)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric, DateTime, Date, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    nombre = Column(String, nullable=False)
    rol = Column(String, default="user")
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MedioPago(Base):
    __tablename__ = "medios_pago"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    tipo = Column(String)
    activo = Column(Boolean, default=True)

class Cliente(Base):
    __tablename__ = "clientes"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    tipo_cliente = Column(String, nullable=False)
    telefono = Column(String)
    direccion = Column(String)
    ciudad = Column(String, default="Bogotá")
    canal_venta = Column(String)
    condicion_pago = Column(String, default="contado")
    cupo_credito = Column(Numeric(12, 2), default=0)
    mostrar_saldo_whatsapp = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Proveedor(Base):
    __tablename__ = "proveedores"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    telefono = Column(String)
    contacto = Column(String)
    email = Column(String)
    direccion = Column(String)
    tipo_insumo = Column(String)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Producto(Base):
    __tablename__ = "productos"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    codigo_corto = Column(String, unique=True)
    tipo_producto = Column(String)
    precio_estandar = Column(Numeric(10, 2), default=0)
    costo_unitario = Column(Numeric(10, 2), default=0)
    unidad_medida = Column(String)
    activo = Column(Boolean, default=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PrecioCliente(Base):
    __tablename__ = "precios_cliente"
    
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"))
    producto_id = Column(Integer, ForeignKey("productos.id", ondelete="CASCADE"))
    precio_especial = Column(Numeric(10, 2), nullable=False)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Pedido(Base):
    __tablename__ = "pedidos"
    
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    total = Column(Numeric(12, 2), default=0)
    monto_pagado = Column(Numeric(12, 2), default=0)
    valor_domicilio = Column(Numeric(12, 2), default=0)
    medio_pago_id = Column(Integer, ForeignKey("medios_pago.id"))
    estado = Column(String, default="pendiente")
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    cliente = relationship("Cliente")
    detalle = relationship("DetallePedido", back_populates="pedido")

class DetallePedido(Base):
    __tablename__ = "detalle_pedido"
    
    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"))
    producto_id = Column(Integer, ForeignKey("productos.id"))
    cantidad = Column(Integer, nullable=False)
    precio_aplicado = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    pedido = relationship("Pedido", back_populates="detalle")
    producto = relationship("Producto")

class PagoRecibido(Base):
    __tablename__ = "pagos_recibidos"
    
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"))
    monto = Column(Numeric(12, 2), nullable=False)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    descripcion = Column(Text)
    metodo_pago_id = Column(Integer, ForeignKey("medios_pago.id"))
    created_by = Column(Integer, ForeignKey("usuarios.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PagoPedido(Base):
    __tablename__ = "pagos_pedidos"
    
    id = Column(Integer, primary_key=True, index=True)
    pago_id = Column(Integer, ForeignKey("pagos_recibidos.id", ondelete="CASCADE"))
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"))
    monto = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Gasto(Base):
    __tablename__ = "gastos"
    
    id = Column(Integer, primary_key=True, index=True)
    concepto = Column(String, nullable=False)
    categoria = Column(String)
    tipo_gasto = Column(String)
    fecha = Column(Date, server_default=func.current_date())
    valor = Column(Numeric(12, 2), nullable=False)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"))
    medio_pago_id = Column(Integer, ForeignKey("medios_pago.id"))
    pedido_id = Column(Integer, ForeignKey("pedidos.id"))
    observaciones = Column(Text)
    fecha_pago = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Transferencia(Base):
    __tablename__ = "transferencias"
    
    id = Column(Integer, primary_key=True, index=True)
    origen_id = Column(Integer, ForeignKey("medios_pago.id"))
    destino_id = Column(Integer, ForeignKey("medios_pago.id"))
    valor = Column(Numeric(12, 2), nullable=False)
    fecha = Column(Date, server_default=func.current_date())
    descripcion = Column(Text)
    created_by = Column(Integer, ForeignKey("usuarios.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

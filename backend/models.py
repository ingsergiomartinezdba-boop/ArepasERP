from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

# --- Shared Models ---

class Token(BaseModel):
    access_token: str
    token_type: str

# --- Client Models ---

class ClientBase(BaseModel):
    nombre: str
    tipo_cliente: str # mayorista, minorista, local, distribuidor
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = "Bogotá"
    canal_venta: Optional[str] = None # whatsapp, local, domicilio
    condicion_pago: Optional[str] = "contado"
    cupo_credito: Optional[Decimal] = 0

class ClientCreate(ClientBase):
    pass

class ClientUpdate(ClientBase):
    pass

class Client(ClientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Product Models ---

class ProductBase(BaseModel):
    nombre: str
    codigo_corto: str
    tipo_producto: str # arepa, queso, otro
    precio_estandar: Decimal
    costo_unitario: Decimal
    unidad_medida: str
    activo: Optional[bool] = True
    proveedor_id: Optional[int] = None

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Price Rules Models ---

class PriceRuleBase(BaseModel):
    cliente_id: int
    producto_id: int
    precio_especial: Decimal
    activo: Optional[bool] = True

class PriceRuleCreate(PriceRuleBase):
    pass

class PriceRule(PriceRuleBase):
    id: int

# --- Order Models ---

class OrderItemCreate(BaseModel):
    producto_id: int
    cantidad: int

class OrderCreate(BaseModel):
    cliente_id: int
    medio_pago_id: Optional[int] = None
    items: List[OrderItemCreate]
    fecha: Optional[datetime] = None # Defaults to now if None
    estado: Optional[str] = "pendiente"

class OrderItemResponse(BaseModel):
    id: int
    producto_id: int
    producto_nombre: Optional[str] = None # Joined field
    cantidad: int
    precio_aplicado: Decimal
    subtotal: Decimal

class OrderResponse(BaseModel):
    id: int
    cliente_id: int
    cliente_nombre: Optional[str] = None # Joined field
    fecha: datetime
    total: Decimal
    medio_pago_id: Optional[int]
    estado: str
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True

# --- Expense Models ---

class ExpenseBase(BaseModel):
    concepto: str
    categoria: str
    tipo_gasto: str
    fecha: date
    valor: Decimal
    proveedor_id: Optional[int] = None
    medio_pago_id: Optional[int] = None
    pedido_id: Optional[int] = None
    observaciones: Optional[str] = None

class ExpenseCreate(ExpenseBase):
    pass

class Expense(ExpenseBase):
    id: int
    created_at: datetime

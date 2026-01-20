from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

# --- Shared Models ---

class Token(BaseModel):
    access_token: str
    token_type: str

# --- Client Models ---

class SupplierBase(BaseModel):
    nombre: str
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    tipo_insumo: Optional[str] = None
    activo: Optional[bool] = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(SupplierBase):
    pass

class Supplier(SupplierBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ClientBase(BaseModel):
    nombre: str
    tipo_cliente: str # mayorista, minorista, local, distribuidor
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = "Bogotá"
    canal_venta: Optional[str] = None # whatsapp, local, domicilio
    condicion_pago: Optional[str] = "contado"
    cupo_credito: Optional[float] = 0
    mostrar_saldo_whatsapp: Optional[bool] = True

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
    precio_estandar: float
    costo_unitario: float
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
    precio_especial: float
    activo: Optional[bool] = True

class PriceRuleCreate(PriceRuleBase):
    pass

class PriceRule(PriceRuleBase):
    id: int

# --- Order Models ---

class OrderItemCreate(BaseModel):
    producto_id: int
    cantidad: int
    precio: Optional[float] = None

class OrderCreate(BaseModel):
    cliente_id: int
    medio_pago_id: Optional[int] = None
    items: List[OrderItemCreate]
    fecha: Optional[datetime] = None # Defaults to now if None
    valor_domicilio: Optional[float] = 0
    estado: Optional[str] = "pendiente"

class OrderItemResponse(BaseModel):
    id: int
    producto_id: int
    producto_nombre: Optional[str] = None # Joined field
    cantidad: int
    precio_aplicado: float
    subtotal: float

class OrderResponse(BaseModel):
    id: int
    cliente_id: int
    cliente_nombre: Optional[str] = None # Joined field
    fecha: datetime
    total: float
    valor_domicilio: Optional[float] = 0
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
    valor: float
    proveedor_id: Optional[int] = None
    medio_pago_id: Optional[int] = None
    pedido_id: Optional[int] = None
    observaciones: Optional[str] = None
    fecha_pago: Optional[datetime] = None

class ExpenseCreate(ExpenseBase):
    pass

class Expense(ExpenseBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    proveedor_nombre: Optional[str] = None

    class Config:
        from_attributes = True

# --- Payment Method Models ---

class PaymentMethodBase(BaseModel):
    nombre: str
    tipo: Optional[str] = "digital" # Make optional for legacy data
    activo: Optional[bool] = True

class PaymentMethodCreate(PaymentMethodBase):
    pass

class PaymentMethodUpdate(PaymentMethodBase):
    pass

class PaymentMethod(PaymentMethodBase):
    id: int
    created_at: Optional[datetime] = None # Make optional
    
    class Config:
        from_attributes = True

# --- Transfer Models ---

class TransferBase(BaseModel):
    origen_id: int
    destino_id: int
    valor: float
    fecha: datetime
    descripcion: Optional[str] = None

class TransferCreate(TransferBase):
    pass

class Transfer(TransferBase):
    id: int
    created_at: datetime
    origen_nombre: Optional[str] = None
    destino_nombre: Optional[str] = None

    class Config:
        from_attributes = True

from pydantic import BaseModel
from typing import Optional

class PaymentMethodBase(BaseModel):
    nombre: str
    tipo: str # digital, efectivo, transferencia
    activo: Optional[bool] = True

class PaymentMethodCreate(PaymentMethodBase):
    pass

class PaymentMethodUpdate(PaymentMethodBase):
    pass

class PaymentMethod(PaymentMethodBase):
    id: int
    
    class Config:
        from_attributes = True

from fastapi import APIRouter, HTTPException, status
from typing import List
from ..database import supabase
from ..models import Supplier, SupplierCreate, SupplierUpdate

router = APIRouter()

@router.get("/", response_model=List[Supplier])
def get_suppliers():
    response = supabase.table("proveedores").select("*").order("nombre").execute()
    return response.data

@router.post("/", response_model=Supplier, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier: SupplierCreate):
    response = supabase.table("proveedores").insert(supplier.dict()).execute()
    return response.data[0]

@router.put("/{supplier_id}", response_model=Supplier)
def update_supplier(supplier_id: int, supplier: SupplierUpdate):
    response = supabase.table("proveedores").update(supplier.dict()).eq("id", supplier_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return response.data[0]

@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int):
    # Check dependencies (e.g. expenses)
    # If using soft delete:
    # supabase.table("proveedores").update({"activo": False}).eq("id", supplier_id).execute()
    # For now, hard delete but handle constraint error if needed. 
    # Usually better to check expenses first.
    expenses = supabase.table("gastos").select("id").eq("proveedor_id", supplier_id).limit(1).execute()
    if expenses.data:
        raise HTTPException(status_code=400, detail="Cannot delete supplier with associated expenses.")
        
    supabase.table("proveedores").delete().eq("id", supplier_id).execute()
    return {"message": "Supplier deleted"}

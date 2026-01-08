from fastapi import APIRouter, HTTPException, status, Query
from typing import List, Optional
from ..database import supabase
from ..models import Product, ProductCreate

router = APIRouter()

@router.get("/", response_model=List[Product])
def get_products(active_only: bool = Query(True, description="Filter by active status")):
    query = supabase.table("productos").select("*").order("nombre")
    if active_only:
        query = query.eq("activo", True)
    response = query.execute()
    return response.data

@router.post("/", response_model=Product, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate):
    response = supabase.table("productos").insert(product.dict()).execute()
    return response.data[0]

@router.put("/{product_id}", response_model=Product)
def update_product(product_id: int, product: ProductCreate):
    response = supabase.table("productos").update(product.dict(exclude_unset=True)).eq("id", product_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Product not found")
    return response.data[0]

from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import List
from sqlalchemy.orm import Session
from database import get_db
from sql_models import Producto
from models import Product, ProductCreate

router = APIRouter()

@router.get("/", response_model=List[Product])
def get_products(
    active_only: bool = Query(True, description="Filter by active status"),
    db: Session = Depends(get_db)
):
    """Get all products, optionally filtered by active status"""
    query = db.query(Producto).order_by(Producto.nombre)
    if active_only:
        query = query.filter(Producto.activo == True)
    return query.all()

@router.post("/", response_model=Product, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product"""
    try:
        db_product = Producto(**product.dict())
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
        return db_product
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{product_id}", response_model=Product)
def update_product(product_id: int, product: ProductCreate, db: Session = Depends(get_db)):
    """Update an existing product"""
    db_product = db.query(Producto).filter(Producto.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    for key, value in product.dict(exclude_unset=True).items():
        setattr(db_product, key, value)
    
    db.commit()
    db.refresh(db_product)
    return db_product

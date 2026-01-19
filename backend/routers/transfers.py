from fastapi import APIRouter, HTTPException, status
from models import Transfer, TransferCreate
from database import supabase
from typing import List

router = APIRouter(prefix="/transfers", tags=["transfers"])

@router.get("/", response_model=List[Transfer])
def get_transfers():
    response = supabase.table("transferencias").select("*").order("created_at", desc=True).execute()
    return response.data

@router.post("/", response_model=Transfer, status_code=status.HTTP_201_CREATED)
def create_transfer(transfer: TransferCreate):
    payload = transfer.dict()
    # Ensure date is serialized correctly
    if payload.get('fecha'):
        payload['fecha'] = str(payload['fecha'])
        
    response = supabase.table("transferencias").insert(payload).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Error creating transfer")
    return response.data[0]

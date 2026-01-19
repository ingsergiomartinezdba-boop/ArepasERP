from fastapi import APIRouter, HTTPException, status
from ..models import Transfer, TransferCreate
from ..database import supabase
from typing import List

router = APIRouter(tags=["transfers"])

@router.get("/", response_model=List[Transfer])
def get_transfers():
    # Fetch transfers
    transfers_res = supabase.table("transferencias").select("*").order("created_at", desc=True).execute()
    transfers = transfers_res.data
    
    if not transfers:
        return []

    # Fetch all payment methods for mapping (include inactive ones for history)
    methods_res = supabase.table("medios_pago").select("id, nombre").execute()
    methods_map = {m['id']: m['nombre'] for m in methods_res.data}
    
    # Map names
    for t in transfers:
        t['origen_nombre'] = methods_map.get(t['origen_id'], "Desconocido")
        t['destino_nombre'] = methods_map.get(t['destino_id'], "Desconocido")
        
    return transfers

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

@router.get("/balances")
def get_balances():
    try:
        response = supabase.table("view_saldos_medios_pago").select("*").execute()
        return response.data
    except Exception as e:
        print(f"Error fetching balances: {e}")
        # Return empty list or basic structure if view doesn't exist yet to prevent crash
        return []

from fastapi import APIRouter, HTTPException, status
from typing import List
from ..database import supabase
from ..models import Client, ClientCreate, ClientUpdate

router = APIRouter()

@router.get("/", response_model=List[Client])
def get_clients():
    response = supabase.table("clientes").select("*").order("nombre").execute()
    return response.data

@router.get("/{client_id}", response_model=Client)
def get_client(client_id: int):
    response = supabase.table("clientes").select("*").eq("id", client_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Client not found")
    return response.data[0]

@router.post("/", response_model=Client, status_code=status.HTTP_201_CREATED)
def create_client(client: ClientCreate):
    client_data = client.dict()
    response = supabase.table("clientes").insert(client_data).execute()
    return response.data[0]

@router.put("/{client_id}", response_model=Client)
def update_client(client_id: int, client: ClientUpdate):
    response = supabase.table("clientes").update(client.dict(exclude_unset=True)).eq("id", client_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Client not found")
    return response.data[0]

@router.delete("/{client_id}")
def delete_client(client_id: int):
    supabase.table("clientes").delete().eq("id", client_id).execute()
    return {"message": "Client deleted successfully"}

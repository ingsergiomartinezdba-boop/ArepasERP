from fastapi import APIRouter, HTTPException, status
from typing import List
from ..database import supabase
from ..models import Expense, ExpenseCreate

router = APIRouter()

@router.get("/", response_model=List[Expense])
def get_expenses(start_date: str = None, end_date: str = None):
    query = supabase.table("gastos").select("*, proveedores(nombre)").order("fecha", desc=True)
    
    if start_date and end_date:
        if len(end_date) == 10:
             end_date += "T23:59:59"
        query = query.gte("fecha", start_date).lte("fecha", end_date)
    else:
        query = query.limit(100)
        
    response = query.execute()
    
    expenses = []
    for g in response.data:
        g['proveedor_nombre'] = g['proveedores']['nombre'] if g.get('proveedores') else None
        expenses.append(g)
        
    return expenses

@router.put("/{expense_id}", response_model=Expense)
def update_expense(expense_id: int, expense: ExpenseCreate):
    response = supabase.table("gastos").update(expense.dict()).eq("id", expense_id).execute()
    if not response.data:
         raise HTTPException(status_code=404, detail="Expense not found")
    return response.data[0]

@router.post("/", response_model=Expense, status_code=status.HTTP_201_CREATED)
def create_expense(expense: ExpenseCreate):
    response = supabase.table("gastos").insert(expense.dict()).execute()
    return response.data[0]

@router.delete("/{expense_id}")
def delete_expense(expense_id: int):
    supabase.table("gastos").delete().eq("id", expense_id).execute()
    return {"message": "Expense deleted"}

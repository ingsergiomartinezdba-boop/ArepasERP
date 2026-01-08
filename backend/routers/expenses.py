from fastapi import APIRouter, HTTPException, status
from typing import List
from ..database import supabase
from ..models import Expense, ExpenseCreate

router = APIRouter()

@router.get("/", response_model=List[Expense])
def get_expenses():
    response = supabase.table("gastos").select("*").order("fecha", desc=True).limit(100).execute()
    return response.data

@router.post("/", response_model=Expense, status_code=status.HTTP_201_CREATED)
def create_expense(expense: ExpenseCreate):
    response = supabase.table("gastos").insert(expense.dict()).execute()
    return response.data[0]

@router.delete("/{expense_id}")
def delete_expense(expense_id: int):
    supabase.table("gastos").delete().eq("id", expense_id).execute()
    return {"message": "Expense deleted"}

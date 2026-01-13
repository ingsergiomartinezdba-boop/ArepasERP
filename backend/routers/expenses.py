from fastapi import APIRouter, HTTPException, status
from typing import List
from ..database import supabase
from ..models import Expense, ExpenseCreate
from datetime import datetime

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
    payload = expense.dict()
    payload['updated_at'] = datetime.now().isoformat()
    
    # Logic: if Paid and fecha_pago None -> Set it to NOW
    if payload.get('medio_pago_id'):
        if not payload.get('fecha_pago'):
            payload['fecha_pago'] = datetime.now().isoformat()
    else:
        # Switched to Credit or Unpaid -> Clear payment date
        payload['fecha_pago'] = None

    # Serialize dates
    if payload.get('fecha'): payload['fecha'] = str(payload['fecha'])

    response = supabase.table("gastos").update(payload).eq("id", expense_id).execute()
    if not response.data:
         raise HTTPException(status_code=404, detail="Expense not found")
    return response.data[0]

@router.post("/", response_model=Expense, status_code=status.HTTP_201_CREATED)
def create_expense(expense: ExpenseCreate):
    try:
        # 1. Prepare Payload
        payload = expense.dict()
        payload['fecha'] = str(payload['fecha'])
        
        # Auto-set Payment Date if Paid and Missing
        # Default to Expense Date for initial entry if not specified
        if payload.get('medio_pago_id') and not payload.get('fecha_pago'):
             payload['fecha_pago'] = payload['fecha'] 

        # 2. Create Expense
        response = supabase.table("gastos").insert(payload).execute()
        if not response.data:
             raise HTTPException(status_code=400, detail="Failed to create expense record")
        new_expense = response.data[0]
        
        # 3. If Credit (No Payment Method) and has Provider -> Create Account Payable
        if not expense.medio_pago_id and expense.proveedor_id:
            debt_data = {
                "proveedor_id": expense.proveedor_id,
                "concepto": f"Gasto: {expense.concepto}",
                "valor": expense.valor,
                "fecha": str(expense.fecha),
                "estado": "pendiente"
            }
            try:
                print(f"Creating debt for provider {expense.proveedor_id}...")
                supabase.table("cuentas_pagar").insert(debt_data).execute()
            except Exception as e:
                print(f"Error creating account payable: {e}")
                
        return new_expense
    except Exception as outer_e:
        print(f"CRITICAL ERROR in create_expense: {outer_e}")
        raise HTTPException(status_code=500, detail=str(outer_e))

@router.delete("/{expense_id}")
def delete_expense(expense_id: int):
    supabase.table("gastos").delete().eq("id", expense_id).execute()
    return {"message": "Expense deleted"}

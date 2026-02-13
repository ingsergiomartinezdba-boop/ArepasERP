from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .routers import orders, clients, products, expenses, reports, payment_methods, suppliers, transfers, receivables, auth
from .auth import get_current_user

app = FastAPI(
    title="Arepas Factory ERP API",
    description="Backend for Arepas Factory Management System",
    version="1.1.0"
)
print("SERVER RELOADING V1.1.0 - VENDOR REPORT ENABLED...")

# CORS Configuration - Restrict in production, allow specific for now
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "*" # Keep * for mobile testing for now, but mark as TODO to remove
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Arepas Factory ERP API"}

# Public Routes (No authentication required)
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
print(f"[DEBUG] Auth router registered with {len(auth.router.routes)} routes")

# Protected Routes
app.include_router(clients.router, prefix="/api/clients", tags=["Clients"], dependencies=[Depends(get_current_user)])
app.include_router(products.router, prefix="/api/products", tags=["Products"], dependencies=[Depends(get_current_user)])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"], dependencies=[Depends(get_current_user)])
app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"], dependencies=[Depends(get_current_user)])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"], dependencies=[Depends(get_current_user)])
app.include_router(payment_methods.router, prefix="/api/payment-methods", tags=["Payment Methods"], dependencies=[Depends(get_current_user)])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["Suppliers"], dependencies=[Depends(get_current_user)])
app.include_router(transfers.router, prefix="/api/transfers", tags=["Transfers"], dependencies=[Depends(get_current_user)])
app.include_router(receivables.router, prefix="/api/receivables", tags=["Receivables"])

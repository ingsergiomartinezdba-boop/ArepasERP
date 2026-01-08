from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import orders, clients, products, expenses, reports

app = FastAPI(
    title="Arepas Factory ERP API",
    description="Backend for Arepas Factory Management System",
    version="1.0.0"
)

# CORS Configuration - Allow all for development simplicity (mobile access)
origins = ["*"]

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

app.include_router(clients.router, prefix="/api/clients", tags=["Clients"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])

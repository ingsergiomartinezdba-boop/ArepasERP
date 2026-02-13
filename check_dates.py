
from sqlalchemy import create_engine, text
import os

db_path = os.path.join(os.getcwd(), 'backend', 'arepas.db')
engine = create_engine(f'sqlite:///{db_path}')

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, fecha, created_at, estado FROM pedidos WHERE estado IN ('pendiente', 'parcial') LIMIT 20"))
    rows = result.fetchall()
    print("ORDERS PENDING/PARTIAL:")
    for row in rows:
        print(f"ID: {row[0]}, Fecha: {row[1]}, CreatedAt: {row[2]}, Estado: {row[3]}")

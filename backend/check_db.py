
from database import supabase
import json

try:
    print("Checking Pagos Recibidos...")
    res = supabase.table("pagos_recibidos").select("*").execute()
    payments = res.data
    print(f"Found {len(payments)} payments.")
    for p in payments:
        print(f"ID: {p['id']}, Cliente: {p.get('cliente_id')}, Monto: {p['monto']}")

except Exception as e:
    print(f"Error: {e}")

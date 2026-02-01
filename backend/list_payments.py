from database import supabase

res = supabase.table('pagos_recibidos').select('*').execute()
print(f'Total payments: {len(res.data)}')
for p in res.data:
    print(f'Payment {p["id"]}: Client {p["cliente_id"]} - ${p["monto"]}')

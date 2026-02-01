
import requests
import json

BASE_URL = "http://localhost:8000/api/receivables"

def inspect_payments():
    print(f"Fetching history from {BASE_URL}/history ...")
    try:
        # Assuming the history endpoint works without auth for local debug or I need to handle auth.
        # The router has dependencies=[Depends(get_current_user)].
        # I cannot easily call it without a token if auth is enforced.
        # But wait, looking at my verify_api.py, it doesn't use auth headers?
        # verify_api.py used /ping which might not have auth?
        # receivables.py: @router.get("/ping") has no dependencies.
        # @router.get("/history", dependencies=[Depends(get_current_user)]) HAS dependencies.
        
        # I need to bypass auth or generate a token, or query supabase directly if I had credentials.
        # Since I am in the backend environment, I can import supabase client directly.
        pass
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # We will try to import supabase ensuring we are in the right path
    import sys
    import os
    sys.path.append(os.getcwd())
    
    try:
        from backend.database import supabase
        print("Querying pagos_recibidos directly via Supabase client...")
        res = supabase.table("pagos_recibidos").select("*").execute()
        print(f"Total Payments Found: {len(res.data)}")
        for p in res.data:
            print(f"ID: {p['id']} - Client: {p['cliente_id']} - Amount: {p['monto']}")
            
        print("\nQuerying pagos_pedidos...")
        res_links = supabase.table("pagos_pedidos").select("*").execute()
        print(f"Total Links Found: {len(res_links.data)}")
        for l in res_links.data:
             print(f"Link ID: {l['id']} - Payment: {l['pago_id']} - Order: {l['pedido_id']}")

    except ImportError:
        print("Could not import backend.database. Make sure you run this from the root 'ArepasERP' directory.")
    except Exception as e:
        print(f"Error querying DB: {e}")

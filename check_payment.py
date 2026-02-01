from backend.database import supabase

def check_payment():
    res = supabase.table("pagos_recibidos").select("*").eq("id", 1).execute()
    print(f"Payment 1: {res.data}")
    
    all_res = supabase.table("pagos_recibidos").select("id").limit(10).execute()
    print(f"First 10 payment IDs: {[r['id'] for r in all_res.data]}")

if __name__ == "__main__":
    check_payment()

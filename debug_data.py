from backend.database import supabase
import sys

try:
    print("Testing connection to 'clientes' table...")
    response = supabase.table("clientes").select("*").execute()
    
    print(f"Status Code: 200 (Assumed if no error)")
    print(f"Rows found: {len(response.data)}")
    
    if len(response.data) > 0:
        print("First client:", response.data[0])
    else:
        print("WARNING: No clients found. Possible causes:")
        print("1. Table is empty.")
        print("2. RLS (Row Level Security) is enabled and blocking access.")
        
except Exception as e:
    print(f"ERROR: {e}")

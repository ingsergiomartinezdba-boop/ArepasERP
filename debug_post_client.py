from backend.database import supabase
import sys

def test_create_client():
    print("--- TESTING BACKEND CLIENT CREATION LOGIC ---")
    
    # Mock data exactly like Pydantic would produce
    client_data = {
        "nombre": "Test Client Debug",
        "tipo_cliente": "minorista",
        "telefono": "3001234567",
        "direccion": "Calle 100 # 15-20",
        "ciudad": "Bogotá",
        "canal_venta": "local",
        "condicion_pago": "contado",
        "cupo_credito": 0.0
    }
    
    try:
        print(f"Attempting to INSERT: {client_data}")
        response = supabase.table("clientes").insert(client_data).execute()
        
        print(f"Status: {response}")
        print(f"Data returned: {response.data}")
        
        # This is where the Backend crashes if list is empty
        if len(response.data) > 0:
            print("✅ SUCCESS: Client created and data returned.")
            print(f"ID: {response.data[0]['id']}")
        else:
            print("❌ FAILURE: Insert executed but NO DATA returned.")
            print("   This causes IndexError in the backend.")
            print("   Reason: RLS Policy allows INSERT but blocks SELECT/RETURNING.")
            
    except Exception as e:
        print(f"❌ CRITICAL EXCEPTION: {e}")

if __name__ == "__main__":
    test_create_client()

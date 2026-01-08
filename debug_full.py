from backend.database import supabase
import sys

def test_table():
    print("--- TESTING TABLE 'clientes' ---")
    try:
        response = supabase.table("clientes").select("*").execute()
        print(f"✅ Success. Rows detected: {len(response.data)}")
        if len(response.data) > 0:
             print(f"Sample: {response.data[0]}")
        else:
             print("⚠️  Table accessed but appears EMPTY. If you have data, RLS is likely blocking it.")
    except Exception as e:
        print(f"❌ Error accessing table: {e}")

def test_view():
    print("\n--- TESTING VIEW 'view_resumen_diario_kpis' (Dashboard) ---")
    try:
        # Views are accessed like tables in Supabase
        response = supabase.table("view_resumen_diario_kpis").select("*").execute()
        print(f"✅ Success. Rows detected: {len(response.data)}")
        print(f"Data: {response.data}")
    except Exception as e:
        print(f"❌ Error accessing View: {e}")
        print("Possible cause: View does not exist in database.")

if __name__ == "__main__":
    print("Running Diagnostics...")
    test_table()
    test_view()
    print("\nDone.")

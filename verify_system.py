import requests
import socket
import sys
import os
from backend.database import supabase

def check_port(host, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex((host, port))
    sock.close()
    return result == 0

def check_backend_health():
    print("\n[2] Checking Backend Server (localhost:8000)...")
    if not check_port("localhost", 8000):
        print("❌ Port 8000 is CLOSED. The Backend is NOT running.")
        print("   -> Please run 'run_app.bat' and keep the window open.")
        return False
    
    try:
        r = requests.get("http://localhost:8000/")
        if r.status_code == 200:
            print("✅ Backend is responding (Root URL OK)")
        else:
            print(f"⚠️ Backend responding with {r.status_code}")
            
        # Check API
        r_api = requests.get("http://localhost:8000/api/reports/dashboard")
        if r_api.status_code == 200:
            print("✅ Dashboard API is working!")
            print(f"   Response: {r_api.json()}")
        else:
            print(f"❌ Dashboard API returned error: {r_api.status_code}")
            print(f"   Detail: {r_api.text}")
            
    except Exception as e:
        print(f"❌ Error connecting to backend: {e}")
        return False
    return True

def check_db():
    print("\n[1] Checking Database Connection...")
    try:
        # Supabase check
        res = supabase.table("medios_pago").select("id").limit(1).execute()
        print("✅ Database Connection SUCCESS")
    except Exception as e:
        print(f"❌ Database Connection FAILED: {e}")

if __name__ == "__main__":
    print("=== AREPAS ERP DIAGNOSTIC TOOL ===")
    check_db()
    check_backend_health()
    print("\nValidations Complete.")
    input("Press Enter to exit...")

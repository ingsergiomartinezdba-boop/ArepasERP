import os
from dotenv import load_dotenv
from supabase import create_client

# Load env variables explicitly from the path just to be sure
# Assuming script is run from project root or backend folder
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

print(f"Checking connection with:")
print(f"URL: {url}")
print(f"KEY: {'*' * 10 if key else 'None'}")

if not url or not key:
    print("X ERROR: SUPABASE_URL or SUPABASE_KEY not found in environment variables.")
    print("Please create a '.env' file in the 'ArepasERP' directory with your Supabase credentials.")
    exit(1)

try:
    print("Attempting to connect to Supabase...")
    supabase = create_client(url, key)
    
    # Try a simple query to verify connection (e.g., list tables or just a health check)
    # Since we can't easily list tables with client, we'll try to select from 'medios_pago' which should exist and be small
    response = supabase.table("medios_pago").select("count", count="exact").execute()
    
    print("SUCCESS: Connected to Supabase!")
    print(f"Found {response.count} entries in 'medios_pago'.")
    
except Exception as e:
    print(f"X CONNECTION FAILED: {str(e)}")
    print("Please check your Supabase URL and Key.")
    exit(1)

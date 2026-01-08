import os
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path

# Explicitly find the .env file in the parent directory (ArepasERP root)
# This is safer than relying on CWD
base_dir = Path(__file__).resolve().parent.parent
env_path = base_dir / '.env'

load_dotenv(dotenv_path=env_path)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

print(f"--- DB CONFIG ---")
print(f"Loading env from: {env_path}")
if url:
    print(f"Supabase URL loaded: {url[:15]}...") 
else:
    print("Supabase URL NOT found!")

if not url or not key:
    raise ValueError("Supabase URL and Key must be set in .env file")

try:
    supabase: Client = create_client(url, key)
except Exception as e:
    print(f"Error creating Supabase client: {e}")
    raise e

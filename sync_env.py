import os

def sync_env():
    root_env = '.env'
    frontend_env = 'frontend/.env'
    
    if not os.path.exists(root_env):
        print("Root .env not found!")
        return

    print(f"Reading {root_env}...")
    with open(root_env, 'r') as f:
        lines = f.readlines()

    new_lines = []
    found_url = False
    found_key = False

    for line in lines:
        line = line.strip()
        if line.startswith('SUPABASE_URL='):
            val = line.split('=', 1)[1]
            new_lines.append(f"VITE_SUPABASE_URL={val}\n")
            found_url = True
        elif line.startswith('SUPABASE_KEY='):
            val = line.split('=', 1)[1]
            new_lines.append(f"VITE_SUPABASE_KEY={val}\n")
            found_key = True

    if found_url and found_key:
        print(f"Writing {frontend_env}...")
        with open(frontend_env, 'w') as f:
            f.writelines(new_lines)
        print("✅ Success! Frontend .env created.")
    else:
        print("❌ Could not find SUPABASE_URL or SUPABASE_KEY in root .env")

if __name__ == "__main__":
    sync_env()

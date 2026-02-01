# Script simplificado usando pgcrypto de PostgreSQL
import psycopg2

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'app_arepaserp',
    'password': 'xdr5tgb',
    'database': 'ArepasERP'
}

def update_user_password():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("[OK] Conexion exitosa")
        
        cur = conn.cursor()
        
        # Verificar usuario existente
        cur.execute("SELECT id, email, nombre FROM usuarios WHERE email = %s", ('smchecho@hotmail.com',))
        user = cur.fetchone()
        
        if user:
            print(f"[INFO] Usuario encontrado: {user[2]} ({user[1]})")
            
            # Actualizar contraseña usando pgcrypto
            cur.execute("""
                UPDATE usuarios 
                SET password_hash = crypt(%s, gen_salt('bf'))
                WHERE email = %s
            """, ('xdr5tgb', 'smchecho@hotmail.com'))
            
            conn.commit()
            print("[OK] Contraseña actualizada exitosamente")
            
            # Verificar que funciona
            cur.execute("""
                SELECT (password_hash = crypt(%s, password_hash)) AS password_match
                FROM usuarios 
                WHERE email = %s
            """, ('xdr5tgb', 'smchecho@hotmail.com'))
            
            match = cur.fetchone()[0]
            
            if match:
                print("[OK] Verificacion de contraseña exitosa!")
                print("\n" + "="*50)
                print("CREDENCIALES DE ACCESO:")
                print("="*50)
                print("Email:    smchecho@hotmail.com")
                print("Password: xdr5tgb")
                print("="*50)
            else:
                print("[ERROR] La verificacion de contraseña fallo")
        else:
            print("[INFO] Usuario no existe. Creando...")
            
            cur.execute("""
                INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
                VALUES (%s, crypt(%s, gen_salt('bf')), %s, %s, %s)
                RETURNING id
            """, ('smchecho@hotmail.com', 'xdr5tgb', 'Usuario Principal', 'admin', True))
            
            new_id = cur.fetchone()[0]
            conn.commit()
            print(f"[OK] Usuario creado (ID: {new_id})")
            print("\n" + "="*50)
            print("CREDENCIALES DE ACCESO:")
            print("="*50)
            print("Email:    smchecho@hotmail.com")
            print("Password: xdr5tgb")
            print("="*50)
        
        # Probar login via API
        print("\n[INFO] Probando login via API...")
        import requests
        
        try:
            response = requests.post(
                'http://localhost:8000/api/auth/login',
                json={'email': 'smchecho@hotmail.com', 'password': 'xdr5tgb'},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                print("[OK] Login via API exitoso!")
                print(f"  Usuario: {data['user']['nombre']}")
                print(f"  Rol: {data['user']['rol']}")
            else:
                print(f"[ERROR] Login via API fallo: {response.status_code}")
                print(f"  Detalle: {response.text}")
        except requests.exceptions.ConnectionError:
            print("[WARNING] Backend no esta corriendo en http://localhost:8000")
        except Exception as e:
            print(f"[WARNING] Error probando API: {e}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("ACTUALIZACION DE USUARIO Y CONTRASEÑA")
    print("="*60 + "\n")
    update_user_password()

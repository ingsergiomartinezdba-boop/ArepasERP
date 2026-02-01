# Script para verificar conexión y crear usuario
import psycopg2
from passlib.context import CryptContext

# Configuración
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'app_arepaserp',
    'password': 'xdr5tgb',
    'database': 'ArepasERP'
}

# Configurar bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def test_connection_and_create_user():
    try:
        # Conectar a la base de datos
        conn = psycopg2.connect(**DB_CONFIG)
        print("[OK] Conexion exitosa a la base de datos")
        
        cur = conn.cursor()
        
        # 1. Verificar si existe la tabla usuarios
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'usuarios'
            );
        """)
        table_exists = cur.fetchone()[0]
        
        if not table_exists:
            print("[ERROR] La tabla 'usuarios' no existe. Ejecuta el schema SQL primero.")
            return False
        
        print("[OK] Tabla 'usuarios' encontrada")
        
        # 2. Verificar usuarios existentes
        cur.execute("SELECT id, email, nombre, rol FROM usuarios")
        users = cur.fetchall()
        
        print(f"\n[INFO] Usuarios existentes ({len(users)}):")
        for user in users:
            print(f"  - ID: {user[0]}, Email: {user[1]}, Nombre: {user[2]}, Rol: {user[3]}")
        
        # 3. Verificar si existe el usuario smchecho@hotmail.com
        cur.execute("SELECT id, email FROM usuarios WHERE email = %s", ('smchecho@hotmail.com',))
        existing_user = cur.fetchone()
        
        if existing_user:
            print(f"\n[INFO] Usuario 'smchecho@hotmail.com' ya existe (ID: {existing_user[0]})")
            print("[INFO] Actualizando contraseña...")
            
            # Hashear la nueva contraseña
            hashed_password = pwd_context.hash('xdr5tgb')
            
            # Actualizar contraseña
            cur.execute("""
                UPDATE usuarios 
                SET password_hash = %s 
                WHERE email = %s
            """, (hashed_password, 'smchecho@hotmail.com'))
            
            conn.commit()
            print("[OK] Contraseña actualizada exitosamente")
        else:
            print(f"\n[INFO] Usuario 'smchecho@hotmail.com' no existe. Creando...")
            
            # Hashear la contraseña
            hashed_password = pwd_context.hash('xdr5tgb')
            
            # Crear usuario
            cur.execute("""
                INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, ('smchecho@hotmail.com', hashed_password, 'Usuario Principal', 'admin', True))
            
            new_id = cur.fetchone()[0]
            conn.commit()
            print(f"[OK] Usuario creado exitosamente (ID: {new_id})")
        
        # 4. Verificar que la contraseña funciona
        cur.execute("SELECT password_hash FROM usuarios WHERE email = %s", ('smchecho@hotmail.com',))
        stored_hash = cur.fetchone()[0]
        
        if pwd_context.verify('xdr5tgb', stored_hash):
            print("\n[OK] Verificacion de contraseña exitosa!")
            print("\nCredenciales de acceso:")
            print("  Email: smchecho@hotmail.com")
            print("  Password: xdr5tgb")
        else:
            print("\n[ERROR] La verificacion de contraseña fallo")
        
        # 5. Probar login via API
        print("\n[INFO] Probando login via API...")
        import requests
        
        try:
            response = requests.post(
                'http://localhost:8000/api/auth/login',
                json={
                    'email': 'smchecho@hotmail.com',
                    'password': 'xdr5tgb'
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                print("[OK] Login via API exitoso!")
                print(f"  Token: {data['access_token'][:50]}...")
                print(f"  Usuario: {data['user']['nombre']}")
            else:
                print(f"[ERROR] Login via API fallo: {response.status_code}")
                print(f"  Respuesta: {response.text}")
        except Exception as e:
            print(f"[WARNING] No se pudo probar API (backend no disponible?): {e}")
        
        cur.close()
        conn.close()
        return True
        
    except psycopg2.OperationalError as e:
        print(f"[ERROR] Error de conexion: {e}")
        print("\nVerifica que:")
        print("  1. PostgreSQL este corriendo")
        print("  2. La base de datos 'ArepasERP' exista")
        print("  3. El usuario 'app_arepaserp' tenga permisos")
        return False
    except Exception as e:
        print(f"[ERROR] Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("VALIDACION DE BASE DE DATOS Y USUARIO")
    print("=" * 60)
    print()
    test_connection_and_create_user()

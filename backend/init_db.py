# Script para inicializar la base de datos local
# Ejecutar: python -m backend.init_db

import os
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

load_dotenv()

# Configuración de conexión — desde variables de entorno
DB_CONFIG = {
    'host': os.getenv("DB_HOST", "localhost"),
    'port': int(os.getenv("DB_PORT", "5432")),
    'user': os.getenv("DB_USER", "app_arepaserp"),
    'password': os.getenv("DB_PASS"),
    'database': os.getenv("DB_NAME", "ArepasERP")
}

def test_connection():
    """Verificar conexión a la base de datos"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("[OK] Conexion exitosa a la base de datos ArepasERP")
        
        # Verificar tablas existentes
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cur.fetchall()
        
        if tables:
            print(f"\nTablas encontradas ({len(tables)}):")
            for table in tables:
                print(f"   - {table[0]}")
        else:
            print("\n[AVISO] No se encontraron tablas. Ejecuta el schema SQL primero:")
            print("   psql -U app_arepaserp -d ArepasERP -f database/schema_local.sql")
        
        # Verificar usuario admin
        cur.execute("SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'")
        admin_count = cur.fetchone()[0]
        
        if admin_count > 0:
            print(f"\n[USUARIO] Administrador(es) encontrado(s): {admin_count}")
        else:
            print("\n[AVISO] No hay usuarios administradores. Ejecuta el schema SQL.")
        
        cur.close()
        conn.close()
        
        return True
        
    except psycopg2.OperationalError as e:
        print(f"[ERROR] Error de conexion: {e}")
        print("\nVerifica que:")
        print("  1. PostgreSQL esté corriendo")
        print("  2. La base de datos 'ArepasERP' exista")
        print("  3. El usuario 'app_arepaserp' tenga permisos")
        return False
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

if __name__ == "__main__":
    print("Verificando configuracion de base de datos local...\n")
    test_connection()

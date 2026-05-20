# Script para crear o actualizar contraseña de usuario (usa bcrypt via passlib)
# Uso: python3 backend/update_user_password.py

import os
import sys
import getpass
import psycopg2
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

DB_CONFIG = {
    'host': os.getenv("DB_HOST", "localhost"),
    'port': int(os.getenv("DB_PORT", "5432")),
    'user': os.getenv("DB_USER", "app_arepaserp"),
    'password': os.getenv("DB_PASS"),
    'database': os.getenv("DB_NAME", "ArepasERP")
}

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def update_or_create_user():
    email = input("Email del usuario: ").strip()
    if not email:
        print("[ERROR] El email no puede estar vacío.")
        sys.exit(1)

    password = getpass.getpass("Nueva contraseña: ")
    if len(password) < 8:
        print("[ERROR] La contraseña debe tener al menos 8 caracteres.")
        sys.exit(1)

    confirm = getpass.getpass("Confirmar contraseña: ")
    if password != confirm:
        print("[ERROR] Las contraseñas no coinciden.")
        sys.exit(1)

    hashed = pwd_context.hash(password)

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        cur.execute("SELECT id, nombre, rol FROM usuarios WHERE email = %s", (email,))
        user = cur.fetchone()

        if user:
            cur.execute(
                "UPDATE usuarios SET password_hash = %s WHERE email = %s",
                (hashed, email)
            )
            conn.commit()
            print(f"[OK] Contraseña actualizada para {user[1]} ({email})")
        else:
            nombre = input("Nombre completo del nuevo usuario: ").strip()
            rol = input("Rol [admin/user] (default: user): ").strip() or "user"
            cur.execute(
                "INSERT INTO usuarios (email, password_hash, nombre, rol, activo) VALUES (%s, %s, %s, %s, TRUE)",
                (email, hashed, nombre, rol)
            )
            conn.commit()
            print(f"[OK] Usuario creado: {nombre} ({email}) rol={rol}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  GESTIÓN DE CONTRASEÑAS - ArepasERP")
    print("=" * 50 + "\n")
    update_or_create_user()

#!/usr/bin/env python
"""Script de diagnóstico para verificar el estado del servidor"""
import requests
import json

print("="*60)
print("DIAGNOSTICO DEL SERVIDOR")
print("="*60)

# 1. Verificar que el servidor responde
print("\n1. Verificando servidor...")
try:
    r = requests.get('http://localhost:8000/')
    print(f"   [OK] Servidor responde: {r.json()}")
except Exception as e:
    print(f"   [ERROR] Servidor no responde: {e}")
    exit(1)

# 2. Listar todas las rutas
print("\n2. Listando rutas disponibles...")
try:
    r = requests.get('http://localhost:8000/openapi.json')
    paths = list(r.json()['paths'].keys())
    print(f"   Total de rutas: {len(paths)}")
    
    auth_paths = [p for p in paths if 'auth' in p.lower()]
    if auth_paths:
        print(f"   [OK] Rutas de auth encontradas:")
        for p in auth_paths:
            print(f"      - {p}")
    else:
        print(f"   [ERROR] NO se encontraron rutas de auth")
        print(f"   Rutas disponibles:")
        for p in sorted(paths)[:10]:
            print(f"      - {p}")
        print(f"      ... ({len(paths)} rutas en total)")
except Exception as e:
    print(f"   [ERROR] No se pudo obtener OpenAPI: {e}")

# 3. Probar login
print("\n3. Probando login...")
try:
    r = requests.post(
        'http://localhost:8000/api/auth/login',
        json={'email': 'smchecho@hotmail.com', 'password': 'xdr5tgb'}
    )
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"   [OK] Login exitoso!")
        print(f"   Usuario: {data['user']['nombre']}")
        print(f"   Token: {data['access_token'][:50]}...")
    else:
        print(f"   [ERROR] Login fallo")
        print(f"   Respuesta: {r.text}")
except Exception as e:
    print(f"   [ERROR] Error en login: {e}")

print("\n" + "="*60)

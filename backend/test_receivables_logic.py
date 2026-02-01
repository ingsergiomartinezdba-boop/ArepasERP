
import requests
import json
from datetime import datetime
import time

BASE_URL = "http://localhost:8000/api"

def create_client():
    r = requests.post(f"{BASE_URL}/clients/", json={
        "nombre": "Test Client Receivables",
        "tipo_cliente": "local",
        "ciudad": "Bogotá"
    })
    return r.json()

def create_order(client_id, total, date_str):
    # Minimal order creation
    r = requests.post(f"{BASE_URL}/orders/", json={
        "cliente_id": client_id,
        "items": [], # Empty items allowed? logic might fail. Let's add a dummy item or override total if backend allows.
        # Backend calculates total from items usually.
        # Let's check order creation logic.
        # Actually backend calculates total from items.
        # I need a product.
        "fecha": date_str,
        "estado": "pendiente"
    })
    # Wait, looking at order creation in backend, it sums items.
    # I should check models.py or orders router.
    return r

def create_product():
    r = requests.post(f"{BASE_URL}/products/", json={
        "nombre": "Test Product",
        "codigo_corto": "TP",
        "tipo_producto": "arepa",
        "precio_estandar": 1000,
        "costo_unitario": 500,
        "unidad_medida": "und"
    })
    return r.json()

def create_order_with_items(client_id, product_id, quantity, date_str):
    r = requests.post(f"{BASE_URL}/orders/", json={
        "cliente_id": client_id,
        "items": [{"producto_id": product_id, "cantidad": quantity}],
        "fecha": date_str,
        "valor_domicilio": 0,
        "estado": "pendiente"
    })
    return r.json()

def test_receivables_flow():
    print("1. Setup Client and Product")
    prod = create_product()
    # Check if prod existing (might fail if duplicate code, but backend usually auto-increments ID, code might be unique constraint)
    # Assuming success or handling.
    if 'id' not in prod:
        # Maybe product with code TP exists.
        products = requests.get(f"{BASE_URL}/products/").json()
        prod = next((p for p in products if p['codigo_corto'] == 'TP'), products[0])

    client = create_client()
    cid = client['id']
    print(f"Client ID: {cid}")

    print("2. Create Orders")
    # Order 1: Old (2025-01-01) - $10000
    o1 = create_order_with_items(cid, prod['id'], 10, "2025-01-01T12:00:00")
    print(f"Order 1: {o1['id']} - Total: {o1['total']}")

    # Order 2: New (2025-01-02) - $10000
    o2 = create_order_with_items(cid, prod['id'], 10, "2025-01-02T12:00:00")
    print(f"Order 2: {o2['id']} - Total: {o2['total']}")

    print("3. Register Payment - $15000")
    # Should pay O1 fully ($10000) and O2 partially ($5000)
    pay_res = requests.post(f"{BASE_URL}/receivables/payments", json={
        "cliente_id": cid,
        "monto": 15000,
        "fecha": "2025-01-03T12:00:00",
        "descripcion": "Test Payment",
        "metodo_pago_id": 1
    })
    payment = pay_res.json()
    pid = payment['id']
    print(f"Payment Registered: {pid}")

    # Verify Orders
    o1_state = requests.get(f"{BASE_URL}/orders/{o1['id']}").json()
    o2_state = requests.get(f"{BASE_URL}/orders/{o2['id']}").json()
    print(f"O1 Paid: {o1_state['monto_pagado']} (Exp: 10000) State: {o1_state['estado']}")
    print(f"O2 Paid: {o2_state['monto_pagado']} (Exp: 5000) State: {o2_state['estado']}")

    assert o1_state['monto_pagado'] == 10000
    assert o2_state['monto_pagado'] == 5000

    print("4. Delete Payment")
    del_res = requests.delete(f"{BASE_URL}/receivables/payments/{pid}")
    print(del_res.json())

    print("5. Verify Revert")
    o1_rev = requests.get(f"{BASE_URL}/orders/{o1['id']}").json()
    o2_rev = requests.get(f"{BASE_URL}/orders/{o2['id']}").json()
    print(f"O1 Paid: {o1_rev['monto_pagado']} (Exp: 0)")
    print(f"O2 Paid: {o2_rev['monto_pagado']} (Exp: 0)")

    # The revert logic:
    # Amount to revert: 15000.
    # Orders with paid > 0 desc date: O2 (newer), O1 (older).
    # O2 has 5000 paid. Revert 5000. O2 becomes 0. Rem revert: 10000.
    # O1 has 10000 paid. Revert 10000. O1 becomes 0. Rem revert: 0.
    # Expect both 0.
    assert o1_rev['monto_pagado'] == 0
    assert o2_rev['monto_pagado'] == 0
    assert o1_rev['estado'] == 'pendiente'
    assert o2_rev['estado'] == 'pendiente'

    print("TEST SUCCESS")

if __name__ == "__main__":
    try:
        test_receivables_flow()
    except Exception as e:
        print(f"TEST FAILED: {e}")

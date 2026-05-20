"""Integración: CRUD de productos."""
import pytest
import uuid


@pytest.mark.integration
class TestProductsCRUD:
    def test_listar_productos(self, client, auth_headers):
        r = client.get("/api/products/", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_crear_producto(self, client, auth_headers, cleanup_test_data):
        nombre = f"TEST_Producto_{uuid.uuid4().hex[:8]}"
        r = client.post("/api/products/", headers=auth_headers, json={
            "nombre": nombre,
            "precio": 1500.0,
            "costo": 800.0,
            "activo": True,
        })
        assert r.status_code == 201, r.text
        data = r.json()
        cleanup_test_data(table="productos", id=data["id"])
        assert data["nombre"] == nombre
        assert data["precio"] == 1500.0

    def test_actualizar_producto(self, client, auth_headers, cleanup_test_data):
        nombre = f"TEST_Producto_{uuid.uuid4().hex[:8]}"
        r = client.post("/api/products/", headers=auth_headers, json={
            "nombre": nombre, "precio": 1000, "costo": 500
        })
        pid = r.json()["id"]
        cleanup_test_data(table="productos", id=pid)

        r2 = client.put(f"/api/products/{pid}", headers=auth_headers, json={
            "nombre": nombre, "precio": 2000, "costo": 1000
        })
        assert r2.status_code == 200, r2.text
        assert r2.json()["precio"] == 2000.0

    def test_actualizar_producto_inexistente(self, client, auth_headers):
        r = client.put("/api/products/99999999", headers=auth_headers, json={
            "nombre": "X", "precio": 1, "costo": 1
        })
        assert r.status_code == 404

    def test_validacion_precio_negativo(self, client, auth_headers):
        r = client.post("/api/products/", headers=auth_headers, json={
            "nombre": "TEST_validation",
            "precio": -1,
            "costo": 0,
        })
        assert r.status_code == 422

    def test_validacion_nombre_vacio(self, client, auth_headers):
        r = client.post("/api/products/", headers=auth_headers, json={
            "nombre": "",
            "precio": 100,
            "costo": 50,
        })
        assert r.status_code == 422

    def test_active_only_filter(self, client, auth_headers):
        r_active = client.get("/api/products/?active_only=true", headers=auth_headers)
        r_all = client.get("/api/products/?active_only=false", headers=auth_headers)
        assert r_active.status_code == 200
        assert r_all.status_code == 200
        # con todos debe haber >= que solo activos
        assert len(r_all.json()) >= len(r_active.json())

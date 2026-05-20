"""Integración de catálogos rápidos: payment-methods, suppliers, parametros."""
import pytest
import uuid


@pytest.mark.integration
class TestPaymentMethods:
    def test_listar(self, client, auth_headers):
        r = client.get("/api/payment-methods/", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_crear_y_borrar(self, client, auth_headers, cleanup_test_data):
        nombre = f"TEST_Medio_{uuid.uuid4().hex[:6]}"
        r = client.post("/api/payment-methods/", headers=auth_headers, json={
            "nombre": nombre,
            "tipo": "efectivo",
            "activo": True,
        })
        assert r.status_code in (200, 201), r.text
        data = r.json()
        cleanup_test_data(table="medios_pago", id=data["id"])
        assert data["nombre"] == nombre


@pytest.mark.integration
class TestSuppliers:
    def test_listar(self, client, auth_headers):
        r = client.get("/api/suppliers/", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_crear(self, client, auth_headers, cleanup_test_data):
        nombre = f"TEST_Proveedor_{uuid.uuid4().hex[:6]}"
        r = client.post("/api/suppliers/", headers=auth_headers, json={
            "nombre": nombre,
            "activo": True,
        })
        assert r.status_code in (200, 201), r.text
        data = r.json()
        cleanup_test_data(table="proveedores", id=data["id"])


@pytest.mark.integration
class TestParametros:
    def test_unidades_devuelve_kg(self, client, auth_headers):
        r = client.get("/api/parametros/unidades", headers=auth_headers)
        assert r.status_code == 200
        codigos = [u["codigo"] for u in r.json()]
        assert "kg" in codigos
        assert "gramo" in codigos

    def test_tipos_cliente_estructura(self, client, auth_headers):
        r = client.get("/api/parametros/tipos-cliente", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        if body:
            assert "codigo" in body[0]
            assert "nombre" in body[0]


@pytest.mark.integration
class TestRoles:
    def test_listar_permisos(self, client, auth_headers):
        r = client.get("/api/roles/permisos", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        assert len(body) > 0
        assert "codigo" in body[0]

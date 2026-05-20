"""Integración: CRUD de clientes."""
import pytest
import uuid


@pytest.mark.integration
class TestClientsCRUD:
    def test_listar_clientes(self, client, auth_headers):
        r = client.get("/api/clients/", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_crear_cliente_minimo(self, client, auth_headers, cleanup_test_data):
        nombre = f"TEST_Cliente_{uuid.uuid4().hex[:8]}"
        r = client.post("/api/clients/", headers=auth_headers, json={
            "nombre": nombre,
            "ciudad": "Bogotá",
        })
        assert r.status_code in (200, 201), r.text
        data = r.json()
        cleanup_test_data(table="clientes", id=data["id"])
        assert data["nombre"] == nombre

    def test_crear_cliente_condicion_pago_invalida(self, client, auth_headers):
        r = client.post("/api/clients/", headers=auth_headers, json={
            "nombre": "TEST_invalid_cond",
            "condicion_pago": "valor_invalido_xxx",
        })
        assert r.status_code == 422

    def test_crear_cliente_cupo_credito_negativo(self, client, auth_headers):
        r = client.post("/api/clients/", headers=auth_headers, json={
            "nombre": "TEST_neg_cupo",
            "cupo_credito": -100,
        })
        assert r.status_code == 422

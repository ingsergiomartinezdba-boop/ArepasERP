"""
Smoke tests — un GET por cada endpoint principal del API.

Objetivo:
- Verificar que cada router responda 200 (o 4xx esperado) sin lanzar 500.
- Validar autenticación: cada protegido devuelve 401 sin token.
- No escribe en BD (read-only).
"""
import pytest


# Lista de endpoints GET sin parámetros que deben responder 200 con admin
PROTECTED_GET_ENDPOINTS = [
    "/api/auth/me",
    "/api/clients/",
    "/api/clients/analytics/solicitudes",
    "/api/clients/analytics/solicitudes/pendientes-count",
    "/api/products/",
    "/api/products/insumos/all",
    "/api/orders/",
    "/api/expenses/",
    "/api/expenses/categorias",
    "/api/expenses/cuentas-por-pagar",
    "/api/expenses/widgets",
    "/api/expenses/adjuntos/config",
    "/api/payment-methods/",
    "/api/suppliers/",
    "/api/transfers/",
    "/api/transfers/balances",
    "/api/receivables/accounts",
    "/api/receivables/history",
    "/api/receivables/ping",
    "/api/inventory/",
    "/api/inventory/movimientos/",
    "/api/insumos/",
    "/api/insumos/stock/resumen",
    "/api/production/lotes",
    "/api/production/cocciones",
    "/api/production/detalle",
    "/api/production/proceso",
    "/api/production/recetas",
    "/api/analytics/ventas",
    "/api/analytics/clientes-top",
    "/api/analytics/productos-top",
    "/api/analytics/rentabilidad",
    "/api/analytics/forecast-masa",
    "/api/costos/historial",
    "/api/costos/indicadores",
    "/api/costos/facturas-servicio",
    "/api/roles/",
    "/api/roles/permisos",
    "/api/roles/usuarios/",
    "/api/config/horario-corte",
    "/api/parametros/parametros",
    "/api/parametros/modulos",
    "/api/parametros/categorias",
    "/api/parametros/subcategorias",
    "/api/parametros/tipos-cliente",
    "/api/parametros/tipos-producto",
    "/api/parametros/unidades",
    "/api/cash-flow/dashboard",
    "/api/cash-flow/categorias",
    "/api/cash-flow/categorias-ingreso",
    "/api/cash-flow/ingresos-manuales",
    "/api/cash-flow/alertas",
    "/api/cash-flow/proyecciones",
    "/api/cash-flow/timeline",
    "/api/reports/dashboard",
    "/api/reports/whatsapp-summary",
]


@pytest.mark.smoke
class TestPublicEndpoints:
    def test_root(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


@pytest.mark.smoke
@pytest.mark.parametrize("endpoint", PROTECTED_GET_ENDPOINTS)
def test_endpoint_sin_auth_devuelve_401_o_403(client, endpoint):
    """Cada endpoint protegido debe rechazar requests sin token."""
    r = client.get(endpoint)
    assert r.status_code in (401, 403), (
        f"{endpoint} respondió {r.status_code} (debería ser 401/403). Body: {r.text[:200]}"
    )


@pytest.mark.smoke
@pytest.mark.parametrize("endpoint", PROTECTED_GET_ENDPOINTS)
def test_endpoint_con_auth_no_devuelve_500(client, auth_headers, endpoint):
    """
    Cada endpoint protegido debe responder algo distinto a 5xx con admin token.
    Acepta 200, 400, 404 (datos faltantes), pero nunca 5xx.
    """
    r = client.get(endpoint, headers=auth_headers)
    assert r.status_code < 500, (
        f"{endpoint} respondió {r.status_code}. Body: {r.text[:400]}"
    )


@pytest.mark.smoke
class TestReportes:
    def test_reports_client_report_requiere_params(self, client, auth_headers):
        # Sin params válidos debería devolver 4xx, no 5xx
        r = client.get("/api/reports/client-report", headers=auth_headers)
        assert r.status_code < 500

    def test_reports_vendor_report_requiere_params(self, client, auth_headers):
        r = client.get("/api/reports/vendor-report", headers=auth_headers)
        assert r.status_code < 500


@pytest.mark.smoke
class TestAuthMe:
    def test_auth_me_devuelve_perfil(self, client, auth_headers):
        r = client.get("/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "email" in data
        assert "permisos" in data
        assert isinstance(data["permisos"], list)

    def test_auth_me_token_invalido(self, client):
        r = client.get("/api/auth/me", headers={"Authorization": "Bearer token_falso_123"})
        assert r.status_code == 401

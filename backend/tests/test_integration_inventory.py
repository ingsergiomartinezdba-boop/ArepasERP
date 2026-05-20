"""Integración: inventario y movimientos."""
import pytest


@pytest.mark.integration
class TestInventory:
    def test_listar_inventario(self, client, auth_headers):
        r = client.get("/api/inventory/", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)

    def test_listar_movimientos(self, client, auth_headers):
        r = client.get("/api/inventory/movimientos/", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_insumos_resumen(self, client, auth_headers):
        r = client.get("/api/insumos/stock/resumen", headers=auth_headers)
        assert r.status_code == 200


@pytest.mark.integration
class TestProduction:
    def test_lotes_listar(self, client, auth_headers):
        r = client.get("/api/production/lotes", headers=auth_headers)
        assert r.status_code == 200

    def test_recetas_listar(self, client, auth_headers):
        r = client.get("/api/production/recetas", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


@pytest.mark.integration
class TestAnalytics:
    def test_ventas_response_structure(self, client, auth_headers):
        r = client.get("/api/analytics/ventas", headers=auth_headers)
        assert r.status_code == 200

    def test_rentabilidad(self, client, auth_headers):
        r = client.get("/api/analytics/rentabilidad", headers=auth_headers)
        assert r.status_code == 200


@pytest.mark.integration
class TestExpensesWidgets:
    """Regresión BUG-001: estructura del endpoint dashboard de gastos."""

    def test_widgets_estructura(self, client, auth_headers):
        r = client.get("/api/expenses/widgets", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # Campos numéricos esperados
        for k in ("total_mes", "pagado_mes", "pendiente_mes", "total_hoy",
                  "total_semana", "promedio_diario", "variacion_pct"):
            assert isinstance(data[k], (int, float)), f"{k} no es numérico: {type(data[k])}"
        # Por tipo de costo: claves deben ser strings (BUG-001 — antes eran tuplas)
        assert isinstance(data["por_tipo_costo"], dict)
        for key in data["por_tipo_costo"].keys():
            assert isinstance(key, str), f"key no es str: {key!r} ({type(key).__name__})"
        # Listas
        assert isinstance(data["top_categorias"], list)
        assert isinstance(data["tendencia_6_meses"], list)
        assert isinstance(data["alertas_sobrecosto"], list)

    def test_widgets_periodo_invalido(self, client, auth_headers):
        r = client.get("/api/expenses/widgets?periodo=no-es-fecha", headers=auth_headers)
        assert r.status_code == 400

    def test_widgets_periodo_explicito(self, client, auth_headers):
        r = client.get("/api/expenses/widgets?periodo=2026-01", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["periodo"] == "2026-01"

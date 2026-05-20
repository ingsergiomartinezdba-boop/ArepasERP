"""
Tests de regresión — autorización (RBAC).

Verifica que:
- Sin token → 401/403
- Token inválido → 401
- Token con email inexistente → 401
- El admin de prueba sí accede a endpoints protegidos
"""
import pytest
import jwt
from datetime import timedelta

from auth import SECRET_KEY, ALGORITHM, create_access_token


@pytest.mark.regression
class TestAutorizacion:
    def test_sin_authorization_header(self, client):
        r = client.get("/api/orders/")
        assert r.status_code in (401, 403)

    def test_authorization_sin_bearer(self, client):
        r = client.get("/api/orders/", headers={"Authorization": "token_sin_bearer"})
        assert r.status_code in (401, 403)

    def test_bearer_vacio(self, client):
        r = client.get("/api/orders/", headers={"Authorization": "Bearer "})
        assert r.status_code in (401, 403)

    def test_jwt_malformado(self, client):
        r = client.get("/api/orders/", headers={"Authorization": "Bearer not.a.jwt"})
        assert r.status_code == 401

    def test_jwt_firmado_con_otro_secret(self, client):
        token = jwt.encode({"sub": "x@example.com"}, "otro_secret", algorithm=ALGORITHM)
        r = client.get("/api/orders/", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    def test_jwt_expirado(self, client):
        token = create_access_token({"sub": "x@example.com"}, expires_delta=timedelta(seconds=-1))
        r = client.get("/api/orders/", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    def test_jwt_usuario_inexistente(self, client):
        token = create_access_token({"sub": "no.existe.nunca@example.com"})
        r = client.get("/api/orders/", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    def test_jwt_sin_sub(self, client):
        token = jwt.encode({"foo": "bar"}, SECRET_KEY, algorithm=ALGORITHM)
        r = client.get("/api/orders/", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    def test_admin_accede_a_todos_los_modulos(self, client, auth_headers):
        # El admin de prueba debe poder ver, al menos, todos estos GET
        for path in ["/api/orders/", "/api/clients/", "/api/products/",
                     "/api/expenses/", "/api/inventory/"]:
            r = client.get(path, headers=auth_headers)
            assert r.status_code == 200, f"{path}: {r.text[:200]}"


@pytest.mark.regression
class TestHeadersSeguridad:
    def test_x_content_type_options(self, client):
        r = client.get("/")
        assert r.headers.get("X-Content-Type-Options") == "nosniff"

    def test_x_frame_options(self, client):
        r = client.get("/")
        assert r.headers.get("X-Frame-Options") == "DENY"

    def test_referrer_policy(self, client):
        r = client.get("/")
        assert r.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

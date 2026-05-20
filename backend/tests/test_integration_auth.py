"""Integración: flujo de login, /me, rate limiting."""
import pytest
from tests.conftest import TEST_USER_EMAIL, TEST_USER_PASSWORD


@pytest.mark.integration
class TestLogin:
    def test_login_exitoso(self, client, ensure_test_user):
        r = client.post("/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == TEST_USER_EMAIL

    def test_login_password_incorrecto(self, client, ensure_test_user):
        r = client.post("/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": "PasswordIncorrecto_xxx",
        })
        assert r.status_code == 401

    def test_login_usuario_inexistente(self, client):
        r = client.post("/api/auth/login", json={
            "email": "noexiste.qa@example.com",
            "password": "cualquiera_xxx",
        })
        assert r.status_code == 401

    def test_login_email_invalido(self, client):
        r = client.post("/api/auth/login", json={
            "email": "no_es_email",
            "password": "abcdef",
        })
        assert r.status_code == 422  # validation error

    def test_login_password_muy_corto(self, client):
        r = client.post("/api/auth/login", json={
            "email": "x@y.com",
            "password": "123",  # < 6 chars
        })
        assert r.status_code == 422

    def test_me_con_token_valido(self, client, auth_headers):
        r = client.get("/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == TEST_USER_EMAIL

    def test_me_sin_token(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code in (401, 403)

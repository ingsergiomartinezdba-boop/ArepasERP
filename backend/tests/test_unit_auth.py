"""Tests unitarios del módulo de autenticación: hashing, verify, JWT."""
import pytest
import jwt
from datetime import timedelta

from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    SECRET_KEY,
    ALGORITHM,
)


@pytest.mark.unit
class TestPasswordHashing:
    def test_hash_no_es_plano(self):
        h = get_password_hash("mi_password_123")
        assert h != "mi_password_123"
        assert len(h) > 20

    def test_verify_password_correcto(self):
        pwd = "Sup3r$ecret"
        h = get_password_hash(pwd)
        assert verify_password(pwd, h) is True

    def test_verify_password_incorrecto(self):
        h = get_password_hash("Sup3r$ecret")
        assert verify_password("OtraPassword", h) is False

    def test_dos_hashes_distintos_para_misma_password(self):
        # bcrypt usa salt aleatorio
        h1 = get_password_hash("test123")
        h2 = get_password_hash("test123")
        assert h1 != h2
        assert verify_password("test123", h1)
        assert verify_password("test123", h2)


@pytest.mark.unit
class TestJWT:
    def test_token_se_genera_y_decodifica(self):
        data = {"sub": "user@example.com"}
        token = create_access_token(data)
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert decoded["sub"] == "user@example.com"
        assert "exp" in decoded

    def test_token_con_expiracion_corta(self):
        token = create_access_token({"sub": "x"}, expires_delta=timedelta(seconds=1))
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in decoded

    def test_token_expirado_lanza_error(self):
        token = create_access_token({"sub": "x"}, expires_delta=timedelta(seconds=-10))
        with pytest.raises(jwt.ExpiredSignatureError):
            jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    def test_token_con_secret_invalido_falla(self):
        token = create_access_token({"sub": "x"})
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, "secret_incorrecto", algorithms=[ALGORITHM])

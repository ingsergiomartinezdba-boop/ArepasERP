"""Tests unitarios del módulo `units` — conversión de unidades."""
import pytest

from units import convertir, es_unidad_valida, GRUPOS, UNIDADES


@pytest.mark.unit
class TestEsUnidadValida:
    def test_unidad_existente_kg(self):
        assert es_unidad_valida("kg") is True

    def test_unidad_existente_mayusculas(self):
        # debe normalizar
        assert es_unidad_valida("KG") is True

    def test_unidad_con_espacios(self):
        assert es_unidad_valida("  kg  ") is True

    def test_unidad_inexistente(self):
        assert es_unidad_valida("xyz_inexistente") is False

    def test_cadena_vacia(self):
        assert es_unidad_valida("") is False

    def test_none(self):
        assert es_unidad_valida(None) is False


@pytest.mark.unit
class TestConvertir:
    def test_misma_unidad(self):
        assert convertir(5.0, "kg", "kg") == 5.0

    def test_kg_a_gramo(self):
        # 1 kg = 1000 gramos
        result = convertir(1.0, "kg", "gramo")
        assert result == pytest.approx(1000.0, rel=1e-3)

    def test_gramo_a_kg(self):
        result = convertir(2500.0, "gramo", "kg")
        assert result == pytest.approx(2.5, rel=1e-3)

    def test_libra_a_kg(self):
        # 1 libra colombiana = 0.5 kg
        assert convertir(2.0, "libra", "kg") == pytest.approx(1.0, rel=1e-3)

    def test_arroba_a_kg(self):
        # 1 arroba = 12.5 kg
        assert convertir(1.0, "arroba", "kg") == pytest.approx(12.5, rel=1e-3)

    def test_litro_a_ml(self):
        assert convertir(1.0, "litro", "ml") == pytest.approx(1000.0, rel=1e-3)

    def test_cantidad_cero(self):
        assert convertir(0, "kg", "gramo") == 0

    def test_cantidad_none(self):
        assert convertir(None, "kg", "gramo") is None

    def test_unidades_distinto_grupo_lanza_error(self):
        # mezclar masa con volumen debe fallar
        with pytest.raises(ValueError):
            convertir(1.0, "kg", "litro")

    def test_unidad_desconocida_lanza_error(self):
        with pytest.raises(ValueError):
            convertir(1.0, "kg", "unidad_inexistente_xyz")

    def test_sin_desde_retorna_cantidad(self):
        assert convertir(5.0, "", "kg") == 5.0

    def test_sin_hasta_retorna_cantidad(self):
        assert convertir(5.0, "kg", None) == 5.0


@pytest.mark.unit
class TestCatalogoUnidades:
    def test_unidades_no_vacio(self):
        assert len(UNIDADES) > 0

    def test_grupos_devuelve_lista(self):
        # Para kg debe devolver lista con kg primero
        grupo = GRUPOS["kg"]
        assert isinstance(grupo, list)
        assert grupo[0] == "kg"

    def test_grupos_unidad_inexistente_retorna_solo_clave(self):
        grupo = GRUPOS["unidad_inexistente_xyz"]
        assert grupo == ["unidad_inexistente_xyz"]

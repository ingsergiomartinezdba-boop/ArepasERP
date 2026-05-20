// Catálogo único de unidades de medida del sistema.
//
// REGLA: KG es la única unidad de peso. UNIDAD para elementos discretos.
// No se aceptan 'lb' / 'libra' / 'pound' en ningún punto del sistema.

export const UNIDADES = ['kg', 'gramo', 'tonelada', 'litro', 'ml', 'cm3', 'unidad'];

// Grupos de unidades intercambiables (para selects encadenados)
export const GRUPOS = {
    kg:       ['kg', 'gramo', 'tonelada'],
    gramo:    ['gramo', 'kg', 'tonelada'],
    tonelada: ['tonelada', 'kg', 'gramo'],
    litro:    ['litro', 'ml', 'cm3'],
    ml:       ['ml', 'litro', 'cm3'],
    cm3:      ['cm3', 'ml', 'litro'],
    unidad:   ['unidad'],
};

// Factores de conversión: { 'desde-hasta': factor }
const FACTOR = {
    'gramo-kg':       0.001,
    'kg-gramo':       1000,
    'tonelada-kg':    1000,
    'kg-tonelada':    0.001,
    'tonelada-gramo': 1_000_000,
    'gramo-tonelada': 0.000001,
    'ml-litro':       0.001,
    'litro-ml':       1000,
    'cm3-litro':      0.001,
    'litro-cm3':      1000,
    'cm3-ml':         1,
    'ml-cm3':         1,
};

export const convertir = (cantidad, desde, hasta) => {
    if (cantidad == null) return cantidad;
    if (!desde || !hasta || desde === hasta) return cantidad;
    const f = FACTOR[`${desde}-${hasta}`];
    return f !== undefined ? cantidad * f : null;
};

// Convierte cualquier unidad de masa a kg.
export const toKg = (cantidad, unidad) => {
    if (cantidad == null) return cantidad;
    if (!unidad) return cantidad;
    const u = unidad.toLowerCase();
    if (u === 'kg') return cantidad;
    if (u === 'gramo') return cantidad * 0.001;
    if (u === 'tonelada') return cantidad * 1000;
    return cantidad;
};

// Formateadores
export const FMT_KG  = (n) => `${Number(n).toFixed(2)} kg`;
export const FMT_G   = (n) => `${Number(n).toFixed(0)} g`;

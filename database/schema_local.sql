-- ArepasERP Local Schema (Updated)
-- Compatible with PostgreSQL

-- 0. EXTENSIONS & UTILS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. USUARIOS (Local Auth)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT DEFAULT 'user' CHECK (rol IN ('admin', 'user')),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. MEDIOS DE PAGO
CREATE TABLE medios_pago (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('digital', 'efectivo', 'transferencia', 'banco')),
    activo BOOLEAN DEFAULT TRUE
);

-- 3. CLIENTES
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo_cliente TEXT NOT NULL CHECK (tipo_cliente IN ('mayorista', 'minorista', 'local', 'distribuidor')),
    telefono TEXT,
    direccion TEXT,
    ciudad TEXT DEFAULT 'Bogotá',
    canal_venta TEXT CHECK (canal_venta IN ('whatsapp', 'local', 'domicilio')),
    condicion_pago TEXT CHECK (condicion_pago IN ('contado', 'credito')) DEFAULT 'contado',
    cupo_credito DECIMAL(12, 2) DEFAULT 0,
    mostrar_saldo_whatsapp BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PROVEEDORES
CREATE TABLE proveedores (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT,
    contacto TEXT,
    email TEXT,
    direccion TEXT,
    tipo_insumo TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. PRODUCTOS
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    codigo_corto TEXT UNIQUE, 
    tipo_producto TEXT CHECK (tipo_producto IN ('arepa', 'queso', 'otro', 'bebida', 'insumo')),
    precio_estandar DECIMAL(10, 2) NOT NULL DEFAULT 0,
    costo_unitario DECIMAL(10, 2) DEFAULT 0,
    unidad_medida TEXT, 
    activo BOOLEAN DEFAULT TRUE,
    proveedor_id INT REFERENCES proveedores(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. PRECIOS POR CLIENTE
CREATE TABLE precios_cliente (
    id SERIAL PRIMARY KEY,
    cliente_id INT REFERENCES clientes(id) ON DELETE CASCADE,
    producto_id INT REFERENCES productos(id) ON DELETE CASCADE,
    precio_especial DECIMAL(10, 2) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, producto_id)
);

-- 7. PEDIDOS
CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    cliente_id INT REFERENCES clientes(id),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    monto_pagado DECIMAL(12, 2) DEFAULT 0,
    medio_pago_id INT REFERENCES medios_pago(id), -- For legacy/simple payments
    estado TEXT CHECK (estado IN ('pendiente', 'pagado', 'parcial', 'cancelado')) DEFAULT 'pendiente',
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. DETALLE PEDIDO
CREATE TABLE detalle_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INT REFERENCES productos(id),
    cantidad INT NOT NULL,
    precio_aplicado DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. PAGOS RECIBIDOS (Traceability)
CREATE TABLE pagos_recibidos (
    id SERIAL PRIMARY KEY,
    cliente_id INT REFERENCES clientes(id) ON DELETE CASCADE,
    monto DECIMAL(12, 2) NOT NULL CHECK (monto > 0),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    descripcion TEXT,
    metodo_pago_id INT REFERENCES medios_pago(id) ON DELETE SET NULL,
    created_by INT REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. PAGOS_PEDIDOS (Junction: Allocation)
CREATE TABLE pagos_pedidos (
    id SERIAL PRIMARY KEY,
    pago_id INT REFERENCES pagos_recibidos(id) ON DELETE CASCADE,
    pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
    monto DECIMAL(12, 2) NOT NULL CHECK (monto > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. GASTOS
CREATE TABLE gastos (
    id SERIAL PRIMARY KEY,
    concepto TEXT NOT NULL,
    categoria TEXT, -- 'materia_prima', etc. 
    tipo_gasto TEXT CHECK (tipo_gasto IN ('fijo', 'variable')),
    fecha DATE DEFAULT CURRENT_DATE,
    valor DECIMAL(12, 2) NOT NULL,
    proveedor_id INT REFERENCES proveedores(id),
    medio_pago_id INT REFERENCES medios_pago(id),
    pedido_id INT REFERENCES pedidos(id),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. TRANSFERENCIAS
CREATE TABLE transferencias (
    id SERIAL PRIMARY KEY,
    origen_id INT REFERENCES medios_pago(id),
    destino_id INT REFERENCES medios_pago(id),
    valor DECIMAL(12, 2) NOT NULL CHECK (valor > 0),
    fecha DATE DEFAULT CURRENT_DATE,
    descripcion TEXT,
    created_by INT REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VIEWS

-- View: Saldos Medios de Pago
CREATE OR REPLACE VIEW view_saldos_medios_pago AS
WITH ingresos AS (
    -- Sum payments received per method
    SELECT metodo_pago_id AS medio_pago_id, SUM(monto) AS total
    FROM pagos_recibidos
    WHERE metodo_pago_id IS NOT NULL
    GROUP BY metodo_pago_id
),
egresos AS (
    -- Sum expenses per method
    SELECT medio_pago_id, SUM(valor) AS total
    FROM gastos
    WHERE medio_pago_id IS NOT NULL
    GROUP BY medio_pago_id
),
transfers_in AS (
    SELECT destino_id AS medio_pago_id, SUM(valor) AS total
    FROM transferencias
    GROUP BY destino_id
),
transfers_out AS (
    SELECT origen_id AS medio_pago_id, SUM(valor) AS total
    FROM transferencias
    GROUP BY origen_id
)
SELECT 
    mp.id, 
    mp.nombre, 
    mp.tipo,
    (COALESCE(i.total, 0) + COALESCE(ti.total, 0)) AS ingresos,
    (COALESCE(e.total, 0) + COALESCE(to_out.total, 0)) AS egresos,
    (COALESCE(i.total, 0) + COALESCE(ti.total, 0) - COALESCE(e.total, 0) - COALESCE(to_out.total, 0)) AS saldo
FROM medios_pago mp
LEFT JOIN ingresos i ON mp.id = i.medio_pago_id
LEFT JOIN egresos e ON mp.id = e.medio_pago_id
LEFT JOIN transfers_in ti ON mp.id = ti.medio_pago_id
LEFT JOIN transfers_out to_out ON mp.id = to_out.medio_pago_id
WHERE mp.activo = TRUE;

-- View: Historial Abonos (Recent Payments)
CREATE OR REPLACE VIEW view_historial_abonos AS
SELECT 
    pr.id,
    pr.fecha,
    c.nombre AS cliente,
    pr.monto AS valor,
    mp.nombre AS metodo_pago,
    pr.descripcion AS referencia,
    pr.cliente_id
FROM pagos_recibidos pr
LEFT JOIN clientes c ON pr.cliente_id = c.id
LEFT JOIN medios_pago mp ON pr.metodo_pago_id = mp.id
ORDER BY pr.fecha DESC;

-- SEED DATA

INSERT INTO medios_pago (nombre, tipo) VALUES 
('Efectivo', 'efectivo'),
('Nequi', 'digital'),
('Daviplata', 'digital'),
('Bancolombia', 'banco'),
('Caja General', 'efectivo');

-- Admin User (Password: admin123)
-- Uses pgcrypto 'crypt' to hash.
INSERT INTO usuarios (email, password_hash, nombre, rol)
VALUES (
    'admin@arepaserp.com',
    crypt('admin123', gen_salt('bf')),
    'Administrador',
    'admin'
);

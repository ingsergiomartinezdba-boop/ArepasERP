-- Dashboard Metrics Views & Functions

-- 1. Total Sales Today
CREATE OR REPLACE VIEW view_ventas_hoy AS
SELECT COALESCE(SUM(total), 0) as total_ventas
FROM pedidos
WHERE DATE(fecha) = CURRENT_DATE AND estado != 'cancelado';

-- 2. Total Expenses Today
CREATE OR REPLACE VIEW view_gastos_hoy AS
SELECT COALESCE(SUM(valor), 0) as total_gastos
FROM gastos
WHERE fecha = CURRENT_DATE;

-- 3. Detailed Debtors List (Clients with pending balance)
CREATE OR REPLACE VIEW view_clientes_deudores AS
SELECT 
    c.id as cliente_id,
    c.nombre, 
    cc.id as cuenta_cobrar_id,
    cc.saldo, 
    cc.fecha_vencimiento,
    p.fecha as fecha_pedido
FROM cuentas_cobrar cc
JOIN clientes c ON cc.cliente_id = c.id
JOIN pedidos p ON cc.pedido_id = p.id
WHERE cc.estado IN ('pendiente', 'vencido')
ORDER BY cc.fecha_vencimiento ASC;

-- 4. Utility Function to get Daily Summary
-- Note: This might be better handled in application code for formatting, 
-- but a view helps get the raw numbers quickly.
CREATE OR REPLACE VIEW view_resumen_diario_kpis AS
SELECT 
    (SELECT total_ventas FROM view_ventas_hoy) as ventas,
    (SELECT total_gastos FROM view_gastos_hoy) as gastos,
    ((SELECT total_ventas FROM view_ventas_hoy) - (SELECT total_gastos FROM view_gastos_hoy)) as utilidad_estimada;

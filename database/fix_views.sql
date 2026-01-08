-- =============================================
-- SCRIPT DE REPARACIÓN DE VISTAS (MODO SECURITY DEFINER)
-- Ejecute esto en el 'SQL Editor' de Supabase
-- =============================================

-- 1. Eliminar vistas existentes
DROP VIEW IF EXISTS view_resumen_diario_kpis;
DROP VIEW IF EXISTS view_ventas_hoy;
DROP VIEW IF EXISTS view_gastos_hoy;
DROP VIEW IF EXISTS view_clientes_deudores;

-- 2. Recrear Vista de Ventas Hoy (Ejecuta como Dueño/Admin)
CREATE VIEW view_ventas_hoy 
WITH (security_invoker = false) -- Simula SECURITY DEFINER (Access as Owner)
AS
SELECT COALESCE(SUM(total), 0) as total_ventas
FROM pedidos
WHERE fecha::date = CURRENT_DATE;

-- 3. Recrear Vista de Gastos Hoy
CREATE VIEW view_gastos_hoy 
WITH (security_invoker = false) 
AS
SELECT COALESCE(SUM(valor), 0) as total_gastos
FROM gastos
WHERE fecha = CURRENT_DATE;

-- 4. Recrear Vista de Deudores
CREATE VIEW view_clientes_deudores 
WITH (security_invoker = false) 
AS
SELECT 
    cc.id as cuenta_cobrar_id,
    c.nombre,
    cc.saldo,
    cc.fecha_vencimiento
FROM cuentas_cobrar cc
JOIN clientes c ON cc.cliente_id = c.id
WHERE cc.estado = 'pendiente';

-- 5. Recrear Vista Principal de KPIs
CREATE VIEW view_resumen_diario_kpis 
WITH (security_invoker = false) 
AS
SELECT 
    (SELECT total_ventas FROM view_ventas_hoy) as total_ventas,
    (SELECT total_gastos FROM view_gastos_hoy) as total_gastos;

-- 6. Grants
GRANT SELECT ON view_ventas_hoy TO anon, authenticated, service_role;
GRANT SELECT ON view_gastos_hoy TO anon, authenticated, service_role;
GRANT SELECT ON view_clientes_deudores TO anon, authenticated, service_role;
GRANT SELECT ON view_resumen_diario_kpis TO anon, authenticated, service_role;

-- Nota: Con 'security_invoker = false', NO es estrictamente necesario desactivar RLS en las tablas,
-- pero se recomienda dejarlo desactivado si no maneja autenticacion de usuarios compleja.
-- ALTER TABLE clientes DISABLE ROW LEVEL SECURITY; -- Opcional ahora

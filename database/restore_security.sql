-- =============================================
-- ROLLBACK: REACTIVAR SEGURIDAD (RLS)
-- Ejecute esto en el 'SQL Editor' de Supabase
-- =============================================

-- Reactivar RLS en las tablas principales
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_cobrar ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE medios_pago ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE:
-- Al activar RLS, si su Backend usa la clave 'anon' (pública), 
-- dejará de tener acceso a los datos directos (Listas de Clientes, Crear Pedidos)
-- a menos que agregue POLÍTICAS (Policies) o use la clave 'service_role'.

-- Ejemplo de Política Permisiva (Si desea permitir acceso total pero con RLS activo):
-- CREATE POLICY "Acceso Total" ON clientes FOR ALL USING (true) WITH CHECK (true);

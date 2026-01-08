-- =============================================
-- CREACIÓN DE POLÍTICAS DE ACCESO (RLS POLICIES)
-- Ejecute esto en el 'SQL Editor' de Supabase
-- =============================================
-- Esto permite que la aplicación (Backend) pueda leer y escribir datos
-- aunque RLS esté activado.

-- 1. Política para CLIENTES
CREATE POLICY "Acceso Total Clientes" ON clientes 
FOR ALL USING (true) WITH CHECK (true);

-- 2. Política para PRODUCTOS
CREATE POLICY "Acceso Total Productos" ON productos 
FOR ALL USING (true) WITH CHECK (true);

-- 3. Política para GASTOS
CREATE POLICY "Acceso Total Gastos" ON gastos 
FOR ALL USING (true) WITH CHECK (true);

-- 4. Política para PEDIDOS
CREATE POLICY "Acceso Total Pedidos" ON pedidos 
FOR ALL USING (true) WITH CHECK (true);

-- 5. Política para DETALLE PEDIDO
CREATE POLICY "Acceso Total Detalle" ON detalle_pedido 
FOR ALL USING (true) WITH CHECK (true);

-- 6. Otras Tablas
CREATE POLICY "Acceso Total Medios Pago" ON medios_pago FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso Total CC" ON cuentas_cobrar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso Total CP" ON cuentas_pagar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso Total Proveedores" ON proveedores FOR ALL USING (true) WITH CHECK (true);

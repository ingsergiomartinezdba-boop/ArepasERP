-- Fix Providers Table to match Frontend/Backend Models
ALTER TABLE proveedores 
ADD COLUMN IF NOT EXISTS contacto TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

-- Verify columns exist
SELECT * FROM proveedores LIMIT 1;

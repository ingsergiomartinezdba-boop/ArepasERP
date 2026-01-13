-- Add Payment Date and Updated At to Expenses
ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Migrate existing paid expenses
UPDATE gastos 
SET fecha_pago = fecha::timestamp 
WHERE medio_pago_id IS NOT NULL AND fecha_pago IS NULL;

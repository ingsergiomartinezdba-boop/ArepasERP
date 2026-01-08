-- Add 'valor_domicilio' to 'pedidos' table
ALTER TABLE pedidos 
ADD COLUMN valor_domicilio DECIMAL(12, 2) DEFAULT 0;

-- Refresh Policy just in case (optional but good practice)
-- (Existing policies are 'FOR ALL USING (true)' so they should cover this new column automatically)

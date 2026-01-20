-- Add flag to clients table
alter table clientes add column if not exists mostrar_saldo_whatsapp boolean default true;

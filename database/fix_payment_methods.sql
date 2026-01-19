-- Ensure fields exist
alter table medios_pago add column if not exists activo boolean default true;
alter table medios_pago add column if not exists tipo text default 'digital';

-- Enable RLS
alter table medios_pago enable row level security;

-- Policies
create policy "Enable read access for all users" on medios_pago for select using (true);
create policy "Enable insert access for authenticated users" on medios_pago for insert with check (auth.role() = 'authenticated');
create policy "Enable update access for authenticated users" on medios_pago for update using (auth.role() = 'authenticated');
create policy "Enable delete access for authenticated users" on medios_pago for delete using (auth.role() = 'authenticated');

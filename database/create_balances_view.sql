-- View to calculate current balance and flow for each payment method
create or replace view view_saldos_medios_pago as
with ingresos_pedidos as (
    select medio_pago_id, sum(total) as total
    from pedidos
    where estado = 'pagado' and medio_pago_id is not null
    group by medio_pago_id
),
egresos_gastos as (
    select medio_pago_id, sum(valor) as total
    from gastos
    where medio_pago_id is not null
    group by medio_pago_id
),
transfers_in as (
    select destino_id as medio_pago_id, sum(valor) as total
    from transferencias
    group by destino_id
),
transfers_out as (
    select origen_id as medio_pago_id, sum(valor) as total
    from transferencias
    group by origen_id
)
select 
    mp.id, 
    mp.nombre, 
    mp.tipo,
    -- Total Inflow: Sales + Transfers In
    (coalesce(ip.total, 0) + coalesce(ti.total, 0)) as ingresos,
    -- Total Outflow: Expenses + Transfers Out
    (coalesce(eg.total, 0) + coalesce(to_out.total, 0)) as egresos,
    -- Net Balance
    (coalesce(ip.total, 0) + coalesce(ti.total, 0) - coalesce(eg.total, 0) - coalesce(to_out.total, 0)) as saldo
from medios_pago mp
left join ingresos_pedidos ip on mp.id = ip.medio_pago_id
left join egresos_gastos eg on mp.id = eg.medio_pago_id
left join transfers_in ti on mp.id = ti.medio_pago_id
left join transfers_out to_out on mp.id = to_out.medio_pago_id
where mp.activo = true;

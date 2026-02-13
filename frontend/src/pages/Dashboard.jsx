import { useEffect, useState } from 'react';
import { reportsService } from '../services/api';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, CreditCard } from 'lucide-react';

export default function Dashboard() {
    const [expandedClient, setExpandedClient] = useState(null);

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const response = await reportsService.getDashboard();
            console.log("Dashboard Data:", response.data); // Debug log
            setStats(response.data);
        } catch (error) {
            console.error("Error loading dashboard", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center mt-4">Cargando...</div>;
    // Allow rendering if stats is present, even if 0. Check for null explicitly.
    if (!stats) return (
        <div className="text-center mt-4 text-danger">
            <AlertCircle size={48} style={{ margin: '0 auto 1rem' }} />
            <p>Error al cargar datos.</p>
            <small className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>
                {loading ? '' : 'No se pudo conectar con el servidor (API).'}
            </small>
            {/* Debug Info */}
            <div style={{ fontSize: '0.75rem', background: '#333', padding: '0.5rem', borderRadius: '4px', maxWidth: '300px', margin: '0 auto' }}>
                {stats === null && "Status: Null Response"}
            </div>
            <br />
            <button onClick={loadStats} className="btn btn-secondary mt-2" style={{ width: 'auto' }}>Reintentar</button>
        </div>
    );

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);

    const safeDateFormat = (dateStr, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) => {
        if (!dateStr) return 'S/F';

        // Try manual parsing for typical ISO strings first to avoid TZ issues
        if (typeof dateStr === 'string' && dateStr.includes('-')) {
            const parts = dateStr.split('T')[0].split('-');
            if (parts.length === 3) {
                const [year, month, day] = parts;
                if (options.month === 'short') {
                    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                    const yearPart = options.year === 'numeric' ? ` ${year}` : '';
                    return `${day} ${months[parseInt(month) - 1]}${yearPart}`;
                }
                return `${day}/${month}/${year}`;
            }
        }

        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'S/F';
        return d.toLocaleDateString('es-CO', options);
    };

    // MAPPING FIELDS: Check if backend sends 'ventas' or 'ventas_hoy'. Use fallback.
    const ventasMes = stats.ventas_mes || 0;
    const gastosMes = stats.gastos_mes || 0;
    const ventasHoy = stats.ventas_hoy || 0;
    const gastosHoy = stats.gastos_hoy || 0;
    const deudores = stats.clientes_deudores || [];

    // Group Debtors
    const groupedDebtors = deudores.reduce((acc, curr) => {
        const clientId = curr.cliente_id || curr.nombre;
        if (!acc[clientId]) {
            acc[clientId] = {
                id: clientId,
                nombre: curr.nombre,
                total: 0,
                fecha_mas_antigua: curr.fecha || curr.fecha_vencimiento || null,
                items: []
            };
        }
        acc[clientId].total += curr.saldo;

        // Track oldest date
        const currentFecha = curr.fecha || curr.fecha_vencimiento;
        if (currentFecha) {
            const currentD = new Date(currentFecha);
            const oldestD = acc[clientId].fecha_mas_antigua ? new Date(acc[clientId].fecha_mas_antigua) : null;

            if (!isNaN(currentD.getTime())) {
                if (!oldestD || isNaN(oldestD.getTime()) || currentD < oldestD) {
                    acc[clientId].fecha_mas_antigua = currentFecha;
                }
            }
        }

        acc[clientId].items.push(curr);
        return acc;
    }, {});

    const debtorsList = Object.values(groupedDebtors);

    return (
        <div>
            {/* Headers and Widgets code ... keep same structure until Cuentas por Cobrar */}
            <header className="flex justify-between items-center mb-4">
                <h1>Dashboard</h1>
                <span className="text-muted">{new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </header>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1rem' }}>
                {/* Monthly Stats */}
                <div style={{ flex: '1 1 300px' }}>
                    <h2 className="text-lg mb-2">Este Mes</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="card" style={{ marginBottom: 0 }}>
                            <div className="flex items-center gap-2 mb-2 text-muted">
                                <TrendingUp size={16} className="text-success" />
                                <small>Ventas Mes</small>
                            </div>
                            <h3>{formatCurrency(ventasMes)}</h3>
                        </div>

                        <div className="card" style={{ marginBottom: 0 }}>
                            <div className="flex items-center gap-2 mb-2 text-muted">
                                <TrendingDown size={16} className="text-danger" />
                                <small>Gastos Mes</small>
                            </div>
                            <h3>{formatCurrency(gastosMes)}</h3>
                        </div>
                    </div>
                </div>

                {/* Daily Stats */}
                <div style={{ flex: '1 1 300px' }}>
                    <h2 className="text-lg mb-2">Hoy</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="card" style={{ marginBottom: 0 }}>
                            <div className="flex items-center gap-2 mb-2 text-muted">
                                <DollarSign size={16} />
                                <small>Ventas Hoy</small>
                            </div>
                            <h3>{formatCurrency(ventasHoy)}</h3>
                        </div>

                        <div className="card" style={{ marginBottom: 0 }}>
                            <div className="flex items-center gap-2 mb-2 text-muted">
                                <AlertCircle size={16} />
                                <small>Gastos Hoy</small>
                            </div>
                            <h3>{formatCurrency(gastosHoy)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cash Flow Widget */}
            <h2 className="text-lg mt-4 mb-2">Flujo de Caja</h2>
            <div className="stats-grid mb-4">
                {stats.flujo_caja && stats.flujo_caja.length > 0 ? (
                    stats.flujo_caja.map((item, idx) => (
                        <div key={idx} className="card">
                            <div className="flex items-center gap-2 mb-2 text-muted">
                                <CreditCard size={16} />
                                <small>{item.medio}</small>
                            </div>
                            <h3 className={item.saldo >= 0 ? "text-success" : "text-danger"}>
                                {formatCurrency(item.saldo)}
                            </h3>
                            <div className="flex justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--border)', fontSize: '0.75rem' }}>
                                <span className="text-success" title="Ingresos">+{formatCurrency(item.ingresos)}</span>
                                <span className="text-danger" title="Egresos">-{formatCurrency(item.egresos)}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-muted">No hay datos de flujo de caja.</p>
                )}
            </div>

            <h2>Cuentas por Cobrar</h2>
            {debtorsList.length > 0 ? (
                <div className="card" style={{ padding: '0.5rem' }}>
                    {debtorsList.map((client) => (
                        <div key={client.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <div
                                className="flex justify-between items-center"
                                style={{ padding: '1rem', cursor: 'pointer' }}
                                onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
                            >
                                <div>
                                    <strong>{client.nombre}</strong>
                                    <div className="text-muted text-xs">
                                        {client.items.length} facturas pendientes
                                        {client.fecha_mas_antigua && (
                                            <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                                                • Desde: {safeDateFormat(client.fecha_mas_antigua, { day: '2-digit', month: 'short' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-danger font-bold">{formatCurrency(client.total)}</div>
                                    <div className="text-xs text-secondary" style={{ marginTop: '0.25rem' }}>
                                        {expandedClient === client.id ? 'Ocultar detalle' : 'Ver detalle'}
                                    </div>
                                </div>
                            </div>

                            {/* Detailed List */}
                            {expandedClient === client.id && (
                                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0 1rem 1rem 1rem' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <tbody>
                                            {client.items.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '0.5rem 0', color: 'var(--text-muted)' }}>
                                                        <span style={{ opacity: 0.6 }}>{safeDateFormat(item.fecha || item.fecha_vencimiento)}</span>
                                                        {item.fecha_vencimiento && (
                                                            <span style={{ marginLeft: '8px' }}>
                                                                (Vence: {safeDateFormat(item.fecha_vencimiento)})
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                                                        {formatCurrency(item.saldo)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-muted">No hay cuentas pendientes</p>
            )}
        </div>
    );
}

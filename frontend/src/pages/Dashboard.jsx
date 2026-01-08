import { useEffect, useState } from 'react';
import { reportsService } from '../services/api';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';

export default function Dashboard() {
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

    // MAPPING FIELDS: Check if backend sends 'ventas' or 'ventas_hoy'. Use fallback.
    const ventas = stats.ventas ?? stats.ventas_hoy ?? 0;
    const gastos = stats.gastos ?? stats.gastos_hoy ?? 0;
    const utilidad = stats.utilidad_estimada ?? 0;
    const deudores = stats.clientes_deudores || [];

    return (
        <div>
            <header className="flex justify-between items-center mb-4">
                <h1>Resumen Diario</h1>
                <span className="text-muted">{new Date().toLocaleDateString()}</span>
            </header>

            <div className="stats-grid">
                <div className="card">
                    <div className="flex items-center gap-2 mb-2 text-muted">
                        <TrendingUp size={16} />
                        <small>Ventas Hoy</small>
                    </div>
                    <h3>{formatCurrency(ventas)}</h3>
                </div>

                <div className="card">
                    <div className="flex items-center gap-2 mb-2 text-muted">
                        <TrendingDown size={16} />
                        <small>Gastos Hoy</small>
                    </div>
                    <h3>{formatCurrency(gastos)}</h3>
                </div>
            </div>

            <div className="card flex justify-between items-center" style={{ borderColor: utilidad >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                <div>
                    <div className="flex items-center gap-2 mb-1 text-muted">
                        <DollarSign size={16} />
                        <small>Utilidad Estimada</small>
                    </div>
                    <h2 className={utilidad >= 0 ? "text-success" : "text-danger"}>
                        {formatCurrency(utilidad)}
                    </h2>
                </div>
            </div>

            <h2>Cuentas por Cobrar</h2>
            {deudores.length > 0 ? (
                <div className="card" style={{ padding: '0.5rem' }}>
                    {deudores.map((deuda) => (
                        <div key={deuda.cuenta_cobrar_id || Math.random()} style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                            <div className="flex justify-between">
                                <strong>{deuda.nombre}</strong>
                                <span className="text-danger">{formatCurrency(deuda.saldo)}</span>
                            </div>
                            <small className="text-muted">Vence: {deuda.fecha_vencimiento}</small>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-muted">No hay cuentas pendientes</p>
            )}

            <div className="flex gap-2 mt-4">
                <a href="/whatsapp" className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
                    Resumen WhatsApp
                </a>
            </div>
        </div>
    );
}

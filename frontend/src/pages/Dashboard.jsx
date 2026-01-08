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
            setStats(response.data);
        } catch (error) {
            console.error("Error loading dashboard", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center mt-4">Cargando...</div>;
    if (!stats) return <div className="text-center mt-4">Error al cargar datos</div>;

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(val);

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
                        <small>Ventas</small>
                    </div>
                    <h3>{formatCurrency(stats.ventas_hoy)}</h3>
                </div>

                <div className="card">
                    <div className="flex items-center gap-2 mb-2 text-muted">
                        <TrendingDown size={16} />
                        <small>Gastos</small>
                    </div>
                    <h3>{formatCurrency(stats.gastos_hoy)}</h3>
                </div>
            </div>

            <div className="card flex justify-between items-center" style={{ borderColor: stats.utilidad_estimada >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                <div>
                    <div className="flex items-center gap-2 mb-1 text-muted">
                        <DollarSign size={16} />
                        <small>Utilidad Estimada</small>
                    </div>
                    <h2 className={stats.utilidad_estimada >= 0 ? "text-success" : "text-danger"}>
                        {formatCurrency(stats.utilidad_estimada)}
                    </h2>
                </div>
            </div>

            <h2>Cuentas por Cobrar</h2>
            {stats.clientes_deudores && stats.clientes_deudores.length > 0 ? (
                <div className="card" style={{ padding: '0.5rem' }}>
                    {stats.clientes_deudores.map((deuda) => (
                        <div key={deuda.cuenta_cobrar_id} style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
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

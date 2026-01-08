import { useState, useEffect } from 'react';
import { ordersService, reportsService } from '../services/api';
import { RefreshCw, Copy, List, Calendar, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OrdersList() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, [date]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Get Orders (Ideally filtering by date in backend, but for now we fetch all and filter client side or update backend)
            // Note: My backend ordersService.getAll() returns latest 50. 
            // For a proper reporting tool, we should add date filter to getAll.
            // I'll stick to the "Whatsapp Summary" endpoint as the source of truth for "Today's Deliveries" 
            // but also fetch orders to show details if needed. 
            // Actually, let's rely on getWhatsappSummary to get the text, and getOrders for the list UI.

            const ordersRes = await ordersService.getAll();
            // Client-side filter for now since getAll is limited to 50 latest
            const todaysOrders = ordersRes.data.filter(o => o.fecha.startsWith(date));
            setOrders(todaysOrders);

            // 2. Get Summary Text for this date
            const reportRes = await reportsService.getWhatsappSummary(date); // Need to update frontend api.js to pass date
            setSummary(reportRes.data.text);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(summary);
        alert("Reporte copiado!");
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h1>Pedidos del Día</h1>
                <div className="flex gap-2">
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        style={{ width: 'auto', padding: '0.4rem' }}
                    />
                    <button onClick={loadData} className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem' }}>
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                {/* Left Column: List of Orders */}
                <div>
                    <h3 className="mb-2 flex items-center gap-2">
                        <List size={18} /> Detalle
                    </h3>
                    {loading ? <p>Cargando...</p> : (
                        <div className="flex" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                            {orders.length === 0 ? <p className="text-muted">No hay pedidos para esta fecha.</p> :
                                orders.map(order => (
                                    <div key={order.id} className="card" style={{ padding: '0.75rem', marginBottom: 0 }}>
                                        <div className="flex justify-between items-start">
                                            <strong style={{ fontSize: '1.1rem' }}>{order.cliente_nombre}</strong>
                                            <span className="text-success font-bold">{formatCurrency(order.total)}</span>
                                        </div>
                                        <div className="mt-2 text-muted" style={{ fontSize: '0.85rem' }}>
                                            {order.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between">
                                                    <span>{item.cantidad} x {item.producto_nombre}</span>
                                                    <span>{formatCurrency(item.subtotal)}</span>
                                                </div>
                                            ))}
                                            {order.valor_domicilio > 0 && (
                                                <div className="flex justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '4px', paddingTop: '4px' }}>
                                                    <span>Domicilio</span>
                                                    <span>{formatCurrency(order.valor_domicilio)}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 flex justify-between items-center">
                                            <div className="flex gap-2">
                                                <span className={`badge ${order.estado === 'pendiente' ? 'text-danger' : 'text-success'}`} style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                                    {order.estado}
                                                </span>
                                                <button
                                                    onClick={() => navigate(`/orders/${order.id}/edit`)}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}
                                                >
                                                    <Edit size={12} style={{ marginRight: '4px' }} /> Editar
                                                </button>
                                            </div>
                                            <small className="text-muted">{new Date(order.fecha).toLocaleTimeString().slice(0, 5)}</small>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {/* Right Column: WhatsApp Preview */}
                <div>
                    <h3 className="mb-2 flex items-center gap-2">
                        <Copy size={18} /> Reporte WhatsApp
                        {summary && (
                            <button onClick={copyToClipboard} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', width: 'auto', marginLeft: 'auto' }}>
                                Copiar
                            </button>
                        )}
                    </h3>
                    <div className="card" style={{ backgroundColor: '#0b141a', border: '1px solid #1f2c34' }}>
                        <pre style={{
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            fontSize: '0.9rem',
                            color: '#e9edef',
                            minHeight: '200px'
                        }}>
                            {summary || "No hay datos para generar reporte."}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}

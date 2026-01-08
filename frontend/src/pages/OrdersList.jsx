import { useState, useEffect } from 'react';
import { ordersService, reportsService } from '../services/api';
import { RefreshCw, Copy, List, Calendar, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OrdersList() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusModal, setStatusModal] = useState({ open: false, orderId: null, currentStatus: '' });
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedMethod, setSelectedMethod] = useState('');
    const [summary, setSummary] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
        loadPaymentMethods();
    }, [date]);

    const loadData = async () => {
        setLoading(true);
        try {
            const ordersRes = await ordersService.getAll();
            const todaysOrders = ordersRes.data.filter(o => o.fecha.startsWith(date));
            setOrders(todaysOrders);

            const reportRes = await reportsService.getWhatsappSummary(date);
            setSummary(reportRes.data.text);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadPaymentMethods = async () => {
        try {
            // Dynamically fetch active payment methods
            const res = await import('../services/api').then(m => m.paymentMethodsService.getAll());
            // Filter only active ones if needed, though backend returns all usually. 
            // Better to filter active only in frontend or backend query.
            const activeMethods = res.data.filter(m => m.activo);
            setPaymentMethods(activeMethods);
        } catch (err) {
            console.error("Error loading payment methods", err);
            // Fallback just in case
            setPaymentMethods([
                { id: 1, nombre: 'Efectivo' },
                { id: 2, nombre: 'Nequi' },
            ]);
        }
    };

    const handleStatusClick = (order) => {
        setStatusModal({ open: true, orderId: order.id, currentStatus: order.estado });
        setSelectedMethod('');
    };

    const confirmStatusChange = async (newStatus) => {
        if (newStatus === 'pagado' && !selectedMethod) {
            alert("Por favor selecciona un medio de pago.");
            return;
        }

        try {
            await ordersService.updateStatus(statusModal.orderId, {
                estado: newStatus,
                medio_pago_id: newStatus === 'pagado' ? parseInt(selectedMethod) : null
            });
            setStatusModal({ open: false, orderId: null, currentStatus: '' });
            loadData(); // Refresh list
        } catch (err) {
            console.error(err);
            alert("Error al actualizar estado");
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(summary);
        alert("Reporte copiado!");
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

    return (
        <div>
            <div className="page-header flex justify-between items-center mb-4">
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
                                                <button
                                                    onClick={() => handleStatusClick(order)}
                                                    className={`badge ${order.estado === 'pendiente' ? 'text-danger' : 'text-success'}`}
                                                    style={{ fontSize: '0.75rem', textTransform: 'uppercase', background: 'transparent', border: '1px solid currentColor', cursor: 'pointer' }}
                                                >
                                                    {order.estado}
                                                </button>
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
                    {/* Existing WhatsApp Code */}
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

            {/* Status Modal */}
            {statusModal.open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '300px', margin: 0 }}>
                        <h3>Actualizar Estado</h3>
                        <div className="flex flex-col gap-2 mt-4">
                            <button
                                onClick={() => confirmStatusChange('pendiente')}
                                className="btn btn-secondary"
                                disabled={statusModal.currentStatus === 'pendiente'}
                            >
                                Pendiente
                            </button>

                            <hr style={{ borderColor: 'var(--border)', margin: '0.5rem 0' }} />

                            <label className="text-sm text-muted">Marcar como Pagado:</label>
                            <select
                                className="form-control mb-2"
                                value={selectedMethod}
                                onChange={e => setSelectedMethod(e.target.value)}
                            >
                                <option value="">-- Seleccionar Medio --</option>
                                {paymentMethods.map(m => (
                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => confirmStatusChange('pagado')}
                                className="btn btn-primary"
                            >
                                PAGADO
                            </button>

                            <button
                                onClick={() => setStatusModal({ ...statusModal, open: false })}
                                className="btn btn-secondary mt-2"
                            >
                                Cerrar
                            </button>

                            <hr style={{ borderColor: 'var(--border)', margin: '0.5rem 0' }} />

                            <button
                                onClick={() => {
                                    if (window.confirm('¿Seguro que deseas cancelar este pedido? Se eliminará de las cuentas por cobrar.')) {
                                        confirmStatusChange('cancelado');
                                    }
                                }}
                                className="btn btn-danger"
                                style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }}
                            >
                                ANULAR PEDIDO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

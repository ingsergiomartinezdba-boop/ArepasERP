import { useState, useEffect } from 'react';
import { ordersService, reportsService } from '../services/api';
import { RefreshCw, Copy, List, Calendar, Edit, X } from 'lucide-react';
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

    const [isPagadoExpanded, setIsPagadoExpanded] = useState(false);

    const handleStatusClick = (order) => {
        setStatusModal({ open: true, orderId: order.id, currentStatus: order.estado });
        setSelectedMethod('');
        setIsPagadoExpanded(false);
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
            setIsPagadoExpanded(false);
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
                                                    className={`badge ${order.estado === 'pagado' ? 'text-success' : 'text-danger'}`}
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
                                            {/* Time removed as it is not captured in OrderForm */}
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
                    <div className="card" style={{ width: '95%', maxWidth: '400px', margin: 0, position: 'relative' }}>
                        <button
                            onClick={() => setStatusModal({ ...statusModal, open: false })}
                            className="btn-close-modal active:scale-95"
                            title="Cerrar"
                        >
                            <X size={20} />
                        </button>
                        <h3>Actualizar Estado</h3>

                        <div className="flex flex-col gap-4 mt-6">
                            <div className="grid grid-cols-3 gap-2 w-full items-stretch" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', width: '100%' }}>
                                {/* Botón Pendiente */}
                                <button
                                    onClick={() => confirmStatusChange('pendiente')}
                                    className="btn btn-secondary"
                                    style={{ height: '50px', fontSize: '0.75rem', padding: '0', width: '100%', minWidth: '0' }}
                                    disabled={statusModal.currentStatus === 'pendiente'}
                                >
                                    PENDIENTE
                                </button>

                                {/* Botón Pagado */}
                                <div className="w-full">
                                    <button
                                        onClick={() => setIsPagadoExpanded(!isPagadoExpanded)}
                                        className="btn"
                                        style={{
                                            background: isPagadoExpanded ? 'rgba(245, 158, 11, 0.1)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                                            color: isPagadoExpanded ? 'var(--primary)' : 'white',
                                            border: isPagadoExpanded ? '1px solid var(--primary)' : 'none',
                                            height: '50px',
                                            padding: '0',
                                            fontSize: '0.75rem',
                                            width: '100%',
                                            minWidth: '0'
                                        }}
                                    >
                                        {isPagadoExpanded ? 'PAGANDO...' : 'PAGADO'}
                                    </button>
                                </div>

                                {/* Botón Anular */}
                                <button
                                    onClick={() => {
                                        if (window.confirm('¿Seguro que deseas cancelar este pedido?')) {
                                            confirmStatusChange('cancelado');
                                        }
                                    }}
                                    className="btn btn-danger"
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--danger)',
                                        color: 'var(--danger)',
                                        height: '50px',
                                        padding: '0',
                                        fontSize: '0.75rem',
                                        width: '100%',
                                        minWidth: '0'
                                    }}
                                >
                                    ANULAR
                                </button>
                            </div>

                            {/* Dropdown de Medio de Pago y Confirmación Real */}
                            {isPagadoExpanded && (
                                <div className="animate-fade-in bg-white/5 p-4 rounded-xl border border-white/10 w-full mt-2">
                                    <label className="text-[0.7rem] font-bold text-orange-500 uppercase tracking-widest mb-3 block text-center">Seleccionar Medio de Pago *</label>
                                    <select
                                        className="form-control mb-4"
                                        value={selectedMethod}
                                        onChange={e => setSelectedMethod(e.target.value)}
                                        style={{ height: '45px', fontSize: '1rem', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}
                                        autoFocus
                                    >
                                        <option value="">-- Escoger Medio --</option>
                                        {paymentMethods.map(m => (
                                            <option key={m.id} value={m.id}>{m.nombre}</option>
                                        ))}
                                    </select>

                                    <button
                                        onClick={() => confirmStatusChange('pagado')}
                                        className="btn w-full"
                                        style={{
                                            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                            color: 'white',
                                            height: '50px',
                                            fontSize: '0.9rem',
                                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                        }}
                                    >
                                        CONFIRMAR PAGO
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

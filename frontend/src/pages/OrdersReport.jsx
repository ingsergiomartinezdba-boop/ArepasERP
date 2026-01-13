import { useState, useEffect } from 'react';
import { ordersService, paymentMethodsService, clientsService } from '../services/api';
import { Calendar, Search, Filter, Eye, FileText } from 'lucide-react';

export default function OrdersReport() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    // Default to current month
    const now = new Date();
    const [month, setMonth] = useState(now.toISOString().slice(0, 7)); // YYYY-MM
    const [paymentMethods, setPaymentMethods] = useState({});
    const [selectedOrder, setSelectedOrder] = useState(null);

    // PDF Generation State
    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [generatingPdf, setGeneratingPdf] = useState(false);

    useEffect(() => {
        loadPaymentMethods();
        loadClients();
    }, []);

    useEffect(() => {
        loadOrders();
    }, [month]);

    const loadClients = async () => {
        try {
            const res = await clientsService.getAll();
            setClients(res.data);
        } catch (e) { console.error(e); }
    };

    const loadPaymentMethods = async () => {
        try {
            const res = await paymentMethodsService.getAll();
            const map = {};
            res.data.forEach(m => map[m.id] = m.nombre);
            setPaymentMethods(map);
        } catch (e) {
            console.error("Error loading payment methods", e);
        }
    };

    const loadOrders = async () => {
        setLoading(true);
        try {
            // Calculate start and end date of selected month
            const year = parseInt(month.split('-')[0]);
            const m = parseInt(month.split('-')[1]);

            const startStr = `${month}-01`;
            // Get last day of month
            const lastDay = new Date(year, m, 0).getDate();
            const endStr = `${month}-${lastDay}`;

            const res = await ordersService.getAll({
                start_date: startStr,
                end_date: endStr
            });
            setOrders(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePDF = async () => {
        if (!selectedClientId) {
            alert("Seleccione un cliente");
            return;
        }

        setGeneratingPdf(true);
        try {
            // Fetch PENDING orders for this client. 
            // Note: We might want ANY unpaid order, so 'pendiente'. 
            // User asked for "cuentas por pagar".
            const res = await ordersService.getAll({
                client_id: selectedClientId,
                status: 'pendiente'
            });

            const pendingOrders = res.data;
            const clientName = clients.find(c => c.id === parseInt(selectedClientId))?.nombre || "Cliente";
            const dateGen = new Date().toLocaleDateString();
            const totalDebt = pendingOrders.reduce((acc, o) => acc + o.total, 0);

            // Open Print Window
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (!printWindow) {
                alert("Permita ventanas emergentes para generar el reporte.");
                setGeneratingPdf(false);
                return;
            }

            const htmlContent = `
                <html>
                <head>
                    <title>Estado de Cuenta - ${clientName}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { text-align: center; color: #333; margin-bottom: 5px; }
                        .header { margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .text-right { text-align: right; }
                        .total-row { font-weight: bold; background-color: #eee; }
                        .footer { margin-top: 30px; text-align: center; font-size: 0.8rem; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Estado de Cuenta</h1>
                        <p><strong>Cliente:</strong> ${clientName}</p>
                        <p><strong>Fecha Generación:</strong> ${dateGen}</p>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha Pedido</th>
                                <th>ID Pedido</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendingOrders.map(o => `
                                <tr>
                                    <td>${new Date(o.fecha).toLocaleDateString()}</td>
                                    <td>#${o.id}</td>
                                    <td class="text-right">$${new Intl.NumberFormat('es-CO').format(o.total)}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="2" class="text-right">TOTAL A PAGAR</td>
                                <td class="text-right">$${new Intl.NumberFormat('es-CO').format(totalDebt)}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="footer">
                        <p>Arepas Betania ERP</p>
                    </div>
                    
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `;

            printWindow.document.write(htmlContent);
            printWindow.document.close();

        } catch (e) {
            console.error(e);
            alert("Error generando reporte");
        } finally {
            setGeneratingPdf(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
    const formatDate = (dateStr) => new Date(dateStr).toLocaleString();

    // Calculations
    const totalSales = orders.filter(o => o.estado !== 'cancelado').reduce((acc, curr) => acc + curr.total, 0);

    return (
        <div>
            <div className="page-header flex justify-between items-center mb-4">
                <h1>Reporte Mensual Pedidos</h1>
                <div className="flex gap-2 items-center">
                    <input
                        type="month"
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className="form-control"
                        style={{ width: 'auto' }}
                    />
                </div>
            </div>

            {/* Generate Account Statement Section */}
            <div className="card mb-4 border-l-4" style={{ borderLeft: '4px solid var(--primary)' }}>
                <h3 className="mb-3 flex items-center gap-2"><FileText size={20} /> Generar Estado de Cuenta (PDF)</h3>
                <div className="flex gap-4 items-end">
                    <div className="form-group mb-0" style={{ flex: 1, maxWidth: '300px' }}>
                        <label>Seleccionar Cliente</label>
                        <select
                            className="form-control"
                            value={selectedClientId}
                            onChange={e => setSelectedClientId(e.target.value)}
                        >
                            <option value="">-- Cliente --</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleGeneratePDF}
                        disabled={generatingPdf || !selectedClientId}
                        className="btn btn-primary"
                        style={{ width: 'auto' }}
                    >
                        {generatingPdf ? 'Generando...' : 'Generar PDF'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="card">
                    <h3 className="text-muted text-sm">Total Ventas (Mes)</h3>
                    <div className="text-2xl font-bold text-success">{formatCurrency(totalSales)}</div>
                </div>
                <div className="card">
                    <h3 className="text-muted text-sm">Pedidos Totales</h3>
                    <div className="text-2xl font-bold">{orders.length}</div>
                </div>
            </div>

            <div className="card overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th className="p-3">ID</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Cliente</th>
                            <th className="p-3">Estado</th>
                            <th className="p-3">Medio Pago</th>
                            <th className="p-3 text-right">Domicilio</th>
                            <th className="p-3 text-right">Total</th>
                            <th className="p-3 text-center">Detalle</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="p-4 text-center">Cargando...</td></tr>
                        ) : orders.length === 0 ? (
                            <tr><td colSpan="8" className="p-4 text-center text-muted">No se encontraron pedidos en este mes.</td></tr>
                        ) : (
                            orders.map(order => (
                                <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td className="p-3">#{order.id}</td>
                                    <td className="p-3 text-sm">{formatDate(order.fecha)}</td>
                                    <td className="p-3 font-bold">{order.cliente_nombre}</td>
                                    <td className="p-3">
                                        <span className={`badge ${order.estado === 'pagado' ? 'text-success' :
                                            order.estado === 'cancelado' ? 'text-danger' : 'text-warning'
                                            }`} style={{ background: 'rgba(255,255,255,0.05)' }}>
                                            {order.estado}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm">
                                        {order.medio_pago_id ? paymentMethods[order.medio_pago_id] || 'Desconocido' : '-'}
                                    </td>
                                    <td className="p-3 text-right text-muted">{formatCurrency(order.valor_domicilio)}</td>
                                    <td className="p-3 text-right font-bold text-success">{formatCurrency(order.total)}</td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => setSelectedOrder(order)}
                                            className="btn btn-secondary"
                                            style={{ padding: '0.4rem' }}
                                            title="Ver Detalle"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            {selectedOrder && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '500px', margin: 0, maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h3>Detalle Pedido #{selectedOrder.id}</h3>
                            <button className="text-muted" onClick={() => setSelectedOrder(null)}>✕</button>
                        </div>

                        <div className="mb-4">
                            <p><strong>Cliente:</strong> {selectedOrder.cliente_nombre}</p>
                            <p><strong>Fecha:</strong> {formatDate(selectedOrder.fecha)}</p>
                        </div>

                        <table style={{ width: '100%', marginBottom: '1rem', fontSize: '0.9rem' }}>
                            <thead>
                                <tr className="text-muted" style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                    <th className="pb-2">Producto</th>
                                    <th className="pb-2 text-right">Cant</th>
                                    <th className="pb-2 text-right">Precio</th>
                                    <th className="pb-2 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedOrder.items.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td className="py-2">{item.producto_nombre}</td>
                                        <td className="py-2 text-right">{item.cantidad}</td>
                                        <td className="py-2 text-right">{formatCurrency(item.precio_aplicado)}</td>
                                        <td className="py-2 text-right">{formatCurrency(item.subtotal)}</td>
                                    </tr>
                                ))}
                                {selectedOrder.valor_domicilio > 0 && (
                                    <tr>
                                        <td className="py-2">Domicilio</td>
                                        <td colSpan="2"></td>
                                        <td className="py-2 text-right">{formatCurrency(selectedOrder.valor_domicilio)}</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot style={{ borderTop: '2px solid var(--border)' }}>
                                <tr>
                                    <td colSpan="3" className="py-2 font-bold text-right">TOTAL</td>
                                    <td className="py-2 font-bold text-right text-success">{formatCurrency(selectedOrder.total)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <button
                            className="btn btn-primary"
                            onClick={() => setSelectedOrder(null)}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersService, paymentMethodsService, clientsService } from '../services/api';
import { Calendar, Search, Filter, Eye, FileText, TrendingUp, ShoppingBag, Edit, Trash2 } from 'lucide-react';
import { Modal } from '../components';

export default function OrdersReport() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleDeleteOrder = async (id) => {
        if (!confirm('¿Seguro que desea eliminar este pedido?')) return;
        try {
            await ordersService.delete(id);
            loadOrders();
        } catch (error) {
            console.error(error);
            alert("Error al eliminar pedido");
        }
    };

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
            // Sort by ID ASC (Oldest first)
            const sortedOrders = res.data.sort((a, b) => a.id - b.id);
            setOrders(sortedOrders);
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
                cliente_id: selectedClientId
            });

            // Filter for everything that is NOT paid and NOT cancelled
            const pendingOrders = res.data.filter(o =>
                o.estado !== 'pagado' &&
                o.estado !== 'cancelado' &&
                (o.total - (o.monto_pagado || 0)) > 0
            );

            if (pendingOrders.length === 0) {
                alert("El cliente seleccionado no tiene cuentas por pagar pendientes.");
                setGeneratingPdf(false);
                return;
            }

            pendingOrders.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            const clientName = clients.find(c => c.id === parseInt(selectedClientId))?.nombre || "Cliente";
            const dateGen = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

            // Calculate total debt based on remaining balances
            const totalDebt = pendingOrders.reduce((acc, o) => acc + (o.total - (o.monto_pagado || 0)), 0);

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
                        body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
                        h1 { text-align: center; color: #000; margin-bottom: 5px; text-transform: uppercase; }
                        .header { margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ccc; padding: 10px; text-align: left; font-size: 12px; }
                        th { background-color: #f8f8f8; font-weight: bold; text-transform: uppercase; }
                        .text-right { text-align: right; }
                        .total-row { font-weight: bold; background-color: #eee; font-size: 14px; }
                        .footer { margin-top: 40px; text-align: center; font-size: 0.9rem; color: #666; font-style: italic; }
                        ul { margin: 0; padding-left: 15px; list-style-type: square; }
                        .saldo-cell { font-weight: bold; color: #d32f2f; }
                    </style>
                </head>
                <body>
                    <div class="header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h1>Estado de Cuenta</h1>
                            <p><strong>CLIENTE:</strong> ${clientName}</p>
                            <p><strong>FECHA GENERACIÓN:</strong> ${dateGen}</p>
                        </div>
                        <img src="${window.location.origin}/logo-betania.jpeg" style="width: 100px; height: auto;" />
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Detalle Pedido</th>
                                <th class="text-right">Total</th>
                                <th class="text-right">Abonos</th>
                                <th class="text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendingOrders.map(o => {
                const saldo = o.total - (o.monto_pagado || 0);
                return `
                                <tr>
                                    <td style="white-space: nowrap;">${new Date(o.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                    <td>
                                        <ul style="margin: 0; padding-left: 15px;">
                                            ${o.items.map(i => `
                                                <li>${i.producto_nombre} x${i.cantidad}</li>
                                            `).join('')}
                                        </ul>
                                    </td>
                                    <td class="text-right">$${new Intl.NumberFormat('es-CO').format(o.total)}</td>
                                    <td class="text-right">$${new Intl.NumberFormat('es-CO').format(o.monto_pagado || 0)}</td>
                                    <td class="text-right saldo-cell">$${new Intl.NumberFormat('es-CO').format(saldo)}</td>
                                </tr>
                                `;
            }).join('')}
                            <tr class="total-row">
                                <td colspan="4" class="text-right">TOTAL PENDIENTE</td>
                                <td class="text-right saldo-cell">$${new Intl.NumberFormat('es-CO').format(totalDebt)}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="footer">
                        <p>Reporte generado por Arepas Betania ERP</p>
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
    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Calculations
    const totalSales = orders.filter(o => o.estado !== 'cancelado').reduce((acc, curr) => acc + curr.total, 0);

    return (
        <div>
            <div className="page-header flex justify-between items-center mb-4">
                <h1>Reporte Mensual Pedidos</h1>
                <div className="flex gap-2 items-center">
                    <div className="flex gap-1 bg-card rounded border p-1 border-input">
                        {/* Month Select */}
                        <select
                            className="bg-transparent text-sm outline-none px-2 py-1"
                            value={month.split('-')[1]}
                            onChange={e => setMonth(`${month.split('-')[0]}-${e.target.value}`)}
                        >
                            <option value="01">Enero</option>
                            <option value="02">Febrero</option>
                            <option value="03">Marzo</option>
                            <option value="04">Abril</option>
                            <option value="05">Mayo</option>
                            <option value="06">Junio</option>
                            <option value="07">Julio</option>
                            <option value="08">Agosto</option>
                            <option value="09">Septiembre</option>
                            <option value="10">Octubre</option>
                            <option value="11">Noviembre</option>
                            <option value="12">Diciembre</option>
                        </select>
                        {/* Year Select - Range: 2024-2030 */}
                        <select
                            className="bg-transparent text-sm outline-none px-2 py-1 border-l border-input"
                            value={month.split('-')[0]}
                            onChange={e => setMonth(`${e.target.value}-${month.split('-')[1]}`)}
                        >
                            {[2024, 2025, 2026, 2027, 2028].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="orders-report-grid mb-4">
                {/* Widget 1: Total Sales */}
                <div className="card p-3 min-[550px]:p-2 mb-0 h-full flex flex-col justify-between" style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div className="flex items-center gap-1 text-muted text-sm min-[550px]:text-[0.7rem] mb-1">
                        <TrendingUp className="w-4 h-4 min-[550px]:w-3 min-[550px]:h-3 text-success" /> Ventas Mes
                    </div>
                    <div className="text-2xl min-[550px]:text-lg font-bold truncate" title={formatCurrency(totalSales)}>{formatCurrency(totalSales)}</div>
                </div>

                {/* Widget 2: Total Orders */}
                <div className="card p-3 min-[550px]:p-2 mb-0 h-full flex flex-col justify-between" style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div className="flex items-center gap-1 text-muted text-sm min-[550px]:text-[0.7rem] mb-1">
                        <ShoppingBag className="w-4 h-4 min-[550px]:w-3 min-[550px]:h-3 text-primary" /> Pedidos Totales
                    </div>
                    <div className="text-2xl min-[550px]:text-lg font-bold truncate">{orders.length}</div>
                </div>

                {/* Widget 3: PDF Generator */}
                <div className="card p-3 min-[550px]:p-2 mb-0 h-full flex flex-col justify-between" style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div className="flex items-center gap-1 text-muted text-sm min-[550px]:text-[0.7rem] mb-1">
                        <FileText className="w-4 h-4 min-[550px]:w-3 min-[550px]:h-3" /> Generar Estado de Cuenta
                    </div>
                    <div className="flex gap-2 min-[550px]:gap-1 w-full items-center">
                        <select
                            className="form-control h-9 min-[550px]:h-6 text-sm min-[550px]:text-[0.7rem] px-2 min-[550px]:px-1"
                            value={selectedClientId}
                            onChange={e => setSelectedClientId(e.target.value)}
                            style={{ flex: 1, minWidth: 0 }}
                        >
                            <option value="">Cliente...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleGeneratePDF}
                            disabled={generatingPdf || !selectedClientId}
                            className="btn btn-primary text-sm px-3"
                            style={{ width: 'auto', minWidth: 'max-content', height: 'auto', padding: '0.4rem 0.8rem' }}
                            title="Generar PDF"
                        >
                            {generatingPdf ? '...' : 'PDF'}
                        </button>
                    </div>
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
                                        <span
                                            className={`badge ${order.estado === 'pagado' ? 'text-success' : 'text-danger'}`}
                                            style={{
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                background: 'transparent',
                                                border: '1px solid currentColor',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '999px',
                                                fontWeight: 'bold',
                                                letterSpacing: '0.5px'
                                            }}
                                        >
                                            {order.estado}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm">
                                        {order.medio_pago_id ? paymentMethods[order.medio_pago_id] || 'Desconocido' : '-'}
                                    </td>
                                    <td className="p-3 text-right text-muted">{formatCurrency(order.valor_domicilio)}</td>
                                    <td className="p-3 text-right font-bold text-success">{formatCurrency(order.total)}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => setSelectedOrder(order)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem' }}
                                                title="Ver Detalle"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => navigate(`/orders/${order.id}/edit`)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem' }}
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteOrder(order.id)}
                                                className="btn btn-secondary text-danger"
                                                style={{ padding: '0.4rem' }}
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={selectedOrder ? `Detalle Pedido #${selectedOrder.id}` : ''}
                size="lg"
            >
                {selectedOrder && (
                    <>
                        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-muted text-xs uppercase font-bold">Cliente</span>
                                <span className="font-bold">{selectedOrder.cliente_nombre}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted text-xs uppercase font-bold">Fecha</span>
                                <span className="font-bold">{formatDate(selectedOrder.fecha)}</span>
                            </div>
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
                                    <td colSpan="3" className="py-2 font-bold text-right pt-4">TOTAL</td>
                                    <td className="py-2 font-bold text-right text-success text-2xl pt-4">{formatCurrency(selectedOrder.total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </>
                )}
            </Modal>
        </div>
    );
}

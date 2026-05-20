import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersService, paymentMethodsService, clientsService } from '../services/api';
import { Calendar, Search, Filter, Eye, FileText, TrendingUp, ShoppingBag, Edit, Trash2, X, BarChart2, AlertCircle, DollarSign } from 'lucide-react';
import { Modal } from '../components';
import { formatDate } from '../utils/formatters';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
            toast.error("Error al eliminar pedido");
        }
    };

    // Default to current month
    const now = new Date();
    const [month, setMonth] = useState(now.toISOString().slice(0, 7)); // YYYY-MM
    const [paymentMethods, setPaymentMethods] = useState({});
    const [paymentMethodsList, setPaymentMethodsList] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Status modal state
    const [statusModal, setStatusModal] = useState({ open: false, orderId: null, currentStatus: '' });
    const [selectedMethod, setSelectedMethod] = useState('');
    const [isPagadoExpanded, setIsPagadoExpanded] = useState(false);

    // PDF Generation State
    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [generatingPdf, setGeneratingPdf] = useState(false);

    // Filtros de la grilla
    const [search, setSearch]              = useState('');         // búsqueda libre (id, cliente)
    const [filterEstado, setFilterEstado]  = useState('todos');    // pendiente|por_cobrar|pagado|cancelado|todos
    const [filterCliente, setFilterCliente]= useState('');         // cliente_id
    const [filterMedio, setFilterMedio]    = useState('');         // medio_pago_id

    useEffect(() => {
        loadPaymentMethods();
        loadClients();
    }, []);

    useEffect(() => {
        loadOrders();
    }, [month, filterCliente, filterEstado]);

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
            setPaymentMethodsList(res.data.filter(m => m.activo !== false));
        } catch (e) {
            console.error("Error loading payment methods", e);
        }
    };

    const handleStatusClick = (order) => {
        setStatusModal({ open: true, orderId: order.id, currentStatus: order.estado });
        setSelectedMethod('');
        setIsPagadoExpanded(false);
    };

    const confirmStatusChange = async (newStatus) => {
        if (newStatus === 'pagado' && !selectedMethod) {
            toast.warning("Selecciona un medio de pago");
            return;
        }
        try {
            await ordersService.updateStatus(statusModal.orderId, {
                estado: newStatus,
                medio_pago_id: newStatus === 'pagado' ? parseInt(selectedMethod) : null
            });
            setStatusModal({ open: false, orderId: null, currentStatus: '' });
            setIsPagadoExpanded(false);
            loadOrders();
        } catch (err) {
            console.error(err);
            toast.error("Error al actualizar estado");
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

            const baseParams = {
                start_date: startStr,
                end_date: endStr,
                limit: 100,
            };
            if (filterCliente) baseParams.cliente_id = filterCliente;
            if (filterEstado !== 'todos') baseParams.estado = filterEstado;

            // Auto-paginación: carga páginas de 100 hasta agotar
            let all = [];
            let skip = 0;
            while (true) {
                const res = await ordersService.getAll({ ...baseParams, skip });
                all = all.concat(res.data);
                if (res.data.length < 100) break;
                skip += 100;
            }

            // Deduplicar por id (defensa contra cualquier overlap del backend
            // entre páginas — siempre nos quedamos con la versión más reciente).
            const dedup = Array.from(
                new Map(all.map(o => [o.id, o])).values()
            );

            // Ordenar por fecha DESC (más reciente primero), desempate por id DESC
            dedup.sort((a, b) => {
                const fa = new Date(a.fecha).getTime();
                const fb = new Date(b.fecha).getTime();
                if (fb !== fa) return fb - fa;
                return b.id - a.id;
            });
            setOrders(dedup);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePDF = async () => {
        if (!selectedClientId) {
            toast.warning("Selecciona un cliente");
            return;
        }

        setGeneratingPdf(true);
        try {
            // Fetch ALL orders for this client (auto-paginado), luego filtra pendientes
            let all = [];
            let skip = 0;
            while (true) {
                const res = await ordersService.getAll({
                    cliente_id: selectedClientId,
                    limit: 100,
                    skip,
                });
                all = all.concat(res.data);
                if (res.data.length < 100) break;
                skip += 100;
            }

            const pendingOrders = all.filter(o =>
                o.estado !== 'pagado' &&
                o.estado !== 'cancelado' &&
                (o.total - (o.monto_pagado || 0)) > 0
            );

            if (pendingOrders.length === 0) {
                toast.info("El cliente no tiene cuentas pendientes");
                setGeneratingPdf(false);
                return;
            }

            pendingOrders.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            const clientName = clients.find(c => c.id === parseInt(selectedClientId))?.nombre || "Cliente";
            const dateGen = formatDate(new Date());

            // Calculate total debt based on remaining balances
            const totalDebt = pendingOrders.reduce((acc, o) => acc + (o.total - (o.monto_pagado || 0)), 0);

            // Open Print Window
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (!printWindow) {
                toast.warning("Permite ventanas emergentes en tu navegador para generar el reporte");
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
                                    <td style="white-space: nowrap;">${formatDate(o.fecha)}</td>
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
            toast.error("Error al generar reporte");
        } finally {
            setGeneratingPdf(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

    // ── Filtros aplicados sobre orders (cliente y estado los hace el backend) ─
    const filteredOrders = useMemo(() => {
        const q = search.trim().toLowerCase();
        return orders.filter(o => {
            if (filterMedio && String(o.medio_pago_id) !== String(filterMedio)) return false;
            if (q) {
                const hay =
                    String(o.id).includes(q) ||
                    (o.cliente_nombre || '').toLowerCase().includes(q);
                if (!hay) return false;
            }
            return true;
        });
    }, [orders, search, filterMedio]);

    const hasActiveFilter = search || filterEstado !== 'todos' || filterCliente || filterMedio;
    const clearFilters = () => {
        setSearch(''); setFilterEstado('todos'); setFilterCliente(''); setFilterMedio('');
    };

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const noCancel = orders.filter(o => o.estado !== 'cancelado');
        const total = noCancel.reduce((s, o) => s + Number(o.total || 0), 0);
        const porCobrar = orders
            .filter(o => o.estado !== 'pagado' && o.estado !== 'cancelado')
            .reduce((s, o) => s + (Number(o.total || 0) - Number(o.monto_pagado || 0)), 0);
        const ticket = noCancel.length > 0 ? total / noCancel.length : 0;
        const porEstado = orders.reduce((acc, o) => {
            acc[o.estado] = (acc[o.estado] || 0) + 1;
            return acc;
        }, {});
        return { total, porCobrar, ticket, porEstado, totalPedidos: noCancel.length };
    }, [orders]);

    const totalSales = stats.total;     // compat con el render existente
    const totalFiltrado = filteredOrders.reduce((s, o) => s + (o.estado !== 'cancelado' ? Number(o.total || 0) : 0), 0);

    // Agrupación de cantidades por producto (excluye cancelados)
    const productosChart = useMemo(() => {
        const map = {};
        orders
            .filter(o => o.estado !== 'cancelado')
            .forEach(o => (o.items || []).forEach(item => {
                const key = item.producto_nombre || `#${item.producto_id}`;
                map[key] = (map[key] || 0) + Number(item.cantidad);
            }));
        return Object.entries(map)
            .map(([nombre, cantidad]) => ({ nombre, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad);
    }, [orders]);

    const COLORS = ['#8b5cf6','#6d28d9','#a78bfa','#7c3aed','#c4b5fd','#5b21b6','#ddd6fe','#4c1d95'];

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        return (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 700 }}>{payload[0].payload.nombre}</div>
                <div style={{ color: 'var(--brand)' }}>{payload[0].value} unidades</div>
            </div>
        );
    };

    return (
        <div>
            <div className="page-header flex justify-between items-center mb-4">
                <h1>Reporte Mensual Pedidos</h1>
                <div className="filter-bar filter-bar--inline" style={{ marginBottom: 0 }}>
                    <select className="filter-bar__select"
                        value={month.split('-')[1]}
                        onChange={e => setMonth(`${month.split('-')[0]}-${e.target.value}`)}>
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
                    <select className="filter-bar__select"
                        value={month.split('-')[0]}
                        onChange={e => setMonth(`${e.target.value}-${month.split('-')[1]}`)}>
                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* KPIs del mes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                {/* Ventas del mes */}
                <div className="card p-3 mb-0" style={{ borderTop: '3px solid #10b981' }}>
                    <div className="flex items-center gap-1 text-muted text-xs mb-1">
                        <TrendingUp size={13} className="text-success" /> Ventas del mes
                    </div>
                    <div className="text-xl font-bold truncate" title={formatCurrency(stats.total)}>{formatCurrency(stats.total)}</div>
                    <div className="text-xs text-muted mt-1">{stats.totalPedidos} pedido{stats.totalPedidos !== 1 ? 's' : ''} no cancelados</div>
                </div>

                {/* Por cobrar */}
                <div className="card p-3 mb-0" style={{ borderTop: `3px solid ${stats.porCobrar > 0 ? '#f59e0b' : '#64748b'}` }}>
                    <div className="flex items-center gap-1 text-muted text-xs mb-1">
                        <AlertCircle size={13} style={{ color: stats.porCobrar > 0 ? '#f59e0b' : '#64748b' }} /> Por cobrar
                    </div>
                    <div className="text-xl font-bold truncate" style={{ color: stats.porCobrar > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
                        {formatCurrency(stats.porCobrar)}
                    </div>
                    <div className="text-xs text-muted mt-1">Saldo pendiente del mes</div>
                </div>

                {/* Ticket promedio */}
                <div className="card p-3 mb-0" style={{ borderTop: '3px solid #8b5cf6' }}>
                    <div className="flex items-center gap-1 text-muted text-xs mb-1">
                        <DollarSign size={13} style={{ color: '#8b5cf6' }} /> Ticket promedio
                    </div>
                    <div className="text-xl font-bold truncate">{formatCurrency(stats.ticket)}</div>
                    <div className="text-xs text-muted mt-1">Promedio por pedido</div>
                </div>

                {/* Desglose por estado (mini bar) */}
                <div className="card p-3 mb-0" style={{ borderTop: '3px solid #3b82f6' }}>
                    <div className="flex items-center gap-1 text-muted text-xs mb-1">
                        <ShoppingBag size={13} style={{ color: '#3b82f6' }} /> Pedidos por estado
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                        {[
                            { k: 'pendiente',  label: '⏳ Pendientes',  color: '#ef4444' },
                            { k: 'por_cobrar', label: '🚚 Por cobrar',  color: '#f59e0b' },
                            { k: 'pagado',     label: '✅ Pagados',      color: '#10b981' },
                            { k: 'cancelado',  label: '❌ Cancelados',   color: '#64748b' },
                        ].map(({ k, label, color }) => {
                            const n = stats.porEstado[k] || 0;
                            const pct = orders.length > 0 ? (n / orders.length * 100) : 0;
                            return (
                                <div key={k} title={`${n} pedidos (${pct.toFixed(0)}%)`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                                    onClick={() => setFilterEstado(filterEstado === k ? 'todos' : k)}>
                                    <span style={{ minWidth: 100, color: 'var(--text-secondary)' }}>{label}</span>
                                    <div style={{ flex: 1, height: 4, background: 'var(--bg-secondary)', borderRadius: 2 }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
                                    </div>
                                    <span style={{ minWidth: 22, textAlign: 'right', fontWeight: 700 }}>{n}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Generar Estado de Cuenta (se mantiene) */}
                <div className="card p-3 mb-0" style={{ borderTop: '3px solid #ffdd19' }}>
                    <div className="flex items-center gap-1 text-muted text-xs mb-1">
                        <FileText size={13} /> Generar Estado de Cuenta
                    </div>
                    <div className="flex gap-2 w-full items-center mt-1">
                        <select
                            className="form-control text-sm"
                            value={selectedClientId}
                            onChange={e => setSelectedClientId(e.target.value)}
                            style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '4px 6px' }}
                        >
                            <option value="">Cliente…</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleGeneratePDF}
                            disabled={generatingPdf || !selectedClientId}
                            className="btn btn-primary text-sm"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            title="Generar PDF"
                        >
                            {generatingPdf ? '…' : 'PDF'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Barra de filtros */}
            <div className="filter-bar">
                <div className="filter-bar__search">
                    <Search size={14} />
                    <input type="text" placeholder="Buscar por ID o nombre de cliente…"
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <select className={`filter-bar__select${filterEstado !== 'todos' ? ' filter-bar__select--active' : ''}`}
                    value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                    <option value="todos">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="por_cobrar">Por cobrar</option>
                    <option value="pagado">Pagado</option>
                    <option value="cancelado">Cancelado</option>
                </select>

                <select className={`filter-bar__select${filterCliente ? ' filter-bar__select--active' : ''}`}
                    value={filterCliente} onChange={e => setFilterCliente(e.target.value)}>
                    <option value="">Todos los clientes</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>

                <select className={`filter-bar__select${filterMedio ? ' filter-bar__select--active' : ''}`}
                    value={filterMedio} onChange={e => setFilterMedio(e.target.value)}>
                    <option value="">Todos los medios</option>
                    {paymentMethodsList.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>

                <div className="filter-bar__actions">
                    <span className={`filter-bar__count${hasActiveFilter ? ' filter-bar__count--active' : ''}`}>
                        {(() => {
                            if (!hasActiveFilter) return `${orders.length} pedidos`;
                            const labels = [];
                            if (filterCliente) {
                                const c = clients.find(x => String(x.id) === String(filterCliente));
                                if (c) labels.push(`Cliente: ${c.nombre}`);
                            }
                            if (filterEstado !== 'todos') labels.push(`Estado: ${filterEstado}`);
                            if (filterMedio) labels.push(`Medio: ${paymentMethods[filterMedio] || filterMedio}`);
                            if (search) labels.push(`"${search}"`);
                            return `${labels.join(' · ')} → ${filteredOrders.length} pedidos · ${formatCurrency(totalFiltrado)}`;
                        })()}
                    </span>
                    {hasActiveFilter && (
                        <button className="btn btn-secondary" onClick={clearFilters}
                            style={{ padding: '6px 12px', fontSize: 12 }}>
                            <X size={12} style={{ marginRight: 4 }} /> Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Gráfica productos vendidos */}
            {productosChart.length > 0 && (
                <div className="card mb-4">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <BarChart2 size={16} style={{ color: 'var(--brand)' }} />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Productos vendidos en el mes</span>
                        <span className="text-muted" style={{ fontSize: '0.78rem', marginLeft: 4 }}>— cantidad de unidades por producto</span>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={productosChart} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis
                                dataKey="nombre"
                                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                angle={-35}
                                textAnchor="end"
                                interval={0}
                            />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.08)' }} />
                            <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                {productosChart.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

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
                        ) : filteredOrders.length === 0 ? (
                            <tr><td colSpan="8" className="p-4 text-center text-muted">
                                {orders.length === 0
                                    ? 'No se encontraron pedidos en este mes.'
                                    : 'Ningún pedido coincide con los filtros activos.'}
                            </td></tr>
                        ) : (
                            filteredOrders.map(order => (
                                <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td className="p-3">#{order.id}</td>
                                    <td className="p-3 text-sm">{formatDate(order.fecha)}</td>
                                    <td className="p-3 font-bold">{order.cliente_nombre}</td>
                                    <td className="p-3">
                                        <button
                                            onClick={() => handleStatusClick(order)}
                                            style={{
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                background: order.estado === 'pagado' ? 'rgba(16,185,129,0.12)' : order.estado === 'cancelado' ? 'rgba(148,163,184,0.1)' : order.estado === 'por_cobrar' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                                                border: `1.5px solid ${order.estado === 'pagado' ? '#10b981' : order.estado === 'cancelado' ? '#64748b' : order.estado === 'por_cobrar' ? '#f59e0b' : '#ef4444'}`,
                                                color: order.estado === 'pagado' ? '#10b981' : order.estado === 'cancelado' ? '#64748b' : order.estado === 'por_cobrar' ? '#f59e0b' : '#ef4444',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '999px',
                                                fontWeight: 'bold',
                                                letterSpacing: '0.5px',
                                                cursor: 'pointer'
                                            }}
                                            title="Cambiar estado"
                                        >
                                            {order.estado}
                                        </button>
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

            {/* Status Modal */}
            {statusModal.open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '95%', maxWidth: '400px', margin: 0, position: 'relative' }}>
                        <button
                            onClick={() => setStatusModal({ ...statusModal, open: false })}
                            className="btn-close-modal"
                            title="Cerrar"
                        >
                            <X size={20} />
                        </button>
                        <h3>Actualizar Estado</h3>
                        <p className="text-muted text-sm mb-4">Estado actual: <strong>{statusModal.currentStatus}</strong></p>

                        <div className="flex flex-col gap-4">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', width: '100%' }}>
                                <button
                                    onClick={() => confirmStatusChange('pendiente')}
                                    className="btn btn-secondary"
                                    style={{ height: '50px', fontSize: '0.75rem', padding: '0' }}
                                    disabled={statusModal.currentStatus === 'pendiente'}
                                >
                                    ⏳ PENDIENTE
                                </button>

                                <button
                                    onClick={() => confirmStatusChange('por_cobrar')}
                                    className="btn"
                                    style={{
                                        background: statusModal.currentStatus === 'por_cobrar' ? 'rgba(245,158,11,0.15)' : 'transparent',
                                        border: '1px solid #f59e0b',
                                        color: '#f59e0b',
                                        height: '50px', fontSize: '0.75rem', padding: '0'
                                    }}
                                    disabled={statusModal.currentStatus === 'por_cobrar'}
                                >
                                    🚚 POR COBRAR
                                </button>

                                <button
                                    onClick={() => setIsPagadoExpanded(!isPagadoExpanded)}
                                    className="btn"
                                    style={{
                                        background: isPagadoExpanded ? 'rgba(245, 158, 11, 0.1)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                                        color: isPagadoExpanded ? 'var(--primary)' : 'white',
                                        border: isPagadoExpanded ? '1px solid var(--primary)' : 'none',
                                        height: '50px', fontSize: '0.75rem', padding: '0'
                                    }}
                                >
                                    {isPagadoExpanded ? 'PAGANDO...' : '✅ PAGADO'}
                                </button>

                                <button
                                    onClick={() => { if (window.confirm('¿Seguro que deseas cancelar este pedido?')) confirmStatusChange('cancelado'); }}
                                    className="btn"
                                    style={{
                                        background: 'transparent', border: '1px solid var(--danger)',
                                        color: 'var(--danger)', height: '50px', fontSize: '0.75rem', padding: '0'
                                    }}
                                >
                                    ❌ ANULAR
                                </button>
                            </div>

                            {isPagadoExpanded && (
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', textAlign: 'center', marginBottom: '0.75rem' }}>Seleccionar Medio de Pago *</label>
                                    <select
                                        className="form-control mb-4"
                                        value={selectedMethod}
                                        onChange={e => setSelectedMethod(e.target.value)}
                                        style={{ height: '45px', fontSize: '1rem', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}
                                        autoFocus
                                    >
                                        <option value="">-- Escoger Medio --</option>
                                        {paymentMethodsList.map(m => (
                                            <option key={m.id} value={m.id}>{m.nombre}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => confirmStatusChange('pagado')}
                                        className="btn w-full"
                                        style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white', height: '50px', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                                    >
                                        CONFIRMAR PAGO
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

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

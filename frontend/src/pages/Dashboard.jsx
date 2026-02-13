import { useEffect, useState } from 'react';
import { reportsService, receivablesService, paymentMethodsService, clientsService, suppliersService } from '../services/api';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, CreditCard, X, Save, FileText, User, Calendar } from 'lucide-react';

export default function Dashboard() {
    const [expandedClient, setExpandedClient] = useState(null);

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // Payment Modal State
    const [paymentModal, setPaymentModal] = useState({ show: false, clientId: null, clientName: '', totalDebt: 0 });
    const [paymentForm, setPaymentForm] = useState({ amount: '', methodId: '', description: '' });
    const [paymentMethods, setPaymentMethods] = useState([]);

    // Report Modal State
    const [reportModal, setReportModal] = useState({ show: false, data: null });

    // Calculate default date range (30 days)
    const getDefaultDates = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    };

    const [selectedRangeDays, setSelectedRangeDays] = useState(30);
    const [reportForm, setReportForm] = useState({
        clientId: '',
        startDate: getDefaultDates().start,
        endDate: getDefaultDates().end
    });
    const [allClients, setAllClients] = useState([]);

    // Vendor Report Modal State
    const [vendorReportModal, setVendorReportModal] = useState({ show: false, data: null });
    const [vendorReportForm, setVendorReportForm] = useState({
        vendorId: '',
        startDate: getDefaultDates().start,
        endDate: getDefaultDates().end
    });
    const [allVendors, setAllVendors] = useState([]);
    const [vendorRangeDays, setVendorRangeDays] = useState(30);

    useEffect(() => {
        loadStats();
        loadPaymentMethods();
        loadClients();
        loadVendors();
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

    const loadPaymentMethods = async () => {
        try {
            const res = await paymentMethodsService.getAll();
            setPaymentMethods(res.data.filter(m => m.activo));
        } catch (err) {
            console.error(err);
        }
    };

    const loadClients = async () => {
        try {
            const res = await clientsService.getAll();
            setAllClients(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadVendors = async () => {
        try {
            const res = await suppliersService.getAll();
            setAllVendors(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleOpenPayment = (client, e) => {
        e.stopPropagation();
        setPaymentModal({
            show: true,
            clientId: client.id,
            clientName: client.nombre,
            totalDebt: client.total
        });
        setPaymentForm({ amount: '', methodId: '', description: '' });
    };

    const handleRegisterPayment = async (e) => {
        e.preventDefault();
        try {
            if (!paymentForm.amount || !paymentForm.methodId) {
                alert("Por favor ingrese el monto y el medio de pago");
                return;
            }

            const payload = {
                cliente_id: paymentModal.clientId,
                monto: parseFloat(paymentForm.amount),
                metodo_pago_id: parseInt(paymentForm.methodId),
                descripcion: paymentForm.description || "Abono a deuda desde Dashboard"
            };

            await receivablesService.registerPayment(payload);
            setPaymentModal({ ...paymentModal, show: false });
            alert("Abono registrado correctamente");
            loadStats(); // Reload dashboard to update debts
        } catch (error) {
            console.error(error);
            alert("Error al registrar abono");
        }
    };

    const handleRangeSelect = (days) => {
        setSelectedRangeDays(days);
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        setReportForm(prev => ({
            ...prev,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        }));
    };

    const handleGenerateReport = async (e) => {
        e.preventDefault();
        try {
            if (!reportForm.clientId || !reportForm.startDate || !reportForm.endDate) {
                alert("Seleccione cliente y el rango de fechas");
                return;
            }
            const res = await reportsService.getClientReport(reportForm.clientId, reportForm.startDate, reportForm.endDate);
            setReportModal({ ...reportModal, data: res.data });
        } catch (error) {
            console.error(error);
            alert("Error al generar reporte");
        }
    };

    const handleVendorRangeSelect = (days) => {
        setVendorRangeDays(days);
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        setVendorReportForm(prev => ({
            ...prev,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        }));
    };

    const handleGenerateVendorReport = async (e) => {
        e.preventDefault();
        try {
            if (!vendorReportForm.vendorId || !vendorReportForm.startDate || !vendorReportForm.endDate) {
                alert("Seleccione proveedor y el rango de fechas");
                return;
            }
            const res = await reportsService.getVendorReport(vendorReportForm.vendorId, vendorReportForm.startDate, vendorReportForm.endDate);
            setVendorReportModal({ ...vendorReportModal, data: res.data });
        } catch (error) {
            console.error(error);
            alert("Error al generar reporte de proveedor");
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

    const escapeHtml = (unsafe) => {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const generatePDF = () => {
        if (!reportModal.data) return;

        const { client_name, start_date, end_date, orders, period_total, total_pending_debt } = reportModal.data;
        const dateGen = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

        // Helper safety check for dates
        const sDate = start_date ? new Date(start_date).toLocaleDateString('es-CO') : 'N/A';
        const eDate = end_date ? new Date(end_date).toLocaleDateString('es-CO') : 'N/A';
        const rangeStr = `${sDate} - ${eDate}`;

        const printWindow = window.open('', '_blank', 'width=900,height=600');
        if (!printWindow) {
            alert("Permita ventanas emergentes para generar el reporte.");
            return;
        }

        const htmlContent = `
            <html>
            <head>
                <title>Reporte Cliente - ${escapeHtml(client_name)}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.4; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo-text { font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
                    .report-info h1 { font-size: 28px; margin: 0 0 10px 0; font-weight: 800; }
                    .client-info { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #eee; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
                    th { background-color: #2c3e50; color: white; padding: 12px 10px; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                    td { border-bottom: 1px solid #ddd; padding: 12px 10px; vertical-align: top; }
                    tr:nth-child(even) { background-color: #f8f8f8; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .font-bold { font-weight: bold; }
                    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
                    .badge-pendiente { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
                    .badge-pagado { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                    .badge-cancelado { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                    .total-box { margin-top: 30px; float: right; width: 300px; }
                    .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                    .total-final { font-size: 18px; font-weight: bold; color: #d32f2f; border-top: 2px solid #222; border-bottom: none; padding-top: 15px; margin-top: 5px; }
                    .footer { clear: both; margin-top: 60px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center; font-size: 11px; color: #777; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="report-info">
                        <h1>REPORTE DE CLIENTE</h1>
                        <div style="color: #666;">Generado: ${dateGen}</div>
                    </div>
                    <img src="/logo-betania.jpeg" alt="Logo" style="height: 80px;" />
                </div>

                <div class="client-info">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <strong style="color: #666; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Cliente</strong>
                            <span style="font-size: 16px; font-weight: bold;">${escapeHtml(client_name)}</span>
                        </div>
                        <div>
                            <strong style="color: #666; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Periodo Consultado</strong>
                            <span style="font-size: 16px;">${rangeStr}</span>
                        </div>
                    </div>
                </div>
                
                <h3>Detalle de Movimientos</h3>
                <table>
                    <thead>
                        <tr>
                            <th width="15%">Fecha</th>
                            <th width="10%">ID</th>
                            <th width="40%">Detalle / Productos</th>
                            <th width="15%" class="text-center">Estado</th>
                            <th width="20%" class="text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.map(o => {
            const badgeClass = o.estado === 'pendiente' ? 'badge-pendiente' : (o.estado === 'pagado' ? 'badge-pagado' : 'badge-cancelado');
            return `
                                <tr>
                                    <td>${new Date(o.fecha).toLocaleDateString('es-CO')}</td>
                                    <td><strong>#${o.id}</strong></td>
                                    <td>
                                        <ul style="margin: 0; padding-left: 15px;">
                                            ${o.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
                                        </ul>
                                    </td>
                                    <td class="text-center">
                                        <span class="badge ${badgeClass}">${o.estado}</span>
                                    </td>
                                    <td class="text-right font-bold">$${new Intl.NumberFormat('es-CO').format(o.total)}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
                
                <div class="total-box">
                    <div class="total-row">
                        <span>Total Ventas Periodo:</span>
                        <span>$${new Intl.NumberFormat('es-CO').format(period_total)}</span>
                    </div>
                    <div class="total-row total-final">
                        <span>Total Pendiente (Global):</span>
                        <span>$${new Intl.NumberFormat('es-CO').format(total_pending_debt)}</span>
                    </div>
                </div>

                <div class="footer">
                    <p>Reporte generado automáticamente por ArepasERP</p>
                </div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const generateVendorPDF = () => {
        if (!vendorReportModal.data) return;

        const { vendor_name, start_date, end_date, expenses, period_total } = vendorReportModal.data;
        const dateGen = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const sDate = start_date ? new Date(start_date).toLocaleDateString('es-CO') : 'N/A';
        const eDate = end_date ? new Date(end_date).toLocaleDateString('es-CO') : 'N/A';
        const rangeStr = `${sDate} - ${eDate}`;

        const printWindow = window.open('', '_blank', 'width=900,height=600');
        if (!printWindow) {
            alert("Permita ventanas emergentes para generar el reporte.");
            return;
        }

        const htmlContent = `
            <html>
            <head>
                <title>Reporte Proveedor - ${escapeHtml(vendor_name)}</title>
                 <style>
                    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.4; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 20px; margin-bottom: 30px; }
                    .report-info h1 { font-size: 28px; margin: 0 0 10px 0; font-weight: 800; }
                    .client-info { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #eee; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
                    th { background-color: #2c3e50; color: white; padding: 12px 10px; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                    td { border-bottom: 1px solid #ddd; padding: 12px 10px; vertical-align: top; }
                    tr:nth-child(even) { background-color: #f8f8f8; }
                    .text-right { text-align: right; }
                    .font-bold { font-weight: bold; }
                    .total-box { margin-top: 30px; float: right; width: 300px; }
                    .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                    .total-final { font-size: 18px; font-weight: bold; color: #d32f2f; border-top: 2px solid #222; border-bottom: none; padding-top: 15px; margin-top: 5px; }
                    .footer { clear: both; margin-top: 60px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center; font-size: 11px; color: #777; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="report-info">
                        <h1>REPORTE DE PROVEEDOR</h1>
                        <div style="color: #666;">Generado: ${dateGen}</div>
                    </div>
                    <img src="/logo-betania.jpeg" alt="Logo" style="height: 80px;" />
                </div>

                <div class="client-info">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <strong style="color: #666; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Proveedor</strong>
                            <span style="font-size: 16px; font-weight: bold;">${escapeHtml(vendor_name)}</span>
                        </div>
                        <div>
                            <strong style="color: #666; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Periodo Consultado</strong>
                            <span style="font-size: 16px;">${rangeStr}</span>
                        </div>
                    </div>
                </div>
                
                <h3>Detalle de Gastos/Compras</h3>
                <table>
                    <thead>
                        <tr>
                            <th width="15%">Fecha</th>
                            <th width="10%">ID</th>
                            <th width="55%">Concepto / Detalle</th>
                            <th width="20%" class="text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expenses.map(e => `
                            <tr>
                                <td>${e.fecha ? new Date(e.fecha).toLocaleDateString('es-CO') : 'N/A'}</td>
                                <td><strong>#${e.id}</strong></td>
                                <td>
                                    ${escapeHtml(e.concepto)}
                                    ${e.observaciones ? `<br/><small style="color:#666; font-style:italic">${escapeHtml(e.observaciones)}</small>` : ''}
                                </td>
                                <td class="text-right font-bold">$${new Intl.NumberFormat('es-CO').format(e.valor)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="total-box">
                    <div class="total-row total-final">
                        <span>Total Periodo:</span>
                        <span>$${new Intl.NumberFormat('es-CO').format(period_total)}</span>
                    </div>
                </div>

                <div class="footer">
                    <p>Reporte generado automáticamente por ArepasERP</p>
                </div>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div>
            {/* Headers and Widgets code ... keep same structure until Cuentas por Cobrar */}
            <header className="flex justify-between items-center mb-4">
                <h1 className="m-0">Dashboard</h1>
                <span className="text-muted">{new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </header>

            {/* Quick Actions Section */}
            <div className="mb-6">
                <h2 className="text-lg mb-3 text-muted">Acciones Rápidas</h2>
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={() => setReportModal({ show: true, data: null })}
                        className="btn btn-secondary"
                        style={{
                            padding: '0.8rem 1.2rem',
                            fontSize: '0.9rem',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'center',
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151'
                        }}
                    >
                        <FileText size={20} className="text-primary" />
                        <span>Reporte Cliente</span>
                    </button>
                    <button
                        onClick={() => setVendorReportModal({ show: true, data: null })}
                        className="btn btn-secondary"
                        style={{
                            padding: '0.8rem 1.2rem',
                            fontSize: '0.9rem',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'center',
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151'
                        }}
                    >
                        <FileText size={20} className="text-warning" />
                        <span>Reporte Proveedor</span>
                    </button>
                    {/* Future report buttons can go here */}
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1rem' }}>
                {/* Monthly Stats */}
                <div style={{ flex: '1 1 300px' }}>
                    <h2 className="text-lg mb-2">Mensual</h2>
                    <div className="card" style={{ marginBottom: 0 }}>
                        <div className="flex justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1 text-muted">
                                    <TrendingUp size={16} className="text-success" />
                                    <small>Ventas</small>
                                </div>
                                <h3 className="m-0 text-xl">{formatCurrency(ventasMes)}</h3>
                            </div>
                            <div className="text-right">
                                <div className="flex items-center justify-end gap-2 mb-1 text-muted">
                                    <small>Gastos</small>
                                    <TrendingDown size={16} className="text-danger" />
                                </div>
                                <h3 className="m-0 text-xl">{formatCurrency(gastosMes)}</h3>
                            </div>
                        </div>

                        <div className="my-3 border-t border-white/10"></div>

                        <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-xs text-muted mb-1">Balance Neto</span>
                                <span className={`text-lg font-bold ${ventasMes - gastosMes >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {ventasMes - gastosMes >= 0 ? '+' : ''}{formatCurrency(ventasMes - gastosMes)}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', background: '#000', padding: '8px 12px', borderRadius: '20px', border: '1px solid #444' }}>
                                <div title="Ganancia" style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#22c55e', opacity: ventasMes > gastosMes ? 1 : 0.2, boxShadow: ventasMes > gastosMes ? '0 0 10px #22c55e' : 'none', transition: 'all 0.3s' }}></div>
                                <div title="Equilibrio" style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#eab308', opacity: Math.abs(ventasMes - gastosMes) < 1000 ? 1 : 0.2, boxShadow: Math.abs(ventasMes - gastosMes) < 1000 ? '0 0 10px #eab308' : 'none', transition: 'all 0.3s' }}></div>
                                <div title="Déficit" style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#ef4444', opacity: gastosMes > ventasMes ? 1 : 0.2, boxShadow: gastosMes > ventasMes ? '0 0 10px #ef4444' : 'none', transition: 'all 0.3s' }}></div>
                            </div>
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
                                <div className="text-right flex items-center gap-4">
                                    <div>
                                        <div className="text-danger font-bold">{formatCurrency(client.total)}</div>
                                        <div className="text-xs text-secondary" style={{ marginTop: '0.25rem' }}>
                                            {expandedClient === client.id ? 'Ocultar detalle' : 'Ver detalle'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleOpenPayment(client, e)}
                                        className="btn btn-primary"
                                        style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', height: 'auto', width: 'auto' }}
                                    >
                                        <DollarSign size={14} className="mr-1" /> Abonar
                                    </button>
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
                                                        {item.estado === 'parcial' && <span className="badge ml-2" style={{ lineHeight: 1, padding: '2px 4px' }}>Parcial</span>}
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

            {/* Payment Modal */}
            {paymentModal.show && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '400px', position: 'relative', overflow: 'visible' }}>
                        <button
                            onClick={() => setPaymentModal({ ...paymentModal, show: false })}
                            className="btn-close-modal"
                            title="Cerrar"
                        >
                            <X size={18} />
                        </button>

                        <div className="mb-4">
                            <h2 className="m-0 text-xl">Registrar Abono</h2>
                            <p className="text-muted text-sm mt-1">Cliente: <strong className="text-white">{paymentModal.clientName}</strong></p>
                        </div>

                        <div className="bg-dark p-3 rounded mb-4" style={{ border: '1px solid var(--border)' }}>
                            <p className="text-xs text-muted mb-1">Total Deuda Actual</p>
                            <p className="text-xl font-bold text-danger m-0">{formatCurrency(paymentModal.totalDebt)}</p>
                        </div>

                        <form onSubmit={handleRegisterPayment}>
                            <div className="form-group mb-4">
                                <label>Monto a Abonar</label>
                                <div className="relative">
                                    <span style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }}>$</span>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ paddingLeft: '25px', fontSize: '1.2rem', fontWeight: 'bold' }}
                                        value={paymentForm.amount}
                                        onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                        required
                                        min="1"
                                        max={paymentModal.totalDebt}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="form-group mb-4">
                                <label>Medio de Pago</label>
                                <select
                                    className="form-control"
                                    value={paymentForm.methodId}
                                    onChange={e => setPaymentForm({ ...paymentForm, methodId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {paymentMethods.map(m => (
                                        <option key={m.id} value={m.id}>{m.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group mb-4">
                                <label>Descripción (Opcional)</label>
                                <input
                                    className="form-control"
                                    value={paymentForm.description}
                                    onChange={e => setPaymentForm({ ...paymentForm, description: e.target.value })}
                                    placeholder="Ej: Abono parcial en efectivo"
                                />
                            </div>

                            <p className="text-xs text-muted mb-4">
                                * Se aplicará a la deuda más antigua primero.
                            </p>

                            <button type="submit" className="btn btn-primary font-bold w-full" style={{ padding: '0.8rem' }}>
                                <DollarSign size={18} className="mr-2" />
                                Confirmar Abono
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Client Report Modal */}
            {reportModal.show && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 110,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{
                        width: '90%', maxWidth: '650px',
                        position: 'relative', overflow: 'visible'
                    }}>
                        <button
                            onClick={() => setReportModal({ show: false, data: null })}
                            className="btn-close-modal"
                            title="Cerrar"
                        >
                            <X size={18} />
                        </button>

                        {!reportModal.data ? (
                            <>
                                <h2 className="mb-6 flex items-center gap-2">
                                    <FileText size={24} className="text-primary" />
                                    Reporte Cliente
                                </h2>
                                <form onSubmit={handleGenerateReport}>
                                    <div className="form-group mb-4">
                                        <label className="mb-2 block text-sm font-medium text-muted">Cliente</label>
                                        <div className="relative">
                                            <select
                                                className="form-control"
                                                value={reportForm.clientId}
                                                onChange={e => setReportForm({ ...reportForm, clientId: e.target.value })}
                                                required
                                            >
                                                <option value="">-- Seleccionar --</option>
                                                {allClients.map(c => (
                                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group mb-6">
                                        <label className="mb-2 block text-sm font-medium text-muted">Rango de Tiempo</label>
                                        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                            {[
                                                { label: '1 Mes', days: 30 },
                                                { label: '3 Meses', days: 90 },
                                                { label: '6 Meses', days: 180 },
                                                { label: '1 Año', days: 365 }
                                            ].map(range => (
                                                <button
                                                    key={range.days}
                                                    type="button"
                                                    onClick={() => handleRangeSelect(range.days)}
                                                    className={`btn ${selectedRangeDays === range.days ? 'btn-primary' : 'btn-secondary'} text-sm py-2`}
                                                    style={{ border: '1px solid rgba(255,255,255,0.1)', flex: 1 }}
                                                >
                                                    {range.label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted mt-3 text-center">
                                            Periodo: {safeDateFormat(reportForm.startDate)} - {safeDateFormat(reportForm.endDate)}
                                        </p>
                                    </div>

                                    <button type="submit" className="btn btn-primary w-full py-3 text-base font-bold shadow-lg">
                                        Generar Consulta
                                    </button>
                                </form>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-6">
                                    <h2 className="mb-1 text-xl">{reportModal.data.client_name}</h2>
                                    <p className="text-muted text-sm flex justify-center items-center gap-2">
                                        {safeDateFormat(reportModal.data.start_date, { day: '2-digit', month: 'short' })} - {safeDateFormat(reportModal.data.end_date, { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 rounded-lg bg-dark border border-white/10 text-center">
                                        <div className="text-muted text-xs mb-1">Ventas del Periodo</div>
                                        <div className="text-xl font-bold text-success">
                                            {formatCurrency(reportModal.data.period_total)}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-dark border border-white/10 text-center">
                                        <div className="text-muted text-xs mb-1">Deuda Pendiente</div>
                                        <div className="text-xl font-bold text-danger">
                                            {formatCurrency(reportModal.data.total_pending_debt)}
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <h4 className="border-b border-white/10 pb-2 mb-3 text-sm font-semibold text-muted uppercase tracking-wide">
                                        Detalle Pedidos
                                    </h4>
                                    <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                                        {reportModal.data.orders.length > 0 ? (
                                            <div className="space-y-3">
                                                {reportModal.data.orders.map(order => (
                                                    <div key={order.id} className="card" style={{ padding: '0.75rem', marginBottom: 0, border: '1px solid var(--border)' }}>
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-muted mb-1 block">
                                                                    {safeDateFormat(order.fecha, { day: '2-digit', month: 'short' })}
                                                                </span>
                                                                <strong style={{ fontSize: '1rem' }}>Pedido #{order.id}</strong>
                                                                <span className={`text-[10px] uppercase font-bold mt-1 ${order.estado === 'pendiente' ? 'text-warning' :
                                                                    order.estado === 'parcial' ? 'text-info' : 'text-success'
                                                                    }`}>
                                                                    {order.estado}
                                                                </span>
                                                            </div>
                                                            <span className="text-success font-bold" style={{ fontSize: '1.1rem' }}>
                                                                {formatCurrency(order.total)}
                                                            </span>
                                                        </div>

                                                        <div className="mt-3 pt-2 text-muted" style={{ fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                            {order.items.map((item, i) => (
                                                                <div key={i} className="flex justify-between mb-1">
                                                                    <span>• {item}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 text-muted border border-dashed border-white/10 rounded">
                                                No hay pedidos registrados en este periodo.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={generatePDF}
                                        className="btn btn-primary w-full py-2 flex items-center justify-center gap-2"
                                    >
                                        <FileText size={18} /> Descargar PDF
                                    </button>
                                    <button
                                        onClick={() => setReportModal({ ...reportModal, data: null })}
                                        className="btn btn-outline w-full py-2 hover:bg-white/10 transition-colors"
                                    >
                                        Nueva Consulta
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {/* Vendor Report Modal */}
            {vendorReportModal.show && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 110,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{
                        width: '90%', maxWidth: '650px',
                        position: 'relative', overflow: 'visible'
                    }}>
                        <button
                            onClick={() => setVendorReportModal({ show: false, data: null })}
                            className="btn-close-modal"
                            title="Cerrar"
                        >
                            <X size={18} />
                        </button>

                        {!vendorReportModal.data ? (
                            <>
                                <h2 className="mb-6 flex items-center gap-2">
                                    <FileText size={24} className="text-warning" />
                                    Reporte Proveedor
                                </h2>
                                <form onSubmit={handleGenerateVendorReport}>
                                    <div className="form-group mb-4">
                                        <label className="mb-2 block text-sm font-medium text-muted">Proveedor</label>
                                        <div className="relative">
                                            <select
                                                className="form-control"
                                                value={vendorReportForm.vendorId}
                                                onChange={e => setVendorReportForm({ ...vendorReportForm, vendorId: e.target.value })}
                                                required
                                            >
                                                <option value="">-- Seleccionar --</option>
                                                {allVendors.map(v => (
                                                    <option key={v.id} value={v.id}>{v.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group mb-6">
                                        <label className="mb-2 block text-sm font-medium text-muted">Rango de Tiempo</label>
                                        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                            {[
                                                { label: '1 Mes', days: 30 },
                                                { label: '3 Meses', days: 90 },
                                                { label: '6 Meses', days: 180 },
                                                { label: '1 Año', days: 365 }
                                            ].map(range => (
                                                <button
                                                    key={range.days}
                                                    type="button"
                                                    onClick={() => handleVendorRangeSelect(range.days)}
                                                    className={`btn ${vendorRangeDays === range.days ? 'btn-primary' : 'btn-secondary'} text-sm py-2`}
                                                    style={{ border: '1px solid rgba(255,255,255,0.1)', flex: 1 }}
                                                >
                                                    {range.label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted mt-3 text-center">
                                            Periodo: {safeDateFormat(vendorReportForm.startDate)} - {safeDateFormat(vendorReportForm.endDate)}
                                        </p>
                                    </div>

                                    <button type="submit" className="btn btn-primary w-full py-3 text-base font-bold shadow-lg">
                                        Generar Reporte
                                    </button>
                                </form>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-6">
                                    <h2 className="mb-1 text-xl">{vendorReportModal.data.vendor_name}</h2>
                                    <p className="text-muted text-sm flex justify-center items-center gap-2">
                                        {safeDateFormat(vendorReportModal.data.start_date, { day: '2-digit', month: 'short' })} - {safeDateFormat(vendorReportModal.data.end_date, { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-4 mb-6">
                                    <div className="p-4 rounded-lg bg-dark border border-white/10 text-center">
                                        <div className="text-muted text-xs mb-1">Total Gastos Periodo</div>
                                        <div className="text-xl font-bold text-danger">
                                            {formatCurrency(vendorReportModal.data.period_total)}
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <h4 className="border-b border-white/10 pb-2 mb-3 text-sm font-semibold text-muted uppercase tracking-wide">
                                        Detalle Gastos
                                    </h4>
                                    <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                                        {vendorReportModal.data.expenses.length > 0 ? (
                                            <div className="space-y-3">
                                                {vendorReportModal.data.expenses.map(expense => (
                                                    <div key={expense.id} className="card" style={{ padding: '0.75rem', marginBottom: 0, border: '1px solid var(--border)' }}>
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-muted mb-1 block">
                                                                    {safeDateFormat(expense.fecha, { day: '2-digit', month: 'short' })}
                                                                </span>
                                                                <strong style={{ fontSize: '1rem' }}>{expense.concepto}</strong>
                                                                {expense.observaciones && (
                                                                    <span className="text-xs text-muted mt-1 italic">{expense.observaciones}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-danger font-bold" style={{ fontSize: '1.1rem' }}>
                                                                {formatCurrency(expense.valor)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 text-muted border border-dashed border-white/10 rounded">
                                                No hay gastos registrados en este periodo.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={generateVendorPDF}
                                        className="btn btn-primary w-full py-2 flex items-center justify-center gap-2"
                                    >
                                        <FileText size={18} /> Descargar PDF
                                    </button>
                                    <button
                                        onClick={() => setVendorReportModal({ ...vendorReportModal, data: null })}
                                        className="btn btn-outline w-full py-2 hover:bg-white/10 transition-colors"
                                    >
                                        Nueva Consulta
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

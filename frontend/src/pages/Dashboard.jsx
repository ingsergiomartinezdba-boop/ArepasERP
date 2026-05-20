import { useEffect, useState, useMemo } from 'react';
import { reportsService, receivablesService, paymentMethodsService, clientsService, suppliersService, productionService, inventoryService, productsService, ordersService, analyticsService, insumosService } from '../services/api';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, CreditCard, X, Save, FileText, User, Calendar, FlaskConical, ShoppingBag, Layers, ChevronRight, Bell, Package, CheckCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';
import { toDateBogota, formatDate, formatDateLong } from '../utils/formatters';

const FMT_KG = (n) => `${Number(n).toFixed(2)} kg`;
const FMT_COP = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // Producción state
    const [prodData, setProdData] = useState({ cocciones: [], stock: {}, productos: [], recetas: [], pedidos: [], insumos: [], prodInsumos: [] });
    const [prodLoading, setProdLoading] = useState(true);

    // Payment Modal State (Abonar — monto libre)
    const [paymentModal, setPaymentModal] = useState({ show: false, clientId: null, clientName: '', totalDebt: 0 });
    const [paymentForm, setPaymentForm] = useState({ amount: '', methodId: '', description: '' });
    const [paymentMethods, setPaymentMethods] = useState([]);

    // Pagar Modal State (pago completo — solo pide medio de pago)
    const [pagarModal, setPagarModal] = useState({ show: false, clientId: null, clientName: '', totalDebt: 0 });
    const [pagarMethodId, setPagarMethodId] = useState('');

    // Report Modal State
    const [reportModal, setReportModal] = useState({ show: false, data: null });

    // Calculate default date range (30 days)
    const getDefaultDates = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        return {
            start: toDateBogota(start),
            end: toDateBogota(end)
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

    // Analytics
    const [forecastData, setForecastData] = useState(null);
    const [rentabilidadData, setRentabilidadData] = useState(null);

    useEffect(() => {
        loadStats();
        loadPaymentMethods();
        loadClients();
        loadVendors();
        loadProdData();
        loadForecast();
        loadRentabilidad();
    }, []);

    const loadProdData = async () => {
        setProdLoading(true);
        try {
            const [cocRes, invRes, prodRes, recRes, pedRes, insRes, piRes] = await Promise.allSettled([
                productionService.getCocciones({ limit: 100 }),
                inventoryService.getAll(),
                productsService.getAll(false),
                productionService.getRecetas(false),
                ordersService.getAll({ estado: 'pendiente,por_cobrar', limit: 100 }),
                insumosService.getAll(true),
                productsService.getAllInsumos(),
            ]);
            const stock = {};
            if (invRes.status === 'fulfilled') invRes.value.data.forEach(r => { stock[r.producto_id] = Number(r.cantidad); });
            setProdData({
                cocciones: cocRes.status === 'fulfilled' ? cocRes.value.data : [],
                stock,
                productos: prodRes.status === 'fulfilled' ? prodRes.value.data : [],
                recetas:   recRes.status === 'fulfilled' ? recRes.value.data : [],
                pedidos:   pedRes.status === 'fulfilled' ? pedRes.value.data || [] : [],
                insumos:   insRes.status === 'fulfilled' ? insRes.value.data || [] : [],
                prodInsumos: piRes.status === 'fulfilled' ? piRes.value.data || [] : [],
            });
        } catch { /* silent */ } finally {
            setProdLoading(false);
        }
    };

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
            setPaymentMethods(res.data);
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

    const loadForecast = async () => {
        try {
            const res = await analyticsService.forecastMasa();
            setForecastData(res.data);
        } catch { /* silent */ }
    };

    const loadRentabilidad = async () => {
        try {
            const res = await analyticsService.rentabilidad(30);
            setRentabilidadData(res.data);
        } catch { /* silent */ }
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
                toast.warning("Ingresa el monto y el medio de pago");
                return;
            }

            const payload = {
                cliente_id: paymentModal.clientId,
                monto: parseFloat(paymentForm.amount),
                medio_pago_id: parseInt(paymentForm.methodId),
            };

            await receivablesService.registerPayment(payload);
            setPaymentModal({ ...paymentModal, show: false });
            toast.success("Abono registrado correctamente");
            loadStats(); // Reload dashboard to update debts
        } catch (error) {
            console.error(error);
            toast.error("Error al registrar abono");
        }
    };

    const handlePagarCompleto = async (e) => {
        e.preventDefault();
        if (!pagarMethodId) { toast.warning('Selecciona un medio de pago'); return; }
        try {
            await receivablesService.registerPayment({
                cliente_id:    pagarModal.clientId,
                monto:         pagarModal.totalDebt,
                medio_pago_id: parseInt(pagarMethodId),
            });
            setPagarModal({ show: false, clientId: null, clientName: '', totalDebt: 0 });
            setPagarMethodId('');
            toast.success(`Pago de ${formatCurrency(pagarModal.totalDebt)} registrado`);
            loadStats();
        } catch {
            toast.error('Error al registrar pago');
        }
    };

    const handleRangeSelect = (days) => {
        setSelectedRangeDays(days);
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        setReportForm(prev => ({
            ...prev,
            startDate: toDateBogota(start),
            endDate: toDateBogota(end)
        }));
    };

    const handleGenerateReport = async (e) => {
        e.preventDefault();
        try {
            if (!reportForm.clientId || !reportForm.startDate || !reportForm.endDate) {
                toast.warning("Selecciona cliente y el rango de fechas");
                return;
            }
            const res = await reportsService.getClientReport(reportForm.clientId, reportForm.startDate, reportForm.endDate);
            setReportModal({ ...reportModal, data: res.data });
        } catch (error) {
            console.error(error);
            toast.error("Error al generar reporte");
        }
    };

    const handleVendorRangeSelect = (days) => {
        setVendorRangeDays(days);
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        setVendorReportForm(prev => ({
            ...prev,
            startDate: toDateBogota(start),
            endDate: toDateBogota(end)
        }));
    };

    const handleGenerateVendorReport = async (e) => {
        e.preventDefault();
        try {
            if (!vendorReportForm.vendorId || !vendorReportForm.startDate || !vendorReportForm.endDate) {
                toast.warning("Selecciona proveedor y el rango de fechas");
                return;
            }
            const res = await reportsService.getVendorReport(vendorReportForm.vendorId, vendorReportForm.startDate, vendorReportForm.endDate);
            setVendorReportModal({ ...vendorReportModal, data: res.data });
        } catch (error) {
            console.error(error);
            toast.error("Error al generar reporte");
        }
    };

    // ── Cálculos de producción ─────────────────────────────────────────────────
    const { cocciones, stock, productos, recetas, pedidos, insumos: insumosList, prodInsumos } = prodData;

    // Insumos clasificados como masa = los que son salida de alguna receta
    const idsMasaInsumos = useMemo(() => {
        const ids = new Set();
        recetas.forEach(r => { if (r.insumo_salida_id) ids.add(r.insumo_salida_id); });
        return ids;
    }, [recetas]);

    // kg de masa por unidad de producto (suma de producto_insumos masa)
    const masaKgPorProducto = useMemo(() => {
        const mapa = {};
        prodInsumos.forEach(pi => {
            if (idsMasaInsumos.has(pi.insumo_id)) {
                mapa[pi.producto_id] = (mapa[pi.producto_id] || 0) + Number(pi.cantidad || 0);
            }
        });
        return mapa;
    }, [prodInsumos, idsMasaInsumos]);

    // Stock total de masa = SUM(cantidad_actual) de insumos clasificados como masa
    const stockMasaTotal = useMemo(() =>
        insumosList.filter(i => idsMasaInsumos.has(i.id)).reduce((s, i) => s + Number(i.cantidad_actual || 0), 0),
    [insumosList, idsMasaInsumos]);

    const { masaCocinadaHoy, coccionesHoy } = useMemo(() => {
        const hoy = new Date().toDateString();
        const hoyItems = cocciones.filter(c => new Date(c.fecha).toDateString() === hoy);
        return { masaCocinadaHoy: hoyItems.reduce((s, c) => s + Number(c.masa_obtenida_kg), 0), coccionesHoy: hoyItems.length };
    }, [cocciones]);

    const pedidosPendientes = pedidos.filter(o => o.estado === 'pendiente');

    const masaComprometida = useMemo(() =>
        pedidosPendientes.reduce((sum, o) =>
            sum + (o.items || []).reduce((s, item) =>
                s + item.cantidad * (masaKgPorProducto[item.producto_id] || 0)
            , 0), 0),
    [pedidosPendientes, masaKgPorProducto]);

    // masaRestante = stock real del insumo Masa.
    // Las cocciones suman, los lotes de producción descuentan automáticamente.
    // No restar pedidos por_cobrar — eso sería doble conteo.
    const masaRestante = stockMasaTotal;
    const masaLibre = masaRestante - masaComprometida;
    const deficit = masaLibre < 0;
    // ──────────────────────────────────────────────────────────────────────────

    // ── Datos derivados para alertas y KPIs ─────────────────────────────────
    const forecastKgManana = forecastData?.forecast?.manana_kg || 0;
    const masaDisponibleResumen = forecastData?.stock_masa_resumen;
    const masaDisponibleKg = masaDisponibleResumen?.disponible_kg ?? masaRestante;
    const margenContable = rentabilidadData?.margen_contable_pct ?? rentabilidadData?.margen_neto_pct ?? null;
    const margenCaja     = rentabilidadData?.margen_caja_pct ?? null;
    // Para alertas usamos el contable (rentabilidad real del negocio)
    const margenNeto = margenContable;
    const totalDeuda = (stats?.clientes_deudores || []).reduce((s, c) => s + (c.saldo || 0), 0);
    const totalCaja = (stats?.flujo_caja || []).reduce((s, i) => s + i.saldo, 0);
    const ventasMes = stats?.ventas_mes || 0;
    const gastosMes = stats?.gastos_mes || 0;
    const ventasHoy = stats?.ventas_hoy || 0;
    const gastosHoy = stats?.gastos_hoy || 0;
    const deudores = stats?.clientes_deudores || [];

    // Alertas derivadas
    const alertas = useMemo(() => {
        const list = [];
        if (forecastKgManana > 0 && masaDisponibleKg < forecastKgManana * 0.5)
            list.push({ tipo: 'danger', icon: '🔴', msg: `Masa insuficiente: ${masaDisponibleKg.toFixed(1)} kg disponibles vs ${forecastKgManana.toFixed(1)} kg recomendadas mañana` });
        else if (forecastKgManana > 0 && masaDisponibleKg < forecastKgManana)
            list.push({ tipo: 'warning', icon: '🟡', msg: `Masa justa para mañana: ${masaDisponibleKg.toFixed(1)} kg disponibles — considera cocinar más` });
        if (deficit)
            list.push({ tipo: 'danger', icon: '🔴', msg: `Déficit de masa: faltan ${Math.abs(masaLibre).toFixed(1)} kg para cubrir pedidos pendientes` });
        const vencidos = deudores.filter(c => {
            const dias = c.fecha ? Math.floor((Date.now() - new Date(c.fecha)) / 86400000) : 0;
            return dias > 30;
        });
        if (vencidos.length > 0)
            list.push({ tipo: 'warning', icon: '🟡', msg: `${vencidos.length} cliente${vencidos.length > 1 ? 's' : ''} con deuda vencida (+30 días)` });
        if (margenNeto !== null && margenNeto < 10)
            list.push({ tipo: margenNeto < 0 ? 'danger' : 'warning', icon: margenNeto < 0 ? '🔴' : '🟡', msg: `Margen neto bajo: ${margenNeto.toFixed(1)}% — revisa costos y gastos` });
        return list;
    }, [forecastKgManana, masaDisponibleKg, deficit, masaLibre, deudores, margenNeto]);

    // Deudores agrupados (mantener lógica existente)
    const groupedDebtors = deudores.reduce((acc, curr) => {
        const clientId = curr.cliente_id || curr.nombre;
        if (!acc[clientId]) acc[clientId] = { id: clientId, nombre: curr.nombre, total: 0, fecha_mas_antigua: curr.fecha || curr.fecha_vencimiento || null, items: [] };
        acc[clientId].total += curr.saldo;
        const currentFecha = curr.fecha || curr.fecha_vencimiento;
        if (currentFecha) {
            const currentD = new Date(currentFecha);
            const oldestD = acc[clientId].fecha_mas_antigua ? new Date(acc[clientId].fecha_mas_antigua) : null;
            if (!isNaN(currentD.getTime()) && (!oldestD || isNaN(oldestD.getTime()) || currentD < oldestD))
                acc[clientId].fecha_mas_antigua = currentFecha;
        }
        acc[clientId].items.push(curr);
        return acc;
    }, {});
    const debtorsList = Object.values(groupedDebtors);
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

    const safeDateFormat = (dateStr) => dateStr ? formatDate(dateStr) : 'S/F';


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
        const dateGen = formatDate(new Date());

        // Helper safety check for dates
        const sDate = start_date ? formatDate(start_date) : 'N/A';
        const eDate = end_date ? formatDate(end_date) : 'N/A';
        const rangeStr = `${sDate} - ${eDate}`;

        const printWindow = window.open('', '_blank', 'width=900,height=600');
        if (!printWindow) {
            toast.warning("Permite ventanas emergentes en tu navegador para generar el reporte");
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
                                    <td>${formatDate(o.fecha)}</td>
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
        const dateGen = formatDate(new Date());
        const sDate = start_date ? formatDate(start_date) : 'N/A';
        const eDate = end_date ? formatDate(end_date) : 'N/A';
        const rangeStr = `${sDate} - ${eDate}`;

        const printWindow = window.open('', '_blank', 'width=900,height=600');
        if (!printWindow) {
            toast.warning("Permite ventanas emergentes en tu navegador para generar el reporte");
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
                                <td>${e.fecha ? formatDate(e.fecha) : 'N/A'}</td>
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
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
                <div>
                    <h1 className="m-0">Dashboard</h1>
                    <span className="text-muted" style={{ fontSize: 12 }}>{formatDateLong(new Date())}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setReportModal({ show: true, data: null })} className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <FileText size={14} style={{ color: '#3b82f6' }} />Reporte Cliente
                    </button>
                    <button onClick={() => setVendorReportModal({ show: true, data: null })} className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <FileText size={14} style={{ color: '#ffdd19' }} />Reporte Proveedor
                    </button>
                </div>
            </header>

            {/* ── Recomendación de cocción para mañana ──────────────────────── */}
            {forecastKgManana > 0 && (() => {
                const f = forecastData?.forecast;
                const disponible = masaDisponibleKg;
                const necesita = forecastKgManana - disponible;
                const suficiente = disponible >= forecastKgManana;
                const color = suficiente ? '#10b981' : disponible >= forecastKgManana * 0.5 ? '#ffa20f' : '#ef4444';
                const bgColor = suficiente ? 'rgba(16,185,129,0.07)' : disponible >= forecastKgManana * 0.5 ? 'rgba(255,162,15,0.07)' : 'rgba(239,68,68,0.07)';
                const icon = suficiente ? '✅' : '🫓';
                return (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 16, padding: '14px 18px', borderRadius: 12, marginBottom: '1rem',
                        background: bgColor, border: `1px solid ${color}40`, flexWrap: 'wrap',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 24 }}>{icon}</span>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 2 }}>
                                    Cocción recomendada para mañana
                                    {f?.dia_manana && <span style={{ marginLeft: 8, color, background: `${color}20`, padding: '1px 8px', borderRadius: 5, fontSize: 11 }}>{f.dia_manana}</span>}
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1 }}>
                                    {suficiente
                                        ? `Tienes suficiente masa (${disponible.toFixed(1)} kg disponibles)`
                                        : `Cocinar ${necesita.toFixed(1)} kg más`}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                                    {f?.muestras_dow > 0
                                        ? `Basado en ${f.muestras_dow} ${f.dia_manana}s históricos · Necesidad estimada: ${forecastKgManana.toFixed(1)} kg · Disponible: ${disponible.toFixed(1)} kg`
                                        : `Necesidad estimada: ${forecastKgManana.toFixed(1)} kg · Disponible: ${disponible.toFixed(1)} kg`}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Meta</div>
                            <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{forecastKgManana.toFixed(1)} kg</div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Panel de Alertas ──────────────────────────────────────────── */}
            {alertas.length > 0 && (
                <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {alertas.map((a, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            borderRadius: 10, fontSize: 13, fontWeight: 600,
                            background: a.tipo === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(255,221,25,0.1)',
                            border: `1px solid ${a.tipo === 'danger' ? 'rgba(239,68,68,0.3)' : 'rgba(255,221,25,0.3)'}`,
                            color: a.tipo === 'danger' ? '#f87171' : '#ffa20f',
                        }}>
                            <span style={{ fontSize: 16 }}>{a.icon}</span>
                            {a.msg}
                        </div>
                    ))}
                </div>
            )}

            {/* ── KPIs Financieros ──────────────────────────────────────────── */}
            {(() => {
                const balMes = ventasMes - gastosMes;
                const kpis = [
                    { label: 'Ventas del mes', val: ventasMes, color: '#22c55e', sub: `Hoy: ${FMT_COP(ventasHoy)}`, icon: <TrendingUp size={15} /> },
                    { label: 'Gastos del mes', val: gastosMes, color: '#ef4444', sub: `Hoy: ${FMT_COP(gastosHoy)}`, icon: <TrendingDown size={15} /> },
                    { label: 'Balance mes', val: balMes, color: balMes >= 0 ? '#22c55e' : '#ef4444', sub: balMes >= 0 ? 'Ganancia' : 'Déficit', icon: <DollarSign size={15} /> },
                    { label: 'Por cobrar', val: totalDeuda, color: totalDeuda > 0 ? '#ffdd19' : '#22c55e', sub: `${debtorsList.length} cliente${debtorsList.length !== 1 ? 's' : ''}`, icon: <CreditCard size={15} /> },
                    { label: 'Caja total', val: totalCaja, color: totalCaja >= 0 ? '#22c55e' : '#ef4444', sub: `${(stats?.flujo_caja || []).length} medio${(stats?.flujo_caja || []).length !== 1 ? 's' : ''}`, icon: <DollarSign size={15} /> },
                    ...(margenContable !== null ? [{
                        label: 'Margen contable',
                        val: null,
                        pct: margenContable,
                        color: margenContable >= 20 ? '#22c55e' : margenContable >= 10 ? '#ffdd19' : '#ef4444',
                        sub: `Caja: ${margenCaja !== null ? margenCaja.toFixed(1) + '%' : '—'} · 30d`,
                        icon: <TrendingUp size={15} />,
                    }] : []),
                ];
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        {kpis.map(({ label, val, pct, color, sub, icon }) => (
                            <div key={label} className="card" style={{ marginBottom: 0, padding: '12px 14px', borderTop: `3px solid ${color}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color }}>
                                    {icon}
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{label}</span>
                                </div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1.1 }}>
                                    {pct !== undefined ? `${pct.toFixed(1)}%` : FMT_COP(val)}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            {/* ── Producción + Forecast ─────────────────────────────────────── */}
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10, marginTop: 4 }}>Producción</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {/* Masa disponible */}
                <div className="card" style={{ marginBottom: 0, borderTop: `3px solid ${masaRestante > 0 ? '#a78bfa' : '#ef4444'}`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <FlaskConical size={13} style={{ color: '#a78bfa' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Masa disponible</span>
                    </div>
                    {prodLoading ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cargando…</div> : <>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1, marginBottom: 3 }}>{FMT_KG(masaRestante)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            stock del insumo Masa
                        </div>
                    </>}
                </div>

                {/* Pedidos pendientes */}
                <div className="card" style={{ marginBottom: 0, borderTop: `3px solid #ffdd19`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <ShoppingBag size={13} style={{ color: '#ffdd19' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Pedidos pendientes</span>
                    </div>
                    {prodLoading ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cargando…</div> : <>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1, marginBottom: 3 }}>{pedidosPendientes.length}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {FMT_KG(masaComprometida)} necesarias
                            {deficit && <span style={{ color: '#ef4444', fontWeight: 700 }}> · déficit {FMT_KG(Math.abs(masaLibre))}</span>}
                        </div>
                    </>}
                </div>

                {/* Forecast mañana */}
                <div className="card" style={{ marginBottom: 0, borderTop: `3px solid #3b82f6`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Clock size={13} style={{ color: '#3b82f6' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Preparar mañana</span>
                    </div>
                    {!forecastData ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cargando…</div> : <>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1, marginBottom: 3, color: '#3b82f6' }}>{FMT_KG(forecastKgManana)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            prom. 7d: {FMT_KG(forecastData.promedios?.avg_7d || 0)}
                            {forecastData.forecast?.tendencia_tipo !== 'estable' && (
                                <span style={{ color: forecastData.forecast?.tendencia_tipo === 'crecimiento' ? '#22c55e' : '#f87171', marginLeft: 4 }}>
                                    {forecastData.forecast?.tendencia_tipo === 'crecimiento' ? '↑' : '↓'}{Math.abs(forecastData.forecast?.tendencia_pct || 0).toFixed(1)}%
                                </span>
                            )}
                        </div>
                    </>}
                </div>

                {/* Hoy en cocciones */}
                <div className="card" style={{ marginBottom: 0, borderTop: `3px solid #10b981`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <CheckCircle size={13} style={{ color: '#10b981' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Cocciones hoy</span>
                    </div>
                    {prodLoading ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cargando…</div> : <>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1, marginBottom: 3, color: '#10b981' }}>{coccionesHoy}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {coccionesHoy > 0 ? `${FMT_KG(masaCocinadaHoy)} cocinadas hoy` : 'Sin cocciones registradas'}
                        </div>
                    </>}
                </div>
            </div>


            {/* ── Flujo de Caja ─────────────────────────────────────────── */}
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Flujo de Caja</h2>
            {stats?.flujo_caja && stats.flujo_caja.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {stats.flujo_caja.map((item) => {
                        const pos = item.saldo >= 0;
                        const color = pos ? '#22c55e' : '#ef4444';
                        return (
                            <div key={item.id} className="card" style={{ marginBottom: 0, borderTop: `3px solid ${color}`, padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: pos ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <CreditCard size={13} style={{ color }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{item.tipo || 'efectivo'}</div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.medio}</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1, marginBottom: 6, color }}>{FMT_COP(item.saldo)}</div>
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                    <div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 1, fontWeight: 600, textTransform: 'uppercase' }}>Ingresos</div>
                                        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#22c55e' }}>+{FMT_COP(item.ingresos)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 1, fontWeight: 600, textTransform: 'uppercase' }}>Egresos</div>
                                        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ef4444' }}>-{FMT_COP(item.egresos)}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {stats.flujo_caja.length > 1 && (() => {
                        const totalIng  = stats.flujo_caja.reduce((s, i) => s + i.ingresos, 0);
                        const totalEgr  = stats.flujo_caja.reduce((s, i) => s + i.egresos, 0);
                        const totalSaldo = totalIng - totalEgr;
                        const pos = totalSaldo >= 0;
                        return (
                            <div className="card" style={{ marginBottom: 0, borderTop: '3px solid #8b5cf6', padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <DollarSign size={13} style={{ color: '#8b5cf6' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Consolidado</div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Total Caja</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1, marginBottom: 6, color: pos ? '#22c55e' : '#ef4444' }}>{FMT_COP(totalSaldo)}</div>
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                    <div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 1, fontWeight: 600, textTransform: 'uppercase' }}>Ingresos</div>
                                        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#22c55e' }}>+{FMT_COP(totalIng)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 1, fontWeight: 600, textTransform: 'uppercase' }}>Egresos</div>
                                        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ef4444' }}>-{FMT_COP(totalEgr)}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            ) : (
                <div className="card mb-4" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No hay medios de pago configurados.
                </div>
            )}



            {/* ── Modal Pagar (monto completo) ───────────────────────────── */}
            {pagarModal.show && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 400, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
                        <button onClick={() => setPagarModal({ show: false, clientId: null, clientName: '', totalDebt: 0 })} className="btn-close-modal"><X size={18} /></button>

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#22c55e', flexShrink: 0 }}>
                                {pagarModal.clientName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Registrar pago</div>
                                <div style={{ fontSize: 16, fontWeight: 800 }}>{pagarModal.clientName}</div>
                            </div>
                        </div>

                        {/* Monto total */}
                        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Monto a pagar</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{formatCurrency(pagarModal.totalDebt)}</div>
                            </div>
                            <DollarSign size={28} style={{ color: '#22c55e', opacity: 0.4 }} />
                        </div>

                        <form onSubmit={handlePagarCompleto}>
                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>Medio de pago</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                                    {paymentMethods.filter(m => m.activo !== false).map(m => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setPagarMethodId(String(m.id))}
                                            style={{
                                                padding: '10px 8px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                                                cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                                                background: pagarMethodId === String(m.id) ? 'rgba(34,197,94,0.15)' : 'var(--bg-secondary)',
                                                border: pagarMethodId === String(m.id) ? '2px solid #22c55e' : '2px solid var(--border)',
                                                color: pagarMethodId === String(m.id) ? '#22c55e' : 'var(--text-secondary)',
                                            }}
                                        >
                                            {m.nombre}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!pagarMethodId}
                                style={{
                                    width: '100%', padding: '13px', fontSize: 15, fontWeight: 800, borderRadius: 10,
                                    background: pagarMethodId ? '#22c55e' : 'var(--bg-secondary)',
                                    color: pagarMethodId ? '#000' : 'var(--text-muted)',
                                    border: 'none', cursor: pagarMethodId ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    transition: 'all 0.2s',
                                }}
                            >
                                <DollarSign size={18} /> Confirmar pago {pagarMethodId ? `· ${formatCurrency(pagarModal.totalDebt)}` : ''}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {paymentModal.show && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 400, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
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
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 650, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
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
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 650, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
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

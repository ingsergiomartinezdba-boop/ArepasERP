import { useState, useEffect, useMemo } from 'react';
import { expensesService, suppliersService, paymentMethodsService, insumosService } from '../services/api';
import { todayBogota, formatDate } from '../utils/formatters';
import DateInput from '../components/DateInput';
import {
    Plus, Trash2, Edit, TrendingDown, TrendingUp, ShoppingBag, X, Save, Package, Tag, Ban, RotateCcw,
    Settings, CreditCard, FolderTree, Calendar, AlertTriangle, Activity, Receipt, Search,
    FileSpreadsheet, FileText as FileIcon, Printer, Paperclip, Upload, Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell,
} from 'recharts';

const fmtCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

const fmtDate = (d) => d ? formatDate(d) : '—';

const EMPTY_FORM = {
    tipo_gasto: 'general',        // 'general' | 'insumo'
    valor: '', fecha: todayBogota(), proveedor_id: '', medio_pago_id: '', categoria_id: '',
    subcategoria_id: '',
    insumo_id: '',
    cantidad_bultos: '',           // cuántos bultos/unidades compró
    peso_por_unidad: '',           // kg por bulto
};

export default function Expenses() {
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [insumos, setInsumos] = useState([]);
    const [categoriasGasto, setCategoriasGasto] = useState([]);   // catálogo con subcats embebidas
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(todayBogota().slice(0, 7));
    const [trendData, setTrendData] = useState([]);   // tendencia últimos 6 meses
    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [filtroSubcategoria, setFiltroSubcategoria] = useState('');
    const [filtroProveedor, setFiltroProveedor] = useState('');
    const [filtroEstadoGasto, setFiltroEstadoGasto] = useState('');
    const [filtroTextoGasto, setFiltroTextoGasto] = useState('');

    // Modal edición / nuevo
    const [modal, setModal] = useState({ open: false, id: null });
    const [form, setForm] = useState(EMPTY_FORM);

    // Modal pago rápido
    const [payModal, setPayModal] = useState({ show: false, expense: null, methodId: '' });

    // Modal abonos
    const [abonoModal, setAbonoModal] = useState(null); // expense object | null
    const [abonos, setAbonos] = useState([]);
    const [abonoForm, setAbonoForm] = useState({ monto: '', fecha: todayBogota(), medio_pago_id: '', notas: '' });
    const [abonoLoading, setAbonoLoading] = useState(false);

    // Modal adjuntos
    const [adjModal, setAdjModal] = useState(null);     // expense object | null
    const [adjuntos, setAdjuntos] = useState([]);
    const [adjUploading, setAdjUploading] = useState(false);

    useEffect(() => {
        suppliersService.getAll().then(r => setSuppliers(r.data)).catch(() => {});
        paymentMethodsService.getAll().then(r => setPaymentMethods(r.data)).catch(() => {});
        insumosService.getAll(true).then(r => setInsumos(r.data)).catch(() => {});
        expensesService.getCategorias().then(r => setCategoriasGasto(r.data)).catch(() => {});
    }, []);

    useEffect(() => { loadExpenses(); loadTrend(); }, [month]);

    const loadExpenses = async () => {
        setLoading(true);
        try {
            const [y, m] = month.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            const res = await expensesService.getAll({ start_date: `${month}-01`, end_date: `${month}-${lastDay}`, limit: 500 });
            setExpenses(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    /* ── Tendencia: últimos 6 meses (incluyendo el actual) ── */
    const loadTrend = async () => {
        try {
            const [y, m] = month.split('-').map(Number);
            const out = [];
            // Cargar 6 meses hacia atrás (incluyendo el actual)
            for (let i = 5; i >= 0; i--) {
                const d = new Date(y, m - 1 - i, 1);
                const yy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, '0');
                const last = new Date(yy, d.getMonth() + 1, 0).getDate();
                const res = await expensesService.getAll({ start_date: `${yy}-${mm}-01`, end_date: `${yy}-${mm}-${String(last).padStart(2,'0')}`, limit: 500 });
                const total = res.data
                    .filter(e => e.estado !== 'anulado')
                    .reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
                out.push({ mes: `${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]}`, year: yy, total: Math.round(total) });
            }
            setTrendData(out);
        } catch { /* silencioso — la tendencia es ornamental */ }
    };

    /* ── Presets de período ── */
    const setMonthOffset = (offset) => {
        const [y, m] = todayBogota().slice(0, 7).split('-').map(Number);
        const d = new Date(y, m - 1 + offset, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    /* ── CRUD ── */
    const openNew = () => { setForm(EMPTY_FORM); setModal({ open: true, id: null }); };

    const openEdit = (e) => {
        // Si tenía insumo, reconstruir bultos/peso desde cantidad_insumo
        setForm({
            tipo_gasto: e.insumo_id ? 'insumo' : 'general',
            valor: e.valor || '',
            fecha: e.fecha ? String(e.fecha).split('T')[0] : todayBogota(),
            proveedor_id: e.proveedor_id || '',
            medio_pago_id: e.medio_pago_id || '',
            categoria_id: e.categoria_id || '',
            subcategoria_id: e.subcategoria_id || '',
            insumo_id: e.insumo_id || '',
            cantidad_bultos: e.insumo_id ? (e.cantidad_insumo || '') : '',
            peso_por_unidad: '',
        });
        setModal({ open: true, id: e.id });
    };

    const handleSave = async (ev) => {
        ev.preventDefault();
        const esInsumo = form.tipo_gasto === 'insumo';
        if (esInsumo && !form.insumo_id) return toast.error('Selecciona un insumo');
        const bultos = parseFloat(form.cantidad_bultos);
        const peso   = parseFloat(form.peso_por_unidad);
        if (esInsumo && !(bultos > 0)) return toast.error('Ingresa la cantidad de bultos');

        // Si ingresaron peso por unidad → total = bultos × peso; si no, total = bultos
        const totalInsumo = esInsumo ? (peso > 0 ? bultos * peso : bultos) : null;

        const payload = {
            valor: parseFloat(form.valor),
            fecha: form.fecha,
            proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id) : null,
            medio_pago_id: form.medio_pago_id ? parseInt(form.medio_pago_id) : null,
            categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
            subcategoria_id: form.subcategoria_id ? parseInt(form.subcategoria_id) : null,
            insumo_id: esInsumo && form.insumo_id ? parseInt(form.insumo_id) : null,
            cantidad_insumo: totalInsumo,
        };
        try {
            if (modal.id) {
                await expensesService.update(modal.id, payload);
                toast.success("Gasto actualizado");
            } else {
                await expensesService.create(payload);
                toast.success("Gasto registrado");
            }
            setModal({ open: false, id: null });
            loadExpenses();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Error al guardar");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este gasto?')) return;
        try {
            await expensesService.delete(id);
            toast.success("Gasto eliminado");
            loadExpenses();
        } catch (err) {
            const msg = err.response?.data?.detail || "Error al eliminar";
            toast.error(msg, { duration: 6000 });
        }
    };

    const handleAnular = async (expense) => {
        const accion = expense.estado === 'anulado' ? 'reactivar' : 'anular';
        const msg = accion === 'anular'
            ? `¿Anular este gasto?${expense.insumo_id ? ' El stock del insumo se devolverá.' : ''}`
            : '¿Reactivar este gasto?';
        if (!confirm(msg)) return;
        try {
            if (accion === 'anular') {
                await expensesService.anular(expense.id);
                toast.success('Gasto anulado');
            } else {
                await expensesService.reactivar(expense.id);
                toast.success('Gasto reactivado');
            }
            loadExpenses();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al cambiar estado');
        }
    };

    /* ── Pago rápido ── */
    const handleConfirmPay = async (ev) => {
        ev.preventDefault();
        if (!payModal.methodId) return toast.warning("Selecciona un medio de pago");
        try {
            const e = payModal.expense;
            await expensesService.update(e.id, {
                valor: parseFloat(e.valor),
                fecha: String(e.fecha).split('T')[0],
                proveedor_id: e.proveedor_id || null,
                categoria_id: e.categoria_id || null,
                medio_pago_id: parseInt(payModal.methodId),
            });
            setPayModal({ show: false, expense: null, methodId: '' });
            loadExpenses();
        } catch { toast.error("Error al registrar pago"); }
    };

    const handleUnpay = async (e) => {
        if (!confirm('¿Marcar como pendiente?')) return;
        try {
            await expensesService.update(e.id, {
                valor: parseFloat(e.valor),
                fecha: String(e.fecha).split('T')[0],
                proveedor_id: e.proveedor_id || null,
                categoria_id: e.categoria_id || null,
                medio_pago_id: null,
            });
            loadExpenses();
        } catch { toast.error("Error al revertir"); }
    };

    const openAbonoModal = async (expense) => {
        setAbonoModal(expense);
        setAbonoForm({ monto: '', fecha: todayBogota(), medio_pago_id: '', notas: '' });
        try {
            const res = await expensesService.getAbonos(expense.id);
            setAbonos(res.data);
        } catch { setAbonos([]); }
    };

    const handleCrearAbono = async (e) => {
        e.preventDefault();
        if (!abonoForm.monto || parseFloat(abonoForm.monto) <= 0) return toast.error('Ingresa un monto válido');
        setAbonoLoading(true);
        try {
            await expensesService.crearAbono(abonoModal.id, {
                monto: parseFloat(abonoForm.monto),
                fecha: abonoForm.fecha,
                medio_pago_id: abonoForm.medio_pago_id ? parseInt(abonoForm.medio_pago_id) : null,
                notas: abonoForm.notas || null,
            });
            toast.success('Abono registrado');
            const [abonosRes] = await Promise.all([
                expensesService.getAbonos(abonoModal.id),
                loadExpenses(),
            ]);
            setAbonos(abonosRes.data);
            // Refresh abonoModal con el expense actualizado
            setAbonoForm({ monto: '', fecha: todayBogota(), medio_pago_id: '', notas: '' });
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al registrar abono');
        } finally { setAbonoLoading(false); }
    };

    const handleEliminarAbono = async (abonoId) => {
        if (!confirm('¿Eliminar este abono?')) return;
        try {
            await expensesService.eliminarAbono(abonoModal.id, abonoId);
            toast.success('Abono eliminado');
            const [abonosRes] = await Promise.all([expensesService.getAbonos(abonoModal.id), loadExpenses()]);
            setAbonos(abonosRes.data);
        } catch { toast.error('Error al eliminar'); }
    };

    /* ── Adjuntos ── */
    const openAdjModal = async (expense) => {
        setAdjModal(expense);
        try {
            const r = await expensesService.getAdjuntos(expense.id);
            setAdjuntos(r.data);
        } catch { setAdjuntos([]); }
    };

    const handleUploadAdjunto = async (file, notas) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) return toast.error('El archivo supera 10MB');
        setAdjUploading(true);
        try {
            await expensesService.uploadAdjunto(adjModal.id, file, notas);
            toast.success('Adjunto subido');
            const r = await expensesService.getAdjuntos(adjModal.id);
            setAdjuntos(r.data);
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al subir');
        } finally { setAdjUploading(false); }
    };

    const handleDeleteAdjunto = async (adjId) => {
        if (!confirm('¿Eliminar este adjunto?')) return;
        try {
            await expensesService.eliminarAdjunto(adjModal.id, adjId);
            toast.success('Adjunto eliminado');
            const r = await expensesService.getAdjuntos(adjModal.id);
            setAdjuntos(r.data);
        } catch { toast.error('Error al eliminar'); }
    };

    const handleDownloadAdjunto = async (adj) => {
        try {
            const res = await expensesService.downloadAdjunto(adjModal.id, adj.id);
            const blob = new Blob([res.data], { type: adj.mime_type || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = adj.nombre_archivo;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        } catch { toast.error('Error al descargar'); }
    };

    const expensesActivos = expenses.filter(e => e.estado !== 'anulado');
    const totalMonth     = expensesActivos.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
    const totalPagado    = expensesActivos.reduce((s, e) => s + (parseFloat(e.monto_pagado) || 0), 0);
    const totalPendiente = expensesActivos.reduce((s, e) => s + (parseFloat(e.saldo_pendiente) || 0), 0);

    /* ── KPIs avanzados ── */
    const kpis = useMemo(() => {
        const hoy = todayBogota();
        const [yy, mm] = month.split('-').map(Number);
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === yy && (today.getMonth() + 1) === mm;
        const lastDay = new Date(yy, mm, 0).getDate();
        const diasMes = isCurrentMonth ? today.getDate() : lastDay;

        // Gasto de hoy (solo si el mes seleccionado es el actual)
        const totalHoy = isCurrentMonth
            ? expensesActivos.filter(e => String(e.fecha).slice(0,10) === hoy).reduce((s,e)=>s+parseFloat(e.valor||0),0)
            : 0;

        // Última semana (lunes-domingo de la semana actual)
        let totalSemana = 0;
        if (isCurrentMonth) {
            const d = new Date(today);
            const day = (d.getDay() + 6) % 7;            // lunes=0
            const lunes = new Date(d); lunes.setDate(d.getDate() - day); lunes.setHours(0,0,0,0);
            totalSemana = expensesActivos
                .filter(e => { const f = new Date(String(e.fecha).slice(0,10) + 'T12:00:00'); return f >= lunes && f <= today; })
                .reduce((s,e)=>s+parseFloat(e.valor||0),0);
        }

        const promedioDia = diasMes > 0 ? totalMonth / diasMes : 0;

        // Costos directos vs indirectos (basado en tipo_costo del gasto)
        const directos   = expensesActivos.filter(e => e.tipo_costo === 'directo').reduce((s,e)=>s+parseFloat(e.valor||0),0);
        const indirectos = expensesActivos.filter(e => e.tipo_costo === 'indirecto').reduce((s,e)=>s+parseFloat(e.valor||0),0);
        const sinClasificar = expensesActivos.filter(e => !e.tipo_costo).reduce((s,e)=>s+parseFloat(e.valor||0),0);

        // Comparativo: variación vs mes anterior (de la tendencia)
        let variacion = 0;
        if (trendData.length >= 2) {
            const actual = trendData[trendData.length - 1]?.total || 0;
            const prev   = trendData[trendData.length - 2]?.total || 0;
            if (prev > 0) variacion = ((actual - prev) / prev) * 100;
        }

        return {
            totalHoy, totalSemana, promedioDia, directos, indirectos, sinClasificar,
            variacion, isCurrentMonth,
            registros: expensesActivos.length,
        };
    }, [expensesActivos, totalMonth, month, trendData]);

    /* ── Datos para gráfica por categoría ── */
    const CHART_COLORS = [
        '#8b5cf6','#06b6d4','#ffdd19','#10b981','#ef4444',
        '#3b82f6','#ec4899','#84cc16','#f97316','#6366f1',
    ];
    const chartData = (() => {
        const map = {};
        expensesActivos.forEach(e => {
            const cat = e.categoria_nombre || 'Sin categoría';
            map[cat] = (map[cat] || 0) + parseFloat(e.valor || 0);
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value);
    })();

    /* ── método de pago label ── */
    const metodoPagoNombre = (id) => paymentMethods.find(m => m.id === id)?.nombre || '—';

    /* ── Color badge por categoría (estable entre renders) ── */
    const CATEGORIA_PALETA = [
        { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
        { bg: 'rgba(6,182,212,0.15)',  text: '#22d3ee' },
        { bg: 'rgba(255,221,25,0.15)', text: '#ffa20f' },
        { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
        { bg: 'rgba(239,68,68,0.15)',  text: '#f87171' },
        { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
        { bg: 'rgba(236,72,153,0.15)', text: '#f472b6' },
        { bg: 'rgba(132,204,22,0.15)', text: '#a3e635' },
    ];
    const catColorMap = useMemo(() => {
        const cats = [...new Set(expenses.map(e => e.categoria_nombre).filter(Boolean))];
        return Object.fromEntries(cats.map((c, i) => [c, CATEGORIA_PALETA[i % CATEGORIA_PALETA.length]]));
    }, [expenses]);

    const expensesFiltrados = useMemo(() => {
        return expenses.filter(e => {
            if (filtroEstadoGasto === 'activo' && e.estado === 'anulado') return false;
            if (filtroEstadoGasto === 'anulado' && e.estado !== 'anulado') return false;
            if (filtroCategoria && e.categoria_nombre !== filtroCategoria) return false;
            if (filtroSubcategoria && e.subcategoria_nombre !== filtroSubcategoria) return false;
            if (filtroProveedor && String(e.proveedor_id) !== filtroProveedor) return false;
            if (filtroTextoGasto) {
                const t = filtroTextoGasto.toLowerCase();
                if (!(e.proveedor_nombre || '').toLowerCase().includes(t)
                    && !(e.categoria_nombre || '').toLowerCase().includes(t)
                    && !(e.subcategoria_nombre || '').toLowerCase().includes(t)) return false;
            }
            return true;
        });
    }, [expenses, filtroEstadoGasto, filtroCategoria, filtroSubcategoria, filtroProveedor, filtroTextoGasto]);

    const CATEGORIA_COLOR_BG   = (cat) => catColorMap[cat]?.bg   || 'rgba(100,100,100,0.15)';
    const CATEGORIA_COLOR_TEXT = (cat) => catColorMap[cat]?.text || '#9ca3af';

    return (
        <div>
            {/* ─── HEADER moderno con presets de período ─── */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h1 className="m-0">Gastos</h1>
                    <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
                        Egresos del mes · {kpis.registros} {kpis.registros === 1 ? 'registro' : 'registros'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Presets de período */}
                    <div style={{ display: 'flex', gap: 0, background: 'var(--bg-card)', borderRadius: 8,
                        border: '1px solid var(--border-default)', overflow: 'hidden' }}>
                        {[
                            { label: 'Mes actual', offset: 0 },
                            { label: 'Anterior',   offset: -1 },
                        ].map(p => (
                            <button key={p.label} onClick={() => setMonthOffset(p.offset)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                                    padding: '6px 12px', fontSize: 12, fontWeight: 600,
                                    color: 'var(--text-secondary)', borderRight: '1px solid var(--border-default)' }}>
                                {p.label}
                            </button>
                        ))}
                        <select style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                            padding: '6px 8px', outline: 'none' }}
                            value={month.split('-')[1]}
                            onChange={e => setMonth(`${month.split('-')[0]}-${e.target.value}`)}>
                            {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) =>
                                <option key={m} value={m}>{['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i]}</option>)}
                        </select>
                        <select style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                            padding: '6px 8px', outline: 'none', borderLeft: '1px solid var(--border-default)' }}
                            value={month.split('-')[0]}
                            onChange={e => setMonth(`${e.target.value}-${month.split('-')[1]}`)}>
                            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button onClick={() => navigate('/admin/parametros')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                            background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                            borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            color: 'var(--text-secondary)' }}
                        title="Administrar categorías/subcategorías en Parámetros">
                        <FolderTree size={13} /> Categorías
                    </button>
                    <button onClick={() => navigate('/expenses/dashboard')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                            background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                            borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            color: 'var(--text-secondary)' }}
                        title="Dashboard analítico ampliado">
                        <Activity size={13} /> Dashboard
                    </button>
                    <ExportMenu month={month} filters={{
                        categoria_id: undefined,    // placeholder — el endpoint acepta filtros
                    }} />
                    <button onClick={() => navigate('/expenses/new')}
                        className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus size={14} /> Nuevo gasto
                    </button>
                </div>
            </div>

            {/* ─── KPIs widgets ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
                <KpiCard
                    label="Total del mes"
                    value={fmtCurrency(totalMonth)}
                    icon={<TrendingDown size={14} />}
                    color="var(--danger)"
                    sub={kpis.variacion !== 0 ? (
                        <span style={{ color: kpis.variacion > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                            {kpis.variacion > 0 ? '↑' : '↓'} {Math.abs(kpis.variacion).toFixed(1)}% vs mes anterior
                        </span>
                    ) : 'Histórico'}
                />
                <KpiCard
                    label="Pagados"
                    value={fmtCurrency(totalPagado)}
                    icon={<Receipt size={14} />}
                    color="var(--success)"
                    sub={totalMonth > 0 ? `${Math.round(totalPagado / totalMonth * 100)}% del total` : '—'}
                />
                <KpiCard
                    label="Pendientes"
                    value={fmtCurrency(totalPendiente)}
                    icon={<AlertTriangle size={14} />}
                    color="var(--warning)"
                    sub={totalPendiente > 0 ? `Saldo por pagar` : '✓ Sin deudas'}
                />
                {kpis.isCurrentMonth && (
                    <KpiCard
                        label="Hoy"
                        value={fmtCurrency(kpis.totalHoy)}
                        icon={<Calendar size={14} />}
                        color="#06b6d4"
                        sub={`Promedio diario: ${fmtCurrency(kpis.promedioDia)}`}
                    />
                )}
                {kpis.isCurrentMonth && (
                    <KpiCard
                        label="Esta semana"
                        value={fmtCurrency(kpis.totalSemana)}
                        icon={<Activity size={14} />}
                        color="#8b5cf6"
                        sub={`Lun a hoy`}
                    />
                )}
                {(kpis.directos > 0 || kpis.indirectos > 0) && (
                    <KpiCard
                        label="Directos / Indirectos"
                        value={`${Math.round((kpis.directos / Math.max(kpis.directos + kpis.indirectos, 1)) * 100)}% / ${Math.round((kpis.indirectos / Math.max(kpis.directos + kpis.indirectos, 1)) * 100)}%`}
                        icon={<Tag size={14} />}
                        color="#a78bfa"
                        sub={`${fmtCurrency(kpis.directos)} / ${fmtCurrency(kpis.indirectos)}`}
                    />
                )}
            </div>

            {/* ─── Charts row: categorías + tendencia ─── */}
            {!loading && (chartData.length > 0 || trendData.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12, marginBottom: 18 }}>
                    {chartData.length > 0 && (
                        <div className="card" style={{ padding: '1.1rem 1.25rem', marginBottom: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Gasto por categoría</h3>
                                    <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                                        {chartData.length} categoría{chartData.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Mayor</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: CHART_COLORS[0] }}>{chartData[0]?.name}</div>
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={210}>
                                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }} barCategoryGap="30%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} interval={0} />
                                    <YAxis tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                                        tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={50} />
                                    <Tooltip formatter={v => [fmtCurrency(v), 'Total']}
                                        contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                                        cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                                        {chartData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {trendData.length > 0 && (
                        <div className="card" style={{ padding: '1.1rem 1.25rem', marginBottom: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Tendencia 6 meses</h3>
                                    <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                                        Evolución del gasto mensual
                                    </p>
                                </div>
                                {kpis.variacion !== 0 && (
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>vs mes anterior</div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 700,
                                            color: kpis.variacion > 0 ? 'var(--danger)' : 'var(--success)',
                                            display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                            {kpis.variacion > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                            {Math.abs(kpis.variacion).toFixed(1)}%
                                        </div>
                                    </div>
                                )}
                            </div>
                            <ResponsiveContainer width="100%" height={210}>
                                <LineChart data={trendData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                                        tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={50} />
                                    <Tooltip formatter={v => [fmtCurrency(v), 'Gasto']}
                                        labelFormatter={(_, items) => items[0] ? `${items[0].payload.mes} ${items[0].payload.year}` : ''}
                                        contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                    <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2.5}
                                        dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* Tabla */}
            <div className="card overflow-x-auto">
                {/* Filtros */}
                <div className="filter-bar" style={{ borderRadius: 0, border: 'none',
                    borderBottom: '1px solid var(--border)', background: 'rgba(255,221,25,0.03)', marginBottom: 0 }}>
                    <div className="filter-bar__search">
                        <Search size={14} />
                        <input type="text" placeholder="Buscar proveedor, categoría o subcategoría…"
                            value={filtroTextoGasto} onChange={e => setFiltroTextoGasto(e.target.value)} />
                    </div>
                    {[
                        { value: filtroCategoria, set: (v) => { setFiltroCategoria(v); setFiltroSubcategoria(''); }, placeholder: 'Categoría', options: [...new Set(expenses.map(e => e.categoria_nombre).filter(Boolean))].map(c => [c, c]) },
                        { value: filtroSubcategoria, set: setFiltroSubcategoria,
                          placeholder: filtroCategoria ? 'Subcategoría' : 'Subcategoría (selecciona categoría)',
                          disabled: !filtroCategoria,
                          options: !filtroCategoria ? [] : [...new Set(expenses
                            .filter(e => e.categoria_nombre === filtroCategoria)
                            .map(e => e.subcategoria_nombre).filter(Boolean))].map(s => [s, s]) },
                        { value: filtroProveedor, set: setFiltroProveedor, placeholder: 'Proveedor', options: suppliers.map(s => [String(s.id), s.nombre]) },
                        { value: filtroEstadoGasto, set: setFiltroEstadoGasto, placeholder: 'Estado', options: [['activo','Activos'],['anulado','Anulados']] },
                    ].map(({ value, set, placeholder, options, disabled }) => (
                        <select key={placeholder} value={value} onChange={e => set(e.target.value)}
                            disabled={disabled}
                            className={`filter-bar__select${value ? ' filter-bar__select--active' : ''}`}
                            style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
                            <option value="">{placeholder}</option>
                            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    ))}
                    <div className="filter-bar__actions">
                        <span className={`filter-bar__count${expensesFiltrados.length < expenses.length ? ' filter-bar__count--active' : ''}`}>
                            {expensesFiltrados.length} / {expenses.length}
                        </span>
                        {(filtroCategoria || filtroSubcategoria || filtroProveedor || filtroEstadoGasto || filtroTextoGasto) && (
                            <button onClick={() => { setFiltroCategoria(''); setFiltroSubcategoria(''); setFiltroProveedor(''); setFiltroEstadoGasto(''); setFiltroTextoGasto(''); }} style={{
                                padding: '5px 12px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.35)',
                                background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 12,
                                fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                            }}>✕ Limpiar</button>
                        )}
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Proveedor / Categoría</th>
                            <th className="p-3">Estado pago</th>
                            <th className="p-3 text-right">Total</th>
                            <th className="p-3 text-right">Pagado</th>
                            <th className="p-3 text-right">Saldo</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" className="p-4 text-center">Cargando...</td></tr>
                        ) : expensesFiltrados.length === 0 ? (
                            <tr><td colSpan="7" className="p-4 text-center text-muted">No hay gastos en este mes.</td></tr>
                        ) : expensesFiltrados.map(expense => {
                            const ep = expense.estado_pago || 'pendiente';
                            const EP_CFG = {
                                pagado:   { label: 'Pagado',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
                                parcial:  { label: 'Parcial',  color: '#ffa20f', bg: 'rgba(255,162,15,0.12)' },
                                pendiente:{ label: 'Pendiente',color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
                            };
                            const cfg = EP_CFG[ep] || EP_CFG.pendiente;
                            return (
                            <tr key={expense.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: expense.estado === 'anulado' ? 0.5 : 1 }}>
                                <td className="p-3 text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(expense.fecha)}</td>
                                <td className="p-3">
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                        {expense.proveedor_nombre || <span style={{ opacity: 0.35 }}>Sin proveedor</span>}
                                    </div>
                                    {expense.categoria_nombre && (
                                        <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: 999,
                                                background: CATEGORIA_COLOR_BG(expense.categoria_nombre),
                                                color: CATEGORIA_COLOR_TEXT(expense.categoria_nombre), fontWeight: 600,
                                            }}><Tag size={9} /> {expense.categoria_nombre}</span>
                                            {expense.subcategoria_nombre && (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center',
                                                    fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 999,
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: 'var(--text-tertiary)', fontWeight: 500,
                                                }}>· {expense.subcategoria_nombre}</span>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="p-3">
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', padding: '0.2rem 0.65rem', borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}55` }}>
                                        {cfg.label}
                                    </span>
                                </td>
                                <td className="p-3 text-right font-bold" style={{ color: expense.estado === 'anulado' ? 'var(--text-muted)' : 'var(--danger)', textDecoration: expense.estado === 'anulado' ? 'line-through' : 'none' }}>
                                    {fmtCurrency(expense.valor)}
                                </td>
                                <td className="p-3 text-right" style={{ color: '#10b981', fontWeight: 600 }}>
                                    {expense.monto_pagado > 0 ? fmtCurrency(expense.monto_pagado) : <span style={{ opacity: 0.3 }}>—</span>}
                                </td>
                                <td className="p-3 text-right" style={{ fontWeight: 700, color: expense.saldo_pendiente > 0 ? '#f59e0b' : '#10b981' }}>
                                    {expense.saldo_pendiente > 0 ? fmtCurrency(expense.saldo_pendiente) : '✓'}
                                </td>
                                <td className="p-3">
                                    <div className="flex justify-center gap-1">
                                        {expense.estado !== 'anulado' && (
                                            <button onClick={() => openAbonoModal(expense)}
                                                style={{ padding: '0.35rem 0.6rem', borderRadius: 7, border: '1px solid rgba(255,162,15,0.4)', background: 'rgba(255,162,15,0.08)', color: '#ffa20f', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}
                                                title="Registrar abono">
                                                <CreditCard size={13} /> Abonar
                                            </button>
                                        )}
                                        <button onClick={() => openAdjModal(expense)} className="btn btn-secondary"
                                            style={{ padding: '0.35rem' }} title="Adjuntos / facturas">
                                            <Paperclip size={15} />
                                        </button>
                                        {expense.estado !== 'anulado' && (
                                            <button onClick={() => openEdit(expense)} className="btn btn-secondary" style={{ padding: '0.35rem' }} title="Editar">
                                                <Edit size={15} />
                                            </button>
                                        )}
                                        <button onClick={() => handleAnular(expense)} className="btn btn-secondary"
                                            style={{ padding: '0.35rem', color: expense.estado === 'anulado' ? '#22c55e' : '#ffdd19' }}
                                            title={expense.estado === 'anulado' ? 'Reactivar' : 'Anular'}>
                                            {expense.estado === 'anulado' ? <RotateCcw size={15} /> : <Ban size={15} />}
                                        </button>
                                        {expense.estado !== 'anulado' && (
                                            <button onClick={() => handleDelete(expense.id)} className="btn btn-secondary text-danger" style={{ padding: '0.35rem' }} title="Eliminar">
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            {/* Modal Nuevo / Editar */}
            {modal.open && (() => {
                const esInsumo = form.tipo_gasto === 'insumo';
                const insumoSel = insumos.find(i => i.id === parseInt(form.insumo_id));
                const bultos = parseFloat(form.cantidad_bultos) || 0;
                const peso   = parseFloat(form.peso_por_unidad) || 0;
                const totalKg = peso > 0 ? bultos * peso : bultos;
                const unidad  = insumoSel?.unidad_medida || '';
                return (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 500, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
                        <button onClick={() => setModal({ open: false, id: null })} className="btn-close-modal"><X size={18} /></button>
                        <h2 className="m-0 mb-1">{modal.id ? 'Editar Gasto' : 'Nuevo Gasto'}</h2>
                        <p className="text-muted mb-4" style={{ fontSize: '0.82rem' }}>Selecciona el tipo de gasto para continuar</p>

                        <form onSubmit={handleSave} className="flex flex-col gap-4">

                            {/* ── PASO 1: Tipo de gasto ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                {[
                                    { value: 'general', icon: ShoppingBag, label: 'Gasto General', desc: 'Servicios, arriendo, otros' },
                                    { value: 'insumo',  icon: Package,     label: 'Compra Insumo',  desc: 'Ingredientes, materias primas' },
                                ].map(({ value, icon: Icon, label, desc }) => (
                                    <button key={value} type="button"
                                        onClick={() => setForm({ ...form, tipo_gasto: value, insumo_id: '', cantidad_bultos: '', peso_por_unidad: '' })}
                                        style={{
                                            padding: '0.9rem', borderRadius: 10, border: `2px solid ${form.tipo_gasto === value ? 'var(--primary)' : 'rgba(255,255,255,0.08)'}`,
                                            background: form.tipo_gasto === value ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)',
                                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                                        }}>
                                        <Icon size={20} style={{ color: form.tipo_gasto === value ? 'var(--brand)' : 'var(--text-muted)', marginBottom: 6 }} />
                                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: form.tipo_gasto === value ? 'white' : 'var(--text-muted)' }}>{label}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
                                    </button>
                                ))}
                            </div>

                            {/* ── PASO 2: Campos comunes ── */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1rem' }}>
                                <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                    {esInsumo ? '① Datos del gasto' : 'Datos del gasto'}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Valor total *</label>
                                        <input type="number" className="form-control" value={form.valor}
                                            onChange={e => setForm({ ...form, valor: e.target.value })}
                                            placeholder="0" min="0" step="100" required />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Proveedor</label>
                                        <select className="form-control" value={form.proveedor_id}
                                            onChange={e => setForm({ ...form, proveedor_id: e.target.value })}>
                                            <option value="">— Sin proveedor —</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group mt-3" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>Fecha *</label>
                                    <DateInput value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} required height={42} />
                                </div>
                                <div className="form-group mt-3" style={{ marginBottom: 0 }}>
                                    <label>Medio de Pago</label>
                                    <select className="form-control" value={form.medio_pago_id}
                                        onChange={e => setForm({ ...form, medio_pago_id: e.target.value })}>
                                        <option value="">— Pendiente de pago —</option>
                                        {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                    </select>
                                </div>
                                {/* ── Categoría + Subcategoría (jerárquica) ── */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Categoría</label>
                                        <select className="form-control" value={form.categoria_id}
                                            onChange={e => setForm({ ...form, categoria_id: e.target.value, subcategoria_id: '' })}>
                                            <option value="">— Sin categoría —</option>
                                            {categoriasGasto.filter(c => c.activo !== false).map(c => (
                                                <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {(() => {
                                        const catSel = categoriasGasto.find(c => c.id === parseInt(form.categoria_id));
                                        const subs = (catSel?.subcategorias || []).filter(s => s.activo !== false);
                                        if (subs.length === 0) return <div />;
                                        return (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Subcategoría <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>(opcional)</span></label>
                                                <select className="form-control" value={form.subcategoria_id}
                                                    onChange={e => setForm({ ...form, subcategoria_id: e.target.value })}>
                                                    <option value="">— Sin subcategoría —</option>
                                                    {subs.map(s => (
                                                        <option key={s.id} value={s.id}>{s.icono ? `${s.icono} ` : ''}{s.nombre}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* ── PASO 3: Datos del insumo (solo si es insumo) ── */}
                            {esInsumo && (
                                <div style={{ borderTop: '1px solid rgba(139,92,246,0.3)', paddingTop: '1rem', background: 'rgba(139,92,246,0.04)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(139,92,246,0.2)' }}>
                                    <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--brand)', marginBottom: '0.75rem' }}>
                                        ② Detalle del insumo → Inventario
                                    </p>

                                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                        <label>Insumo *</label>
                                        <select className="form-control" value={form.insumo_id}
                                            onChange={e => setForm({ ...form, insumo_id: e.target.value })} required={esInsumo}>
                                            <option value="">— Seleccionar insumo —</option>
                                            {insumos.map(i => (
                                                <option key={i.id} value={i.id}>
                                                    {i.nombre} ({i.unidad_medida})  •  stock actual: {Number(i.cantidad_actual).toFixed(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label>Cantidad *</label>
                                            <input type="number" className="form-control" value={form.cantidad_bultos}
                                                onChange={e => setForm({ ...form, cantidad_bultos: e.target.value })}
                                                placeholder="Ej: 10" min="0.01" step="0.01" required={esInsumo} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label>
                                                {unidad ? `${unidad} por unidad` : 'Peso por unidad'}
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: 4 }}>(opcional)</span>
                                            </label>
                                            <input type="number" className="form-control" value={form.peso_por_unidad}
                                                onChange={e => setForm({ ...form, peso_por_unidad: e.target.value })}
                                                placeholder="Ej: 50" min="0" step="0.01" />
                                        </div>
                                    </div>

                                    {/* Resumen cálculo */}
                                    {insumoSel && bultos > 0 && (
                                        <div style={{ padding: '0.65rem 0.9rem', borderRadius: 8, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Package size={16} style={{ color: 'var(--brand)', flexShrink: 0 }} />
                                            <div style={{ fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Se agregarán al inventario: </span>
                                                <strong style={{ color: 'white' }}>
                                                    {totalKg % 1 === 0 ? totalKg : totalKg.toFixed(2)} {unidad}
                                                </strong>
                                                {peso > 0 && (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                                        {' '}({bultos} × {peso} {unidad})
                                                    </span>
                                                )}
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                                    {' '}de <strong style={{ color: 'var(--brand)' }}>{insumoSel.nombre}</strong>
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-2 justify-end">
                                <button type="button" className="btn btn-secondary" onClick={() => setModal({ open: false, id: null })}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Save size={15} /> {modal.id ? 'Actualizar' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                );
            })()}

            {/* Modal Abonos */}
            {abonoModal && (() => {
                const exp = abonoModal;
                const saldo = exp.saldo_pendiente ?? (exp.valor - (exp.monto_pagado || 0));
                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                        <div className="card" style={{ width: '100%', maxWidth: 480, margin: 'auto', position: 'relative' }}>
                            <button onClick={() => setAbonoModal(null)} className="btn-close-modal"><X size={18} /></button>
                            <h2 className="m-0 mb-1" style={{ fontSize: '1rem' }}>
                                Abonos — Factura #{exp.id}
                                {exp.proveedor_nombre && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {exp.proveedor_nombre}</span>}
                            </h2>
                            {/* Totales */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', minWidth: 100 }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>Total factura</div>
                                    <div style={{ fontWeight: 700 }}>{fmtCurrency(exp.valor)}</div>
                                </div>
                                <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', minWidth: 100 }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>Pagado</div>
                                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>{fmtCurrency(exp.monto_pagado)}</div>
                                </div>
                                <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', minWidth: 100 }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>Saldo</div>
                                    <div style={{ fontWeight: 700, color: saldo > 0 ? 'var(--brand)' : 'var(--success)' }}>{fmtCurrency(saldo)}</div>
                                </div>
                            </div>

                            {/* Lista abonos existentes */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Historial de abonos</div>
                                {abonos.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>Sin abonos registrados</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {abonos.map(a => (
                                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600 }}>{fmtCurrency(a.monto)}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(a.fecha)}{a.medio_pago_nombre ? ` · ${a.medio_pago_nombre}` : ''}{a.notas ? ` · ${a.notas}` : ''}</div>
                                                </div>
                                                <button onClick={() => handleEliminarAbono(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Formulario nuevo abono */}
                            {saldo > 0 && (
                                <form onSubmit={handleCrearAbono}>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registrar abono</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label>Monto *</label>
                                            <input type="number" className="form-control" min="0.01" step="0.01" max={saldo}
                                                placeholder="0"
                                                value={abonoForm.monto}
                                                onChange={e => setAbonoForm(f => ({ ...f, monto: e.target.value }))} required />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label>Fecha *</label>
                                            <DateInput value={abonoForm.fecha} onChange={v => setAbonoForm(f => ({ ...f, fecha: v }))} height={38} />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 10 }}>
                                        <label>Medio de pago</label>
                                        <select className="form-control" value={abonoForm.medio_pago_id}
                                            onChange={e => setAbonoForm(f => ({ ...f, medio_pago_id: e.target.value }))}>
                                            <option value="">— Ninguno —</option>
                                            {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 12 }}>
                                        <label>Notas</label>
                                        <input type="text" className="form-control" placeholder="Opcional"
                                            value={abonoForm.notas}
                                            onChange={e => setAbonoForm(f => ({ ...f, notas: e.target.value }))} />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button type="button" className="btn btn-secondary" onClick={() => setAbonoModal(null)}>Cancelar</button>
                                        <button type="submit" className="btn btn-primary" disabled={abonoLoading}>
                                            {abonoLoading ? 'Guardando…' : 'Registrar abono'}
                                        </button>
                                    </div>
                                </form>
                            )}
                            {saldo <= 0 && (
                                <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--success)', fontWeight: 600 }}>✓ Factura pagada completamente</div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Modal Adjuntos */}
            {adjModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 110,
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 540, margin: 'auto', position: 'relative' }}>
                        <button onClick={() => setAdjModal(null)} className="btn-close-modal"><X size={18} /></button>
                        <h2 className="m-0 mb-1" style={{ fontSize: '1rem' }}>
                            Adjuntos — Gasto #{adjModal.id}
                            {adjModal.proveedor_nombre && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {adjModal.proveedor_nombre}</span>}
                        </h2>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 14px' }}>
                            Sube facturas, comprobantes o soportes. Máx 10MB. Acepta imágenes, PDF y texto.
                        </p>

                        {/* Lista de adjuntos */}
                        <div style={{ marginBottom: 16 }}>
                            {adjuntos.length === 0 ? (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)',
                                    background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13 }}>
                                    Sin adjuntos
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {adjuntos.map(a => (
                                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                                            <Paperclip size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {a.nombre_archivo}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                    {(a.tamano_bytes / 1024).toFixed(1)} KB · {a.mime_type || '—'}
                                                    {a.subido_por_nombre && ` · subido por ${a.subido_por_nombre}`}
                                                </div>
                                            </div>
                                            <button onClick={() => handleDownloadAdjunto(a)}
                                                className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Descargar">
                                                <Download size={13} />
                                            </button>
                                            <button onClick={() => handleDeleteAdjunto(a.id)}
                                                className="btn btn-secondary" style={{ padding: '4px 8px', color: 'var(--danger)' }}
                                                title="Eliminar">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Upload */}
                        <label htmlFor="adj-upload" style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '14px', borderRadius: 10, border: '2px dashed var(--border-default)',
                            background: 'var(--bg-elevated)', cursor: adjUploading ? 'wait' : 'pointer',
                            fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600,
                        }}>
                            <Upload size={16} />
                            {adjUploading ? 'Subiendo…' : 'Click para subir archivo (PDF, imagen o texto)'}
                            <input id="adj-upload" type="file"
                                accept="image/*,application/pdf,text/plain"
                                disabled={adjUploading}
                                onChange={e => { handleUploadAdjunto(e.target.files?.[0]); e.target.value = ''; }}
                                style={{ display: 'none' }} />
                        </label>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                            <button className="btn btn-secondary" onClick={() => setAdjModal(null)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Pago Rápido */}
            {payModal.show && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 380, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
                        <button onClick={() => setPayModal({ show: false, expense: null, methodId: '' })} className="btn-close-modal"><X size={18} /></button>
                        <h2 className="m-0 mb-1">Registrar Pago</h2>
                        <p className="text-muted mb-4">Valor: <strong className="text-white">{fmtCurrency(payModal.expense?.valor)}</strong></p>
                        <form onSubmit={handleConfirmPay}>
                            <div className="form-group">
                                <label>Medio de Pago</label>
                                <select className="form-control" value={payModal.methodId}
                                    onChange={e => setPayModal({ ...payModal, methodId: e.target.value })} required>
                                    <option value="">— Seleccionar —</option>
                                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary font-bold mt-4" style={{ width: '100%' }}>Confirmar Pago</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function ExportMenu({ month, filters = {} }) {
    const [open, setOpen] = useState(false);
    const download = async (format) => {
        setOpen(false);
        try {
            const [y, m] = month.split('-').map(Number);
            const last = new Date(y, m, 0).getDate();
            const params = {
                start_date: `${month}-01`,
                end_date:   `${month}-${String(last).padStart(2, '0')}`,
                ...filters,
            };
            const res = await expensesService.export(params, format);
            const blob = new Blob([res.data]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gastos_${month}.${format}`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            toast.success(`Descargado ${format.toUpperCase()}`);
        } catch (e) {
            toast.error(e.response?.data?.detail || `Error generando ${format}`);
        }
    };
    return (
        <div style={{ position: 'relative' }}>
            <button onClick={() => setOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                    borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    color: 'var(--text-secondary)' }}
                title="Exportar gastos del mes">
                <FileSpreadsheet size={13} /> Exportar
            </button>
            {open && (
                <>
                    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 51,
                        background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.3)', minWidth: 160 }}>
                        <button onClick={() => download('csv')} className="export-opt">
                            <FileIcon size={13} /> CSV
                        </button>
                        <button onClick={() => download('xlsx')} className="export-opt">
                            <FileSpreadsheet size={13} /> Excel (.xlsx)
                        </button>
                        <button onClick={() => { setOpen(false); window.print(); }} className="export-opt">
                            <Printer size={13} /> Imprimir / PDF
                        </button>
                    </div>
                    <style>{`
                        .export-opt {
                            display: flex; align-items: center; gap: 8px;
                            width: 100%; text-align: left; padding: 8px 14px;
                            background: transparent; border: none; cursor: pointer;
                            font-size: 12.5px; color: var(--text-secondary);
                            font-family: inherit;
                        }
                        .export-opt:hover { background: var(--bg-elevated); color: var(--text-primary); }
                    `}</style>
                </>
            )}
        </div>
    );
}

function KpiCard({ label, value, icon, color, sub }) {
    return (
        <div className="card mb-0" style={{
            padding: '0.85rem 1rem',
            borderLeft: `3px solid ${color}`,
            display: 'flex', flexDirection: 'column', gap: 4,
            transition: 'transform 0.15s, box-shadow 0.15s',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem',
                color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <span style={{ color }}>{icon}</span>
                {label}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)',
                letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                {value}
            </div>
            {sub && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {sub}
                </div>
            )}
        </div>
    );
}

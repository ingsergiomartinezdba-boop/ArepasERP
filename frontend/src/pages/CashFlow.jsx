import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
    PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ComposedChart, ReferenceLine,
} from 'recharts';
import {
    ArrowLeft, Wallet, TrendingUp, TrendingDown, Activity, AlertTriangle,
    Calendar, DollarSign, Plus, Edit, Trash2, X, Save, FileSpreadsheet,
    FileText as FileIcon, Printer, ChevronRight, ArrowUpRight, ArrowDownRight,
    Receipt, Banknote, PiggyBank, BarChart3, Sparkles, Filter, CreditCard,
} from 'lucide-react';
import {
    cashFlowService, paymentMethodsService,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { todayBogota, formatDate } from '../utils/formatters';
import DateInput from '../components/DateInput';

// ── Helpers ─────────────────────────────────────────────────────────
const fmtCurrency = (v) => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(v || 0);
const fmtShort = (v) => {
    if (Math.abs(v) >= 1_000_000) return `$${(v/1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `$${(v/1_000).toFixed(0)}k`;
    return `$${Math.round(v)}`;
};
const fmtPct = (v) => `${v > 0 ? '+' : ''}${(v || 0).toFixed(1)}%`;

const GRAN_OPTIONS = [
    { value: 'day',   label: 'Día'    },
    { value: 'week',  label: 'Semana' },
    { value: 'month', label: 'Mes'    },
    { value: 'year',  label: 'Año'    },
];

const RANGE_PRESETS = [
    { id: '7d',  label: '7 días',  days: 6  },
    { id: '30d', label: '30 días', days: 29 },
    { id: '90d', label: '90 días', days: 89 },
    { id: 'mtd', label: 'Mes actual' },
    { id: 'ytd', label: 'Año actual' },
];

const NIVEL_CFG = {
    critico: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'CRÍTICO' },
    alta:    { color: '#f97316', bg: 'rgba(249,115,22,0.10)', label: 'ALTA'    },
    media:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'MEDIA'   },
    baja:    { color: '#06b6d4', bg: 'rgba(6,182,212,0.10)',  label: 'BAJA'    },
};


export default function CashFlow() {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();

    // ── Estado: filtros ────────────────────────────────────────────
    const today = todayBogota();
    const [granularity, setGranularity] = useState('day');
    const [preset, setPreset] = useState('30d');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(today);
        d.setDate(d.getDate() - 29);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(today);

    // ── Estado: datos ──────────────────────────────────────────────
    const [dashboard,    setDashboard]    = useState(null);
    const [timeline,     setTimeline]     = useState(null);
    const [categorias,   setCategorias]   = useState(null);
    const [proyecciones, setProyecciones] = useState(null);
    const [alertas,      setAlertas]      = useState([]);
    const [saldosMP,     setSaldosMP]     = useState(null);
    const [loading,      setLoading]      = useState(true);

    // ── Estado: CRUD ingresos manuales ─────────────────────────────
    const [ingresosManuales, setIngresosManuales] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editing,   setEditing]   = useState(null);
    const [catsIngreso, setCatsIngreso] = useState([]);
    const [mediosPago,  setMediosPago]  = useState([]);

    const puedeExportar = hasPermission('cash_flow.export');
    const puedeCrearIng = hasPermission('ingresos_manuales.crear');
    const puedeEditarIng = hasPermission('ingresos_manuales.editar');
    const puedeAnularIng = hasPermission('ingresos_manuales.eliminar');

    // ── Cargar todo ────────────────────────────────────────────────
    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const params = { start_date: startDate, end_date: endDate, granularity };
            const [dash, tl, cats, proj, alert, saldos, im, ci, mp] = await Promise.all([
                cashFlowService.dashboard(),
                cashFlowService.timeline(params),
                cashFlowService.categorias({ start_date: startDate, end_date: endDate }),
                cashFlowService.proyecciones(4),
                cashFlowService.alertas(),
                cashFlowService.saldosMediosPago(),
                cashFlowService.listIngresosManuales({
                    start_date: startDate, end_date: endDate, estado: 'activo',
                }),
                cashFlowService.categoriasIngreso(),
                paymentMethodsService.getAll(),
            ]);
            setDashboard(dash.data);
            setTimeline(tl.data);
            setCategorias(cats.data);
            setProyecciones(proj.data);
            setAlertas(alert.data.alertas || []);
            setSaldosMP(saldos.data || null);
            setIngresosManuales(im.data || []);
            setCatsIngreso(ci.data || []);
            setMediosPago(mp.data || []);
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.detail || 'Error cargando flujo de caja');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, granularity]);

    useEffect(() => { loadAll(); }, [loadAll]);

    // ── Aplicar preset de rango ────────────────────────────────────
    const applyPreset = (id) => {
        setPreset(id);
        const t = new Date(today);
        let start;
        if (id === 'mtd') {
            start = new Date(t.getFullYear(), t.getMonth(), 1);
        } else if (id === 'ytd') {
            start = new Date(t.getFullYear(), 0, 1);
        } else {
            const days = RANGE_PRESETS.find(p => p.id === id)?.days ?? 29;
            start = new Date(t);
            start.setDate(start.getDate() - days);
        }
        setStartDate(start.toISOString().slice(0, 10));
        setEndDate(today);
        // Ajustar granularidad coherente
        if (id === 'ytd') setGranularity('month');
        else if (id === '90d') setGranularity('week');
        else setGranularity('day');
    };

    // ── Exportar ───────────────────────────────────────────────────
    const exportFile = async (format) => {
        try {
            const params = { start_date: startDate, end_date: endDate, granularity };
            const res = await cashFlowService.export(params, format);
            const blob = new Blob([res.data]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cash_flow_${startDate}_${endDate}.${format}`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            toast.success(`Descargado ${format.toUpperCase()}`);
        } catch (e) {
            toast.error(e.response?.data?.detail || `Error generando ${format}`);
        }
    };

    // ── Modal: crear/editar ingreso manual ─────────────────────────
    const openCreate = () => { setEditing(null); setShowModal(true); };
    const openEdit = (im) => { setEditing(im); setShowModal(true); };
    const closeModal = () => { setShowModal(false); setEditing(null); };
    const anularIngreso = async (im) => {
        if (!confirm(`¿Anular ingreso manual de ${fmtCurrency(im.valor)}?`)) return;
        try {
            await cashFlowService.anularIngresoManual(im.id);
            toast.success('Ingreso anulado');
            loadAll();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error anulando ingreso');
        }
    };

    // ── Datos derivados para charts ────────────────────────────────
    const serieTimeline = useMemo(() => {
        if (!timeline?.serie) return [];
        return timeline.serie.map(b => ({
            ...b,
            ingresos: b.ingresos_totales,
        }));
    }, [timeline]);

    const compTotals = useMemo(() => {
        if (!timeline?.totales) return null;
        return [
            { name: 'Cobrado',  value: timeline.totales.cobrado,           color: '#10b981' },
            { name: 'Manuales', value: timeline.totales.ingresos_manuales, color: '#06b6d4' },
            { name: 'Egresos',  value: timeline.totales.egresos,           color: '#ef4444' },
        ];
    }, [timeline]);

    // ── Render ────────────────────────────────────────────────────
    if (loading || !dashboard) {
        return (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Cargando flujo de caja…
            </div>
        );
    }

    const variacionUtilidad = dashboard.crecimiento_utilidad_pct;
    const variacionIngresos = dashboard.crecimiento_ingresos_pct;

    return (
        <div>
            {/* ── HEADER ─────────────────────────────────────────── */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => navigate('/')} className="btn btn-secondary"
                        style={{ width: 36, height: 36, padding: 0, borderRadius: 18 }}>
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="m-0" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <PiggyBank size={22} style={{ color: 'var(--brand)' }} /> Flujo de Caja
                        </h1>
                        <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
                            Salud financiera · {formatDate(startDate)} → {formatDate(endDate)} · Caja actual {fmtCurrency(dashboard.caja_total)}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {puedeCrearIng && (
                        <button onClick={openCreate} className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            <Plus size={14} /> Nuevo ingreso
                        </button>
                    )}
                    {puedeExportar && (
                        <>
                            <button onClick={() => exportFile('csv')} className="btn btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                <FileIcon size={13} /> CSV
                            </button>
                            <button onClick={() => exportFile('xlsx')} className="btn btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                <FileSpreadsheet size={13} /> Excel
                            </button>
                            <button onClick={() => exportFile('pdf')} className="btn btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                <Printer size={13} /> PDF
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── FILTROS ────────────────────────────────────────── */}
            <div className="filter-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                    <Filter size={13} /> RANGO
                </div>
                <div className="filter-chips">
                    {RANGE_PRESETS.map(p => (
                        <button key={p.id} onClick={() => applyPreset(p.id)}
                            className={`filter-chips__btn${preset === p.id ? ' filter-chips__btn--active' : ''}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="filter-date-range">
                    <DateInput value={startDate} height={34}
                        onChange={v => { setStartDate(v); setPreset('custom'); }} />
                    <span className="filter-date-range__arrow">→</span>
                    <DateInput value={endDate} height={34}
                        onChange={v => { setEndDate(v); setPreset('custom'); }} />
                </div>
                <div className="filter-chips" style={{ marginLeft: 'auto' }}>
                    {GRAN_OPTIONS.map(g => (
                        <button key={g.value} onClick={() => setGranularity(g.value)}
                            className={`filter-chips__btn${granularity === g.value ? ' filter-chips__btn--active' : ''}`}>
                            {g.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── ALERTAS ────────────────────────────────────────── */}
            {alertas.length > 0 && (
                <div className="card" style={{ padding: '0.85rem 1.1rem', marginBottom: 16,
                    background: 'rgba(239,68,68,0.04)', borderLeft: '3px solid #ef4444' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                        <strong style={{ fontSize: 13, color: '#ef4444' }}>
                            {alertas.length} alerta{alertas.length > 1 ? 's' : ''} financiera{alertas.length > 1 ? 's' : ''}
                        </strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {alertas.map((a, i) => {
                            const cfg = NIVEL_CFG[a.nivel] || NIVEL_CFG.media;
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                    fontSize: 12, padding: '6px 10px', background: cfg.bg, borderRadius: 8 }}>
                                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                                        background: cfg.color, color: '#fff' }}>{cfg.label}</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{a.titulo}</strong>
                                    <span style={{ color: 'var(--text-secondary)' }}>· {a.mensaje}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── KPIs ───────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                gap: 12, marginBottom: 18 }}>
                <KpiCard label="Caja disponible" value={fmtCurrency(dashboard.caja_total)}
                    icon={<Wallet size={14} />} color="var(--brand)"
                    sub={`Suma de todos los medios de pago`} />
                <KpiCard label="Vendido del mes" value={fmtCurrency(dashboard.vendido_mes)}
                    icon={<Receipt size={14} />} color="#06b6d4"
                    sub={`Hoy: ${fmtCurrency(dashboard.vendido_hoy)}`} />
                <KpiCard label="Cobrado del mes" value={fmtCurrency(dashboard.cobrado_mes)}
                    icon={<Banknote size={14} />} color="var(--success)"
                    sub={
                        <span style={{ color: variacionIngresos >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                            {variacionIngresos >= 0 ? <ArrowUpRight size={11} style={{ display: 'inline' }}/> : <ArrowDownRight size={11} style={{ display: 'inline' }}/>}
                            {' '}{fmtPct(variacionIngresos)} vs mes anterior
                        </span>
                    } />
                <KpiCard label="Egresos del mes" value={fmtCurrency(dashboard.egresos_mes)}
                    icon={<TrendingDown size={14} />} color="var(--danger)"
                    sub={`Hoy: ${fmtCurrency(dashboard.egresos_hoy)}`} />
                <KpiCard label="Utilidad del mes" value={fmtCurrency(dashboard.utilidad_mes)}
                    icon={<TrendingUp size={14} />} color={dashboard.utilidad_mes >= 0 ? 'var(--success)' : 'var(--danger)'}
                    sub={
                        <span style={{ color: variacionUtilidad >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                            {fmtPct(variacionUtilidad)} vs mes anterior
                        </span>
                    } />
                <KpiCard label="Margen operativo" value={`${(dashboard.margen_mes_pct || 0).toFixed(1)}%`}
                    icon={<Activity size={14} />} color="#a78bfa"
                    sub={dashboard.margen_mes_pct >= 15 ? 'Saludable' : dashboard.margen_mes_pct >= 5 ? 'Aceptable' : 'Bajo'} />
                <KpiCard label="Por cobrar" value={fmtCurrency(dashboard.por_cobrar)}
                    icon={<DollarSign size={14} />} color="#f59e0b"
                    sub="Cartera abierta" />
                <KpiCard label="Por pagar" value={fmtCurrency(dashboard.por_pagar)}
                    icon={<DollarSign size={14} />} color="#f97316"
                    sub="Cuentas a proveedores" />
            </div>

            {/* ── Saldos por medio de pago ──────────────────────── */}
            {saldosMP?.items?.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                    <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
                        Saldos por medio de pago
                    </h2>
                    <div style={{ display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
                        {saldosMP.items.map(item => {
                            const pos = item.saldo >= 0;
                            const color = pos ? '#22c55e' : '#ef4444';
                            return (
                                <div key={item.id} className="card mb-0"
                                    style={{ borderTop: `3px solid ${color}`, padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <div style={{ width: 30, height: 30, borderRadius: '50%',
                                            background: pos ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <CreditCard size={13} style={{ color }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                                letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                                                {item.tipo || 'efectivo'}
                                            </div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.medio}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1,
                                        marginBottom: 6, color }}>
                                        {fmtCurrency(item.saldo)}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6,
                                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)',
                                                marginBottom: 1, fontWeight: 600, textTransform: 'uppercase' }}>
                                                Ingresos
                                            </div>
                                            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#22c55e' }}>
                                                +{fmtCurrency(item.ingresos)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)',
                                                marginBottom: 1, fontWeight: 600, textTransform: 'uppercase' }}>
                                                Egresos
                                            </div>
                                            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ef4444' }}>
                                                -{fmtCurrency(item.egresos)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {saldosMP.items.length > 1 && (() => {
                            const t = saldosMP.total || { ingresos: 0, egresos: 0, saldo: 0 };
                            const pos = t.saldo >= 0;
                            return (
                                <div className="card mb-0"
                                    style={{ borderTop: '3px solid #8b5cf6', padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <div style={{ width: 30, height: 30, borderRadius: '50%',
                                            background: 'rgba(139,92,246,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <DollarSign size={13} style={{ color: '#8b5cf6' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                                letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                                                Consolidado
                                            </div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Total Caja</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1, marginBottom: 6,
                                        color: pos ? '#22c55e' : '#ef4444' }}>
                                        {fmtCurrency(t.saldo)}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6,
                                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)',
                                                marginBottom: 1, fontWeight: 600, textTransform: 'uppercase' }}>
                                                Ingresos
                                            </div>
                                            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#22c55e' }}>
                                                +{fmtCurrency(t.ingresos)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)',
                                                marginBottom: 1, fontWeight: 600, textTransform: 'uppercase' }}>
                                                Egresos
                                            </div>
                                            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ef4444' }}>
                                                -{fmtCurrency(t.egresos)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ── Gráfico 1: Timeline cash flow + saldo ─────────── */}
            <ChartCard title="Flujo de caja · saldo acumulado"
                subtitle={`${timeline?.serie?.length || 0} ${granularity === 'day' ? 'días' : granularity === 'week' ? 'semanas' : granularity === 'month' ? 'meses' : 'años'} · caja final ${fmtCurrency(timeline?.caja?.fin_periodo || 0)}`}>
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={serieTimeline} margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                            axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                            axisLine={false} tickLine={false} width={56} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={fmtShort}
                            tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                            axisLine={false} tickLine={false} width={56} />
                        <Tooltip
                            formatter={(v, n) => [fmtCurrency(v), n]}
                            contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <ReferenceLine yAxisId="left" y={0} stroke="rgba(255,255,255,0.2)" />
                        <Bar yAxisId="left" dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[3, 3, 0, 0]} />
                        <Bar yAxisId="left" dataKey="egresos"  name="Egresos"  fill="#ef4444" radius={[3, 3, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="saldo_final" name="Saldo"
                            stroke="#facc15" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* ── Row: ingresos vs egresos + composición ────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                gap: 12, marginBottom: 12 }}>
                <ChartCard title="Vendido vs Cobrado"
                    subtitle="Diferencia entre facturación (devengado) y caja real (cobrado)">
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={serieTimeline} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                axisLine={false} tickLine={false} width={50} />
                            <Tooltip formatter={(v, n) => [fmtCurrency(v), n]}
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                    borderRadius: 8, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <defs>
                                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4}/>
                                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4}/>
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="vendido" name="Vendido (devengado)"
                                stroke="#06b6d4" fill="url(#g1)" strokeWidth={2} />
                            <Area type="monotone" dataKey="cobrado" name="Cobrado (caja)"
                                stroke="#10b981" fill="url(#g2)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Composición de movimientos"
                    subtitle="Distribución del flujo en el período">
                    {compTotals && compTotals.some(d => d.value > 0) ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie data={compTotals.filter(d => d.value > 0)} dataKey="value" nameKey="name"
                                    cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}>
                                    {compTotals.map((d, i) => <Cell key={i} fill={d.color} />)}
                                </Pie>
                                <Tooltip formatter={v => fmtCurrency(v)}
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                        borderRadius: 8, fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-tertiary)', fontSize: 13 }}>Sin datos en el período</div>
                    )}
                    {compTotals && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                            {compTotals.map(d => (
                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                                    <span style={{ color: 'var(--text-tertiary)' }}>· {fmtCurrency(d.value)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* ── Row: top categorías ingreso / egreso ──────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                gap: 12, marginBottom: 12 }}>
                <ChartCard title="Top categorías · Ingresos"
                    subtitle={`Total ingresos ${fmtCurrency(categorias?.ingresos_total || 0)}`}>
                    {categorias?.ingresos?.length > 0 ? (
                        <CategoriaList items={categorias.ingresos} />
                    ) : (
                        <EmptyMsg text="Sin ingresos en el período" />
                    )}
                </ChartCard>

                <ChartCard title="Top categorías · Egresos"
                    subtitle={`Total egresos ${fmtCurrency(categorias?.egresos_total || 0)}`}>
                    {categorias?.egresos?.length > 0 ? (
                        <CategoriaList items={categorias.egresos} />
                    ) : (
                        <EmptyMsg text="Sin egresos en el período" />
                    )}
                </ChartCard>
            </div>

            {/* ── Proyección ──────────────────────────────────── */}
            {proyecciones && proyecciones.proyeccion_semanas?.length > 0 && (
                <ChartCard title="Proyección 4 semanas"
                    subtitle={`Base: promedio diario · Ingresos ${fmtCurrency(proyecciones.promedio_diario_ingresos)} · Egresos ${fmtCurrency(proyecciones.promedio_diario_egresos)}${proyecciones.alerta_caja_negativa ? ' · ⚠ Riesgo de caja negativa' : ''}`}>
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={proyecciones.proyeccion_semanas} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                axisLine={false} tickLine={false} width={56} />
                            <Tooltip formatter={(v, n) => [fmtCurrency(v), n]}
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                    borderRadius: 8, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <ReferenceLine y={0} stroke="rgba(239,68,68,0.4)" strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="ingresos" name="Ingresos proy."
                                stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="egresos" name="Egresos proy."
                                stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="saldo" name="Saldo proy."
                                stroke="#facc15" strokeWidth={2.5} strokeDasharray="4 2" dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* ── Tabla ingresos manuales ─────────────────────── */}
            <ChartCard title="Ingresos manuales del período"
                subtitle={`${ingresosManuales.length} registro${ingresosManuales.length === 1 ? '' : 's'} activos`}>
                {ingresosManuales.length === 0 ? (
                    <EmptyMsg text="No hay ingresos manuales registrados en este período." />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                    <th className="p-3">Fecha</th>
                                    <th className="p-3">Categoría</th>
                                    <th className="p-3">Descripción</th>
                                    <th className="p-3">Medio</th>
                                    <th className="p-3 text-right">Valor</th>
                                    <th className="p-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ingresosManuales.map(im => (
                                    <tr key={im.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td className="p-3 text-sm" style={{ whiteSpace: 'nowrap' }}>{im.fecha}</td>
                                        <td className="p-3">
                                            {im.categoria_nombre ? (
                                                <span style={{
                                                    fontSize: '0.72rem', fontWeight: 700, padding: '0.18rem 0.6rem',
                                                    borderRadius: 999, background: 'rgba(16,185,129,0.12)',
                                                    color: '#10b981',
                                                }}>{im.categoria_nombre}</span>
                                            ) : <span style={{ opacity: 0.4 }}>—</span>}
                                            {im.subcategoria_nombre && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: 6 }}>
                                                    · {im.subcategoria_nombre}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            {im.descripcion || <span style={{ opacity: 0.4 }}>—</span>}
                                        </td>
                                        <td className="p-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                            {im.medio_pago_nombre || '—'}
                                        </td>
                                        <td className="p-3 text-right" style={{ fontWeight: 700, color: 'var(--success)' }}>
                                            {fmtCurrency(im.valor)}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-center gap-1">
                                                {puedeEditarIng && (
                                                    <button onClick={() => openEdit(im)} className="btn btn-secondary"
                                                        style={{ padding: '0.35rem' }} title="Editar">
                                                        <Edit size={14} />
                                                    </button>
                                                )}
                                                {puedeAnularIng && (
                                                    <button onClick={() => anularIngreso(im)} className="btn btn-secondary"
                                                        style={{ padding: '0.35rem', color: '#ef4444' }} title="Anular">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </ChartCard>

            {/* ── Modal nuevo/editar ingreso manual ───────────── */}
            {showModal && (
                <IngresoManualModal
                    ingreso={editing}
                    categorias={catsIngreso}
                    mediosPago={mediosPago}
                    onClose={closeModal}
                    onSaved={() => { closeModal(); loadAll(); }}
                />
            )}
        </div>
    );
}


// ────────────────────────────────────────────────────────────────────
// Subcomponentes
// ────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color, sub }) {
    return (
        <div className="card mb-0" style={{
            padding: '0.85rem 1rem', borderLeft: `3px solid ${color}`,
            display: 'flex', flexDirection: 'column', gap: 4,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem',
                color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <span style={{ color }}>{icon}</span> {label}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)',
                letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</div>
            {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>}
        </div>
    );
}


function ChartCard({ title, subtitle, children }) {
    return (
        <div className="card" style={{ padding: '1.1rem 1.25rem', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>{title}</h3>
                    {subtitle && <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}


function CategoriaList({ items }) {
    const max = Math.max(...items.map(i => i.total), 1);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(c => (
                <div key={`${c.id || 'n'}-${c.nombre}`} style={{
                    padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8,
                    borderLeft: `3px solid ${c.color || '#8b5cf6'}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 14 }}>{c.icono || '•'}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.nombre}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtCurrency(c.total)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 42, textAlign: 'right' }}>
                            {c.pct}%
                        </span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(c.total / max) * 100}%`, background: c.color || '#8b5cf6',
                            height: '100%', borderRadius: 2 }} />
                    </div>
                </div>
            ))}
        </div>
    );
}


function EmptyMsg({ text }) {
    return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            {text}
        </div>
    );
}


// ────────────────────────────────────────────────────────────────────
// Modal: crear / editar ingreso manual
// ────────────────────────────────────────────────────────────────────

function IngresoManualModal({ ingreso, categorias, mediosPago, onClose, onSaved }) {
    const isEdit = !!ingreso;
    const [form, setForm] = useState({
        fecha:           ingreso?.fecha           ?? todayBogota(),
        valor:           ingreso?.valor           ?? '',
        categoria_id:    ingreso?.categoria_id    ?? '',
        subcategoria_id: ingreso?.subcategoria_id ?? '',
        medio_pago_id:   ingreso?.medio_pago_id   ?? '',
        descripcion:     ingreso?.descripcion     ?? '',
        tipo:            ingreso?.tipo            ?? 'operativo',
    });
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const selectedCat = useMemo(
        () => categorias.find(c => c.id === parseInt(form.categoria_id)),
        [categorias, form.categoria_id]
    );

    const submit = async (e) => {
        e?.preventDefault();
        if (!form.valor || parseFloat(form.valor) <= 0) {
            toast.warning('El valor debe ser mayor a 0'); return;
        }
        const payload = {
            fecha:           form.fecha,
            valor:           parseFloat(form.valor),
            categoria_id:    form.categoria_id    ? parseInt(form.categoria_id)    : null,
            subcategoria_id: form.subcategoria_id ? parseInt(form.subcategoria_id) : null,
            medio_pago_id:   form.medio_pago_id   ? parseInt(form.medio_pago_id)   : null,
            descripcion:     form.descripcion || null,
            tipo:            form.tipo || 'operativo',
        };
        setSaving(true);
        try {
            if (isEdit) {
                await cashFlowService.actualizarIngresoManual(ingreso.id, payload);
                toast.success('Ingreso actualizado');
            } else {
                await cashFlowService.crearIngresoManual(payload);
                toast.success('Ingreso registrado');
            }
            onSaved();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error guardando ingreso');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
        }} onClick={onClose}>
            <div className="card" onClick={e => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 540, padding: '1.5rem', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sparkles size={18} style={{ color: 'var(--success)' }} />
                        {isEdit ? 'Editar ingreso manual' : 'Nuevo ingreso manual'}
                    </h2>
                    <button onClick={onClose} className="btn btn-secondary"
                        style={{ padding: '0.4rem', width: 32, height: 32 }}>
                        <X size={15} />
                    </button>
                </div>

                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Field label="Fecha *">
                            <DateInput value={form.fecha} onChange={v => set('fecha', v)}
                                required style={{ width: '100%' }} />
                        </Field>
                        <Field label="Valor (COP) *">
                            <input type="number" min="0" step="0.01"
                                value={form.valor} onChange={e => set('valor', e.target.value)}
                                required className="form-input" />
                        </Field>
                    </div>

                    <Field label="Categoría">
                        <select value={form.categoria_id}
                            onChange={e => { set('categoria_id', e.target.value); set('subcategoria_id', ''); }}
                            className="form-input">
                            <option value="">— Seleccionar —</option>
                            {categorias.map(c => (
                                <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
                            ))}
                        </select>
                    </Field>

                    {selectedCat?.subcategorias?.length > 0 && (
                        <Field label="Subcategoría">
                            <select value={form.subcategoria_id}
                                onChange={e => set('subcategoria_id', e.target.value)}
                                className="form-input">
                                <option value="">—</option>
                                {selectedCat.subcategorias.map(s => (
                                    <option key={s.id} value={s.id}>{s.icono} {s.nombre}</option>
                                ))}
                            </select>
                        </Field>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Field label="Medio de pago">
                            <select value={form.medio_pago_id}
                                onChange={e => set('medio_pago_id', e.target.value)}
                                className="form-input">
                                <option value="">—</option>
                                {mediosPago.filter(m => m.activo).map(m => (
                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Tipo">
                            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
                                className="form-input">
                                <option value="operativo">Operativo</option>
                                <option value="no_operativo">No operativo</option>
                                <option value="extraordinario">Extraordinario</option>
                            </select>
                        </Field>
                    </div>

                    <Field label="Descripción">
                        <textarea value={form.descripcion}
                            onChange={e => set('descripcion', e.target.value)}
                            rows={2} className="form-input"
                            placeholder="Detalle opcional del ingreso" />
                    </Field>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving} className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Save size={14} /> {saving ? 'Guardando…' : (isEdit ? 'Actualizar' : 'Registrar')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


function Field({ label, children }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
            {children}
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { expensesService } from '../services/api';
import { todayBogota } from '../utils/formatters';
import {
    ArrowLeft, TrendingDown, TrendingUp, Calendar, Activity, AlertTriangle,
    Receipt, Tag, FileSpreadsheet, FileText as FileIcon, Printer,
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { toast } from 'sonner';

const fmtCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);
const fmtShort    = (v) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M`
                         : v >= 1_000     ? `$${(v/1_000).toFixed(0)}k`
                         : `$${v}`;
const MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function ExpensesDashboard() {
    const navigate = useNavigate();
    const [periodo, setPeriodo] = useState(todayBogota().slice(0, 7));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, [periodo]);   // eslint-disable-line react-hooks/exhaustive-deps

    const load = async () => {
        setLoading(true);
        try {
            const r = await expensesService.getWidgets(periodo);
            setData(r.data);
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error cargando dashboard');
        } finally { setLoading(false); }
    };

    const setPeriodoOffset = (offset) => {
        const [y, m] = todayBogota().slice(0, 7).split('-').map(Number);
        const d = new Date(y, m - 1 + offset, 1);
        setPeriodo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    const downloadFile = async (format) => {
        try {
            const [y, m] = periodo.split('-').map(Number);
            const last = new Date(y, m, 0).getDate();
            const params = { start_date: `${periodo}-01`, end_date: `${periodo}-${String(last).padStart(2,'0')}` };
            const res = await expensesService.export(params, format);
            const blob = new Blob([res.data]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gastos_${periodo}.${format}`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            toast.success(`Descargado ${format.toUpperCase()}`);
        } catch (e) {
            toast.error(e.response?.data?.detail || `Error generando ${format}`);
        }
    };

    if (loading || !data) {
        return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Cargando dashboard…</div>;
    }

    const tendenciaUI = (data.tendencia_6_meses || []).map(p => ({
        ...p, mes: MES[p.month - 1],
    }));

    const tipoCostoData = [
        { name: 'Directos',       value: data.por_tipo_costo?.directo || 0,        fill: '#10b981' },
        { name: 'Indirectos',     value: data.por_tipo_costo?.indirecto || 0,      fill: '#a78bfa' },
        { name: 'Sin clasificar', value: data.por_tipo_costo?.sin_clasificar || 0, fill: '#94a3b8' },
    ].filter(d => d.value > 0);

    return (
        <div>
            {/* HEADER */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => navigate('/expenses')} className="btn btn-secondary"
                        style={{ width: 36, height: 36, padding: 0, borderRadius: 18 }}>
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="m-0">Dashboard de Gastos</h1>
                        <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
                            Análisis ampliado · {data.registros} registros · {periodo}
                        </p>
                    </div>
                </div>

                <div className="filter-bar filter-bar--inline" style={{ marginBottom: 0 }}>
                    {/* Período: chips Actual/Anterior + selects mes/año */}
                    <div className="filter-chips">
                        <button onClick={() => setPeriodoOffset(0)}
                            className="filter-chips__btn">Actual</button>
                        <button onClick={() => setPeriodoOffset(-1)}
                            className="filter-chips__btn">Anterior</button>
                    </div>
                    <select className="filter-bar__select"
                        value={periodo.split('-')[1]}
                        onChange={e => setPeriodo(`${periodo.split('-')[0]}-${e.target.value}`)}>
                        {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) =>
                            <option key={m} value={m}>{MES[i]}</option>)}
                    </select>
                    <select className="filter-bar__select"
                        value={periodo.split('-')[0]}
                        onChange={e => setPeriodo(`${e.target.value}-${periodo.split('-')[1]}`)}>
                        {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <div className="filter-bar__actions">
                        <button onClick={() => downloadFile('csv')} className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <FileIcon size={13} /> CSV
                        </button>
                        <button onClick={() => downloadFile('xlsx')} className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <FileSpreadsheet size={13} /> Excel
                        </button>
                        <button onClick={() => window.print()} className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <Printer size={13} /> Imprimir / PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* ALERTAS DE SOBRECOSTO */}
            {data.alertas_sobrecosto?.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                        <strong style={{ fontSize: 13, color: '#ef4444' }}>
                            {data.alertas_sobrecosto.length} alerta{data.alertas_sobrecosto.length > 1 ? 's' : ''} de sobrecosto
                        </strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {data.alertas_sobrecosto.map((a, i) => (
                            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{a.icono} {a.categoria}</strong>
                                {' — '}{fmtCurrency(a.actual)} vs promedio {fmtCurrency(a.promedio_previo)}
                                <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: 6 }}>
                                    (+{a.exceso_pct}%)
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 12, marginBottom: 18 }}>
                <KpiCard label="Total del mes"  value={fmtCurrency(data.total_mes)}     icon={<TrendingDown size={14} />} color="var(--danger)"
                    sub={data.variacion_pct !== 0 ? <span style={{ color: data.variacion_pct > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>{data.variacion_pct > 0 ? '↑' : '↓'} {Math.abs(data.variacion_pct)}% vs mes anterior</span> : null} />
                <KpiCard label="Pagados"        value={fmtCurrency(data.pagado_mes)}    icon={<Receipt size={14} />}     color="var(--success)"
                    sub={data.total_mes > 0 ? `${Math.round(data.pagado_mes / data.total_mes * 100)}% del total` : '—'} />
                <KpiCard label="Pendientes"     value={fmtCurrency(data.pendiente_mes)} icon={<AlertTriangle size={14} />} color="var(--warning)"
                    sub={data.pendiente_mes > 0 ? 'Saldo por pagar' : '✓ Sin deudas'} />
                {data.is_current_month && (
                    <KpiCard label="Hoy" value={fmtCurrency(data.total_hoy)} icon={<Calendar size={14} />} color="#06b6d4"
                        sub={`Promedio diario: ${fmtCurrency(data.promedio_diario)}`} />
                )}
                {data.is_current_month && (
                    <KpiCard label="Esta semana" value={fmtCurrency(data.total_semana)} icon={<Activity size={14} />} color="#8b5cf6"
                        sub="Lunes a hoy" />
                )}
                <KpiCard label="Registros" value={String(data.registros)} icon={<Tag size={14} />} color="#a78bfa"
                    sub={`En el período`} />
            </div>

            {/* Gráficos row 1: tendencia + tipo costo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12, marginBottom: 18 }}>
                <ChartCard title="Tendencia 6 meses"
                    subtitle={data.variacion_pct !== 0 ? `${data.variacion_pct > 0 ? '↑' : '↓'} ${Math.abs(data.variacion_pct)}% vs mes anterior` : 'Histórico'}>
                    <ResponsiveContainer width="100%" height={230}>
                        <LineChart data={tendenciaUI} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={56} />
                            <Tooltip formatter={v => [fmtCurrency(v), 'Total']}
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                            <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2.5}
                                dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>

                {tipoCostoData.length > 0 && (
                    <ChartCard title="Composición por tipo de costo"
                        subtitle="Directo vs Indirecto vs Sin clasificar">
                        <ResponsiveContainer width="100%" height={230}>
                            <PieChart>
                                <Pie data={tipoCostoData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                    innerRadius={55} outerRadius={90} paddingAngle={2}>
                                    {tipoCostoData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                </Pie>
                                <Tooltip formatter={v => fmtCurrency(v)}
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                            {tipoCostoData.map(d => (
                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 2, background: d.fill }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                                    <span style={{ color: 'var(--text-tertiary)' }}>· {fmtCurrency(d.value)}</span>
                                </div>
                            ))}
                        </div>
                    </ChartCard>
                )}
            </div>

            {/* Top categorías */}
            {data.top_categorias?.length > 0 && (
                <ChartCard title="Top categorías" subtitle="Mayor gasto del período">
                    <ResponsiveContainer width="100%" height={Math.min(40 + data.top_categorias.length * 36, 360)}>
                        <BarChart data={data.top_categorias} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                            <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="nombre" width={140} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={v => [fmtCurrency(v), 'Total']}
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                                cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                                {data.top_categorias.map((c, i) => <Cell key={i} fill={c.color || '#8b5cf6'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    {/* Tabla de % */}
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {data.top_categorias.map(c => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 8,
                                borderLeft: `3px solid ${c.color || '#8b5cf6'}` }}>
                                <span style={{ fontSize: 14 }}>{c.icono || '•'}</span>
                                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.nombre}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                    {fmtCurrency(c.total)}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 48, textAlign: 'right' }}>
                                    {c.pct}%
                                </span>
                            </div>
                        ))}
                    </div>
                </ChartCard>
            )}
        </div>
    );
}

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

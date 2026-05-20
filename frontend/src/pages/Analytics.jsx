import { useState, useEffect } from 'react';
import { analyticsService, productionService } from '../services/api';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
    FlaskConical, TrendingUp, TrendingDown, Minus,
    Package, Users, AlertTriangle, CheckCircle, Layers,
    ChevronRight, RefreshCw,
} from 'lucide-react';

const FMT  = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);
const FMTn = (v, dec = 1) => Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const PERIODO_OPTIONS = [
    { label: '7 días',  value: 7 },
    { label: '15 días', value: 15 },
    { label: '30 días', value: 30 },
];

const BAR_COLORS = ['#ffdd19','#8b5cf6','#10b981','#3b82f6','#ef4444','#ec4899','#14b8a6','#f97316'];

// ── Tooltip personalizado ──────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color, fontWeight: 600 }}>
                    {p.name}: {p.name?.includes('cop') || p.name?.includes('COP') ? FMT(p.value) : FMTn(p.value) + ' kg'}
                </div>
            ))}
        </div>
    );
};

// ── Card KPI ───────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color = '#ffdd19', icon: Icon, small }) => (
    <div className="card" style={{ padding: '16px 18px', borderTop: `3px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{label}</span>
            {Icon && <Icon size={16} style={{ color, opacity: 0.7 }} />}
        </div>
        <div style={{ fontSize: small ? 18 : 24, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
);

// ── Badge tendencia ────────────────────────────────────────────────────────
const TendenciaBadge = ({ pct, tipo }) => {
    const cfg = tipo === 'crecimiento'
        ? { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: TrendingUp,   label: `+${FMTn(pct)}%` }
        : tipo === 'caída'
        ? { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: TrendingDown, label: `${FMTn(pct)}%` }
        : { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: Minus,        label: 'Estable' };
    const { color, bg, icon: Icon, label } = cfg;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: bg, color, fontWeight: 700, fontSize: 12 }}>
            <Icon size={12} /> {label}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────
export default function Analytics() {
    const [periodo, setPeriodo] = useState(30);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [forecast, setForecast]       = useState(null);
    const [ventas, setVentas]           = useState(null);
    const [productos, setProductos]     = useState([]);
    const [clientes, setClientes]       = useState([]);
    const [rentabilidad, setRentabilidad] = useState(null);
    const [cocciones, setCocciones]     = useState([]);

    const loadAll = async (p = periodo, silent = false) => {
        if (!silent) setLoading(true); else setRefreshing(true);
        try {
            const [fRes, vRes, prRes, clRes, rRes, cocRes] = await Promise.all([
                analyticsService.forecastMasa(),
                analyticsService.ventas(p),
                analyticsService.productosTop(p),
                analyticsService.clientesTop(p),
                analyticsService.rentabilidad(p),
                productionService.getCocciones({ limit: 50 }),
            ]);
            setForecast(fRes.data);
            setVentas(vRes.data);
            setProductos(prRes.data);
            setClientes(clRes.data);
            setRentabilidad(rRes.data);
            setCocciones(cocRes.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadAll(periodo); }, [periodo]);

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340, gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: '#ffdd19', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Calculando analítica…</span>
        </div>
    );

    const f = forecast?.forecast;
    const promedios = forecast?.promedios;
    const dowStats = forecast?.por_dia_semana || [];
    const serieDiaria = forecast?.serie_diaria || [];
    const serieVentas = ventas?.serie || [];
    const resumenVentas = ventas?.resumen;

    // Máximo para escala de barras dow
    const maxDow = Math.max(...dowStats.map(d => d.promedio_kg), 1);

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

            {/* ── Header ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Módulo</div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Analítica & Forecasting</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Selector de período */}
                    <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        {PERIODO_OPTIONS.map(opt => (
                            <button key={opt.value} type="button" onClick={() => setPeriodo(opt.value)}
                                style={{ padding: '7px 14px', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                    background: periodo === opt.value ? '#ffdd19' : 'transparent',
                                    color: periodo === opt.value ? '#000' : 'var(--text-muted)',
                                }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => loadAll(periodo, true)} disabled={refreshing}
                        style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 1 — FORECAST DE MASA
            ══════════════════════════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>

                {/* Card recomendación principal */}
                <div className="card" style={{ padding: '20px 22px', borderTop: '3px solid #ffdd19', gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1, minWidth: 240 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,221,25,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <FlaskConical size={24} color="#ffdd19" />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
                                    Recomendación para mañana
                                    {f?.dia_manana && (
                                        <span style={{ marginLeft: 8, color: '#ffdd19', background: 'rgba(255,221,25,0.12)', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>
                                            {f.dia_manana}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 36, fontWeight: 900, color: '#ffdd19', lineHeight: 1, letterSpacing: '-0.02em' }}>
                                    {FMTn(f?.manana_kg)} kg
                                </div>
                                {f?.muestras_dow > 0 && (
                                    <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: 600 }}>
                                        {f.usar_dow
                                            ? `📊 Basado en ${f.muestras_dow} ${f.dia_manana}s históricos · Promedio: ${FMTn(f.promedio_dow)} kg`
                                            : `⚠️ Pocas muestras de ${f.dia_manana}s (${f.muestras_dow}) — usando promedio general`}
                                    </div>
                                )}
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5, maxWidth: 480 }}>
                                    {f?.descripcion}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                            <TendenciaBadge pct={f?.tendencia_pct} tipo={f?.tendencia_tipo} />
                            {forecast?.dia_pico && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                                    Pico: <strong style={{ color: 'var(--text)' }}>{forecast.dia_pico.dia}</strong> — {FMTn(forecast.dia_pico.promedio_kg)} kg
                                </div>
                            )}
                            {forecast?.stock_masa_resumen && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                                    Stock: <strong>{FMTn(forecast.stock_masa_resumen.stock_inventario_kg)} kg</strong>
                                    {forecast.stock_masa_resumen.kg_comprometida > 0 && (
                                        <> · Comprometido: <strong>{FMTn(forecast.stock_masa_resumen.kg_comprometida)} kg</strong></>
                                    )}
                                    {' · '}Disponible:{' '}
                                    <strong style={{ color: forecast.stock_masa_resumen.disponible_kg < (f?.manana_kg * 0.5) ? '#ef4444' : '#10b981' }}>
                                        {FMTn(forecast.stock_masa_resumen.disponible_kg)} kg
                                    </strong>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Promedios móviles */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        {[
                            { label: `Prom. ${f?.dia_manana || 'día'}s históricos`, val: f?.promedio_dow, color: '#ffdd19' },
                            { label: 'Promedio 7d general',  val: promedios?.avg_7d,  color: '#8b5cf6' },
                            { label: 'Promedio 30d general', val: promedios?.avg_30d, color: '#64748b' },
                        ].map(m => (
                            <div key={m.label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{FMTn(m.val)} kg</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Consumo diario (gráfica) + Día de semana */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>

                {/* Gráfica consumo kilos */}
                <div className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Layers size={14} color="#ffdd19" /> Consumo de masa — últimos 30 días (kg)
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={serieDiaria} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradMasa" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor="#ffdd19" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#ffdd19" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="dia_semana" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={4} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                            <Tooltip content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload;
                                return (
                                    <div style={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                                        <div style={{ color: '#94a3b8', fontWeight: 700 }}>{d.fecha} ({d.dia_semana})</div>
                                        <div style={{ color: '#ffdd19', fontWeight: 700 }}>{FMTn(d.kilos)} kg</div>
                                    </div>
                                );
                            }} />
                            <ReferenceLine y={promedios?.avg_7d} stroke="#ffdd19" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'Avg 7d', fill: '#ffdd19', fontSize: 10, position: 'right' }} />
                            <Area type="monotone" dataKey="kilos" stroke="#ffdd19" strokeWidth={2} fill="url(#gradMasa)" name="Masa (kg)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Demanda por día de semana */}
                <div className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Por día de semana</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {dowStats.map(d => (
                            <div key={d.dia}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{d.dia.slice(0, 3)}</span>
                                    <span style={{ color: d.promedio_kg === Math.max(...dowStats.map(x => x.promedio_kg)) ? '#ffdd19' : 'var(--text)', fontWeight: 700 }}>
                                        {FMTn(d.promedio_kg)} kg
                                    </span>
                                </div>
                                <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${(d.promedio_kg / maxDow) * 100}%`, background: d.promedio_kg === maxDow ? '#ffdd19' : '#8b5cf6', borderRadius: 3, transition: 'width 0.4s' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 2 — VENTAS
            ══════════════════════════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Ventas del período" value={FMT(resumenVentas?.total_ventas_cop)} icon={TrendingUp} color="#10b981" />
                <KpiCard label="Pedidos totales"    value={resumenVentas?.total_pedidos}          icon={Package}    color="#8b5cf6" small />
                <KpiCard label="Días con ventas"    value={resumenVentas?.dias_activos}           icon={Layers}     color="#3b82f6" small />
                <KpiCard label="Promedio diario"    value={FMT(resumenVentas?.promedio_diario_cop)} icon={TrendingUp} color="#ffdd19" />
            </div>

            {/* Gráfica ventas diarias */}
            <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={14} color="#10b981" /> Ventas diarias — últimos {periodo} días
                </div>
                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={serieVentas} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="dia_semana" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={Math.floor(periodo / 8)} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                        <Tooltip content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                                <div style={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                                    <div style={{ color: '#94a3b8', fontWeight: 700 }}>{d.fecha} ({d.dia_semana})</div>
                                    <div style={{ color: '#10b981', fontWeight: 700 }}>{FMT(d.ventas_cop)}</div>
                                    <div style={{ color: '#94a3b8' }}>{d.num_pedidos} pedido{d.num_pedidos !== 1 ? 's' : ''}</div>
                                </div>
                            );
                        }} />
                        <Area type="monotone" dataKey="ventas_cop" stroke="#10b981" strokeWidth={2} fill="url(#gradVentas)" name="Ventas" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 3 — PRODUCTOS TOP + CLIENTES TOP
            ══════════════════════════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>

                {/* Productos top */}
                <div className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Package size={14} color="#8b5cf6" /> Productos más vendidos
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={productos.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} hide />
                            <YAxis type="category" dataKey="nombre" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={90}
                                tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v} />
                            <Tooltip content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload;
                                return (
                                    <div style={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                                        <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{d.nombre}</div>
                                        <div style={{ color: '#8b5cf6' }}>{d.unidades} unidades ({d.pct_unidades}%)</div>
                                        <div style={{ color: '#ffdd19' }}>{FMTn(d.masa_kg)} kg masa</div>
                                        <div style={{ color: '#10b981' }}>{FMT(d.ventas_cop)}</div>
                                    </div>
                                );
                            }} />
                            <Bar dataKey="unidades" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: 'var(--text-muted)', fontSize: 10, formatter: v => v }}>
                                {productos.slice(0, 6).map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    {/* Tabla ranking */}
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        {productos.slice(0, 5).map((p, i) => (
                            <div key={p.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ width: 18, height: 18, borderRadius: 5, background: BAR_COLORS[i], fontSize: 10, fontWeight: 900, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6' }}>{p.unidades} u</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#ffdd19' }}>{FMTn(p.masa_kg)} kg</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Clientes top */}
                <div className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={14} color="#3b82f6" /> Clientes frecuentes
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {clientes.map((c, i) => (
                            <div key={c.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: BAR_COLORS[i % BAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#000', flexShrink: 0 }}>
                                    {c.nombre.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.num_pedidos} pedidos · {FMTn(c.masa_kg)} kg</div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{FMT(c.total_cop)}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.pct_ventas}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 3b — COSTOS DE PRODUCCIÓN (COCCIONES)
            ══════════════════════════════════════════════════════════ */}
            {(() => {
                const conCosto = cocciones.filter(c => (c.costo_total || 0) > 0);
                if (conCosto.length === 0) return null;
                const totalCosto  = conCosto.reduce((s, c) => s + Number(c.costo_total), 0);
                const totalMasa   = conCosto.reduce((s, c) => s + Number(c.masa_obtenida_kg || 0), 0);
                const costoPorKg  = totalMasa > 0 ? totalCosto / totalMasa : 0;
                return (
                    <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FlaskConical size={14} color="#ffdd19" /> Costos de producción — cocciones recientes
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                            {[
                                { label: 'Costo total acumulado', val: FMT(totalCosto),            color: 'var(--brand)' },
                                { label: 'Masa total cocinada',   val: `${FMTn(totalMasa)} kg`,    color: '#a78bfa' },
                                { label: 'Costo promedio / kg',   val: `${FMT(costoPorKg)}/kg`,    color: '#ffdd19' },
                                { label: 'Cocciones con costo',   val: `${conCosto.length}`,       color: '#60a5fa' },
                            ].map(({ label, val, color }) => (
                                <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${color}` }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 4 — RENTABILIDAD + ALERTAS
            ══════════════════════════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>

                {/* Rentabilidad */}
                <div className="card" style={{ padding: '16px 18px', borderTop: '3px solid #10b981' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TrendingUp size={14} color="#10b981" /> Rentabilidad estimada — {periodo}d
                    </div>
                    {rentabilidad && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { label: 'Ventas',             val: rentabilidad.ventas_cop,               color: '#10b981' },
                                { label: 'Costo productos',    val: -rentabilidad.costo_produccion_cop,    color: '#ef4444' },
                                { label: 'Gastos directos (insumos)', val: -(rentabilidad.gastos_directos_cop || 0), color: '#f59e0b' },
                                { label: 'Gastos indirectos',  val: -(rentabilidad.gastos_indirectos_cop || 0), color: '#f97316' },
                            ].map(row => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                                    <span style={{ fontWeight: 700, color: row.color, fontSize: 14 }}>{FMT(Math.abs(row.val))}</span>
                                </div>
                            ))}
                            <div style={{ borderTop: '2px solid var(--border)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Margen contable</div>
                                    <div style={{ fontSize: 18, fontWeight: 900, color: (rentabilidad.margen_contable_cop ?? rentabilidad.margen_neto_estimado_cop) >= 0 ? '#10b981' : '#ef4444' }}>
                                        {FMT(rentabilidad.margen_contable_cop ?? rentabilidad.margen_neto_estimado_cop)}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {rentabilidad.margen_contable_pct ?? rentabilidad.margen_neto_pct}% · sin doble conteo
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Margen caja</div>
                                    <div style={{ fontSize: 18, fontWeight: 900, color: (rentabilidad.margen_caja_cop ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                                        {FMT(rentabilidad.margen_caja_cop ?? 0)}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {rentabilidad.margen_caja_pct ?? 0}% · flujo real
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4, opacity: 0.7 }}>
                                Bruto: {rentabilidad.margen_bruto_pct}%
                            </div>
                        </div>
                    )}
                </div>

                {/* Alertas inteligentes */}
                <div className="card" style={{ padding: '16px 18px', borderTop: '3px solid #ef4444' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={14} color="#ef4444" /> Alertas operativas
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(() => {
                            const alertas = [];
                            // Usa disponible_kg = inventario - kg ya despachadas (misma lógica que widget Producción)
                            const totalStockKg = forecast?.stock_masa_resumen?.disponible_kg ?? 0;
                            const forecastKg = f?.manana_kg || 0;

                            if (forecastKg > 0 && totalStockKg < forecastKg * 0.5)
                                alertas.push({ tipo: 'danger', msg: `Stock de masa bajo: ${FMTn(totalStockKg)} kg disponibles vs ${FMTn(forecastKg)} kg recomendadas mañana` });
                            else if (forecastKg > 0 && totalStockKg < forecastKg)
                                alertas.push({ tipo: 'warning', msg: `Stock de masa justo: ${FMTn(totalStockKg)} kg disponibles — considera preparar más` });
                            else if (forecastKg > 0)
                                alertas.push({ tipo: 'ok', msg: `Stock de masa suficiente para mañana (${FMTn(totalStockKg)} kg disponibles)` });

                            if (f?.tendencia_tipo === 'crecimiento' && (f?.tendencia_pct || 0) > 15)
                                alertas.push({ tipo: 'warning', msg: `Demanda creciendo ${FMTn(f.tendencia_pct)}% — considera aumentar producción` });

                            if (f?.tendencia_tipo === 'caída' && Math.abs(f?.tendencia_pct || 0) > 15)
                                alertas.push({ tipo: 'warning', msg: `Demanda cayendo ${FMTn(Math.abs(f.tendencia_pct))}% — revisa cartera de clientes` });

                            if (rentabilidad && rentabilidad.margen_neto_pct < 10)
                                alertas.push({ tipo: 'danger', msg: `Margen neto bajo (${rentabilidad.margen_neto_pct}%) — revisa costos y gastos` });

                            if (alertas.length === 0)
                                alertas.push({ tipo: 'ok', msg: 'Sin alertas críticas — operación estable' });

                            return alertas.map((a, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10,
                                    background: a.tipo === 'danger' ? 'rgba(239,68,68,0.08)' : a.tipo === 'warning' ? 'rgba(255,221,25,0.08)' : 'rgba(16,185,129,0.08)',
                                    border: `1px solid ${a.tipo === 'danger' ? 'rgba(239,68,68,0.25)' : a.tipo === 'warning' ? 'rgba(255,221,25,0.25)' : 'rgba(16,185,129,0.25)'}`,
                                }}>
                                    {a.tipo === 'ok'
                                        ? <CheckCircle size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                                        : <AlertTriangle size={15} style={{ color: a.tipo === 'danger' ? '#ef4444' : '#ffdd19', flexShrink: 0, marginTop: 1 }} />
                                    }
                                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{a.msg}</span>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </div>

        </div>
    );
}

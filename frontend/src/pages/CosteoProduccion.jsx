import { useState, useEffect } from 'react';
import { costosService } from '../services/api';
import { toast } from 'sonner';
import {
    FlaskConical, Flame, Droplets, Layers, TrendingUp, Zap,
    Plus, Trash2, Edit2, X, ChevronDown, ChevronRight,
    AlertCircle, CheckCircle, BarChart2,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const FMT  = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);
const FMTn = (v, d = 2) => Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });

const MES_ACTUAL = new Date().toISOString().slice(0, 7);

const TIPO_CONFIG = {
    gas:   { label: 'Gas',   icon: Flame,    color: '#f97316', unit: 'm³' },
    agua:  { label: 'Agua',  icon: Droplets, color: '#3b82f6', unit: 'm³' },
    luz:   { label: 'Luz',   icon: Layers,   color: '#ffdd19', unit: 'kWh' },
    otro:  { label: 'Otro',  icon: Layers,   color: '#8b5cf6', unit: '—' },
};

const DESGLOSE_COLORS = ['#ffdd19', '#f97316', '#3b82f6', '#facc15', '#10b981', '#8b5cf6'];
const DESGLOSE_KEYS   = ['insumos', 'gas', 'agua', 'luz', 'directos', 'indirectos'];
const DESGLOSE_LABELS = ['Insumos', 'Gas', 'Agua', 'Luz', 'Directos', 'Indirectos'];

// ── Modal genérico ─────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
    if (!open) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="card" style={{ width: '100%', maxWidth: 480, margin: 0, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={18} />
                </button>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16, paddingRight: 24 }}>{title}</div>
                {children}
            </div>
        </div>
    );
}

// ── Card KPI ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = '#ffdd19', icon: Icon }) {
    return (
        <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{label}</span>
                {Icon && <Icon size={15} style={{ color, opacity: 0.7 }} />}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
        </div>
    );
}

// ── Barra de participación ─────────────────────────────────────────────────
function BarraDesglose({ pct, color, label, monto }) {
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                <span style={{ fontWeight: 700, color }}>{FMT(monto)} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({FMTn(pct, 1)}%)</span></span>
            </div>
            <div style={{ height: 7, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────
export default function CosteoProduccion() {
    const [periodo, setPeriodo]         = useState(MES_ACTUAL);
    const [indicadores, setIndicadores] = useState(null);
    const [historial, setHistorial]     = useState([]);
    const [facturas, setFacturas]       = useState([]);
    const [loading, setLoading]         = useState(true);

    // Modal factura
    const [modalFactura, setModalFactura] = useState(false);
    const [editFactura, setEditFactura]   = useState(null);
    const [fForm, setFForm] = useState({ tipo: 'gas', periodo: MES_ACTUAL, valor: '', consumo: '', unidad: 'm3', notas: '' });

    // Modal consumos proceso
    const [modalConsumos, setModalConsumos] = useState(null); // proceso obj
    const [cForm, setCForm] = useState({ consumo_gas_m3: '', consumo_agua_m3: '' });

    // Detalle proceso expandido
    const [expandido, setExpandido] = useState(null);
    const [detalle, setDetalle]     = useState({});

    const loadAll = async () => {
        setLoading(true);
        try {
            const [indRes, histRes, factRes] = await Promise.all([
                costosService.getIndicadores(periodo),
                costosService.getHistorial(60),
                costosService.getFacturas({ periodo }),
            ]);
            setIndicadores(indRes.data);
            setHistorial(histRes.data);
            setFacturas(factRes.data);
        } catch (e) { toast.error('Error cargando datos'); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadAll(); }, [periodo]);

    const loadDetalle = async (id) => {
        if (detalle[id]) { setExpandido(expandido === id ? null : id); return; }
        try {
            const res = await costosService.getCostoProceso(id);
            setDetalle(prev => ({ ...prev, [id]: res.data }));
            setExpandido(id);
        } catch { toast.error('Error cargando detalle'); }
    };

    // ── CRUD Facturas ────────────────────────────────────────
    const abrirModalFactura = (f = null) => {
        setEditFactura(f);
        setFForm(f ? { tipo: f.tipo, periodo: f.periodo, valor: f.valor, consumo: f.consumo || '', unidad: f.unidad, notas: f.notas || '' }
                   : { tipo: 'gas', periodo, valor: '', consumo: '', unidad: 'm3', notas: '' });
        setModalFactura(true);
    };

    const guardarFactura = async () => {
        if (!fForm.valor) { toast.warning('Ingresa el valor de la factura'); return; }
        try {
            const payload = { ...fForm, valor: parseFloat(fForm.valor), consumo: fForm.consumo ? parseFloat(fForm.consumo) : null };
            if (editFactura) await costosService.actualizarFactura(editFactura.id, payload);
            else             await costosService.crearFactura(payload);
            toast.success(editFactura ? 'Factura actualizada' : 'Factura registrada');
            setModalFactura(false);
            loadAll();
        } catch { toast.error('Error guardando factura'); }
    };

    const eliminarFactura = async (id) => {
        if (!confirm('¿Eliminar esta factura?')) return;
        try { await costosService.eliminarFactura(id); loadAll(); }
        catch { toast.error('Error eliminando'); }
    };

    // ── Consumos proceso ─────────────────────────────────────
    const abrirConsumos = (p) => {
        setModalConsumos(p);
        setCForm({ consumo_gas_m3: p.desglose?.gas?.consumo_m3 || '', consumo_agua_m3: p.desglose?.agua?.consumo_m3 || '' });
    };

    const guardarConsumos = async () => {
        try {
            await costosService.patchConsumos(modalConsumos.coccion_id, {
                consumo_gas_m3:  cForm.consumo_gas_m3  ? parseFloat(cForm.consumo_gas_m3)  : null,
                consumo_agua_m3: cForm.consumo_agua_m3 ? parseFloat(cForm.consumo_agua_m3) : null,
            });
            toast.success('Consumos actualizados');
            setModalConsumos(null);
            // Limpiar caché detalle para que recalcule
            setDetalle(prev => { const n = {...prev}; delete n[modalConsumos.coccion_id]; return n; });
            loadAll();
        } catch { toast.error('Error guardando consumos'); }
    };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: '#ffdd19', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Calculando costos…</span>
        </div>
    );

    const ind = indicadores;
    const historialFiltrado = historial.filter(h => h.periodo === periodo);

    // Génera meses para selector (últimos 12)
    const meses = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        return d.toISOString().slice(0, 7);
    });

    return (
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>

            {/* ── Header ──────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Producción</div>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Costeo de Producción</h1>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select value={periodo} onChange={e => setPeriodo(e.target.value)}
                        className="form-control" style={{ height: 38, fontWeight: 700, fontSize: 14, width: 140 }}>
                        {meses.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button onClick={() => abrirModalFactura()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#ffdd19', color: '#151515', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                        <Plus size={15} /> Factura Servicio
                    </button>
                </div>
            </div>

            {/* ── KPIs ────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
                <KpiCard label="Costo promedio / kg" value={`${FMT(ind?.costo_promedio_kg)}`} icon={BarChart2} color="#ffdd19"
                    sub={`${ind?.produccion?.total_kg || 0} kg producidos`} />
                <KpiCard label="Directos / kg" value={FMT(ind?.prorrateo_mes?.costo_directo_kg)} icon={TrendingUp} color="#10b981"
                    sub={`Total: ${FMT(ind?.prorrateo_mes?.total_directos_mes)}`} />
                <KpiCard label="Indirectos / kg" value={FMT(ind?.prorrateo_mes?.costo_indirecto_kg)} icon={Layers} color="#8b5cf6"
                    sub={`Total: ${FMT(ind?.prorrateo_mes?.total_indirectos_mes)}`} />
                <KpiCard label="Gas / kg" value={FMT(ind?.prorrateo_mes?.costo_gas_kg)} icon={Flame} color="#f97316"
                    sub={`Factura: ${FMT(ind?.prorrateo_mes?.total_gas_mes)}`} />
                <KpiCard label="Agua / kg" value={FMT(ind?.prorrateo_mes?.costo_agua_kg)} icon={Droplets} color="#3b82f6"
                    sub={`Factura: ${FMT(ind?.prorrateo_mes?.total_agua_mes)}`} />
                <KpiCard label="Luz / kg" value={FMT(ind?.prorrateo_mes?.costo_luz_kg)} icon={Zap} color="#facc15"
                    sub={`Factura: ${FMT(ind?.prorrateo_mes?.total_luz_mes)}`} />
            </div>

            {/* ── Facturas registradas + historial ─────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>

                {/* Facturas de servicios */}
                <div className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Flame size={14} color="#f97316" /> Facturas — {periodo}
                        </span>
                        <button onClick={() => abrirModalFactura()}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffdd19', display: 'flex' }}>
                            <Plus size={16} />
                        </button>
                    </div>

                    {facturas.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            <AlertCircle size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                            <div>Sin facturas para este período</div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>Sin facturas, el costo de servicios será 0</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {facturas.map(f => {
                                const cfg = TIPO_CONFIG[f.tipo] || TIPO_CONFIG.otro;
                                const Icon = cfg.icon;
                                return (
                                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${cfg.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Icon size={15} color={cfg.color} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{cfg.label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {f.consumo ? `${FMTn(f.consumo)} ${cfg.unit}` : 'Sin consumo'}
                                                {f.costo_unitario ? ` · ${FMT(f.costo_unitario)}/${cfg.unit}` : ''}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: cfg.color }}>{FMT(f.valor)}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                            <button onClick={() => abrirModalFactura(f)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                                <Edit2 size={13} />
                                            </button>
                                            <button onClick={() => eliminarFactura(f.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Historial de cocciones con costos */}
                <div className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FlaskConical size={14} color="#ffdd19" /> Cocciones del período
                    </div>

                    {historialFiltrado.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            Sin producciones registradas en {periodo}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {historialFiltrado.map(p => {
                                const open = expandido === p.coccion_id;
                                const d = detalle[p.coccion_id];
                                const tieneServicios = p.desglose.gas.total > 0 || p.desglose.agua.total > 0;
                                return (
                                    <div key={p.coccion_id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                                        {/* Fila resumen */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: open ? 'rgba(255,221,25,0.05)' : 'var(--bg-secondary)', cursor: 'pointer' }}
                                            onClick={() => loadDetalle(p.coccion_id)}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: tieneServicios ? '#10b981' : '#64748b', flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                                                    Cocción #{p.coccion_id} — {p.fecha}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {FMTn(p.kg_producidas)} kg producidos · Rend. {FMTn(p.rendimiento_pct)}%
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: 15, fontWeight: 900, color: '#ffdd19' }}>{FMT(p.costo_total)}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{FMT(p.costo_por_kg)}  / kg</div>
                                            </div>
                                            {open ? <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                  : <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                                        </div>

                                        {/* Detalle expandido */}
                                        {open && d && (
                                            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                                {/* Barras desglose */}
                                                <div>
                                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Desglose de costo</div>
                                                    {DESGLOSE_KEYS.map((k, i) => (
                                                        <BarraDesglose key={k} label={DESGLOSE_LABELS[i]} color={DESGLOSE_COLORS[i]}
                                                            pct={d.pct[k]} monto={d.desglose[k].total} />
                                                    ))}
                                                    <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(255,221,25,0.06)', borderRadius: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                                                        Gas, agua e indirectos prorrateados por kg del mes ({FMTn(d.desglose.gas.total_kg_mes, 1)} kg total)
                                                    </div>
                                                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700 }}>Costo total</span>
                                                        <span style={{ fontSize: 14, fontWeight: 900, color: '#ffdd19' }}>{FMT(d.costo_total)}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Costo  / kg</span>
                                                        <span style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{FMT(d.costo_por_kg)}</span>
                                                    </div>
                                                </div>
                                                {/* Mini torta */}
                                                <div>
                                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Participación</div>
                                                    <ResponsiveContainer width="100%" height={140}>
                                                        <PieChart>
                                                            <Pie data={DESGLOSE_KEYS.map((k, i) => ({ name: DESGLOSE_LABELS[i], value: d.desglose[k].total }))}
                                                                cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                                                                dataKey="value" paddingAngle={2}>
                                                                {DESGLOSE_KEYS.map((k, i) => <Cell key={k} fill={DESGLOSE_COLORS[i]} />)}
                                                            </Pie>
                                                            <Tooltip formatter={(v) => FMT(v)} contentStyle={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                    {/* Leyenda */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                                        {DESGLOSE_KEYS.map((k, i) => (
                                                            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                                                                <div style={{ width: 8, height: 8, borderRadius: 2, background: DESGLOSE_COLORS[i], flexShrink: 0 }} />
                                                                <span style={{ color: 'var(--text-muted)' }}>{DESGLOSE_LABELS[i]}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal: Factura de servicio ─────────────────────── */}
            <Modal open={modalFactura} onClose={() => setModalFactura(false)}
                title={editFactura ? 'Editar Factura' : 'Registrar Factura de Servicio'}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Tipo *</label>
                            <select value={fForm.tipo} onChange={e => setFForm(p => ({ ...p, tipo: e.target.value, unidad: e.target.value === 'luz' ? 'kWh' : 'm3' }))}
                                className="form-control" style={{ height: 40 }}>
                                <option value="gas">Gas</option>
                                <option value="agua">Agua</option>
                                <option value="luz">Luz</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Período *</label>
                            <input type="month" value={fForm.periodo} onChange={e => setFForm(p => ({ ...p, periodo: e.target.value }))}
                                className="form-control" style={{ height: 40 }} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Valor factura *</label>
                            <input type="number" value={fForm.valor} onChange={e => setFForm(p => ({ ...p, valor: e.target.value }))}
                                placeholder="Ej: 200000" className="form-control" style={{ height: 40 }} />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                                Consumo ({fForm.unidad})
                            </label>
                            <input type="number" value={fForm.consumo} onChange={e => setFForm(p => ({ ...p, consumo: e.target.value }))}
                                placeholder="Ej: 100" className="form-control" style={{ height: 40 }} />
                        </div>
                    </div>
                    {fForm.valor && fForm.consumo && parseFloat(fForm.consumo) > 0 && (
                        <div style={{ padding: '10px 14px', background: 'rgba(255,221,25,0.08)', border: '1px solid rgba(255,221,25,0.25)', borderRadius: 10, fontSize: 13 }}>
                            Costo unitario: <strong style={{ color: '#ffdd19' }}>{FMT(parseFloat(fForm.valor) / parseFloat(fForm.consumo))} / {fForm.unidad}</strong>
                        </div>
                    )}
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Notas</label>
                        <input type="text" value={fForm.notas} onChange={e => setFForm(p => ({ ...p, notas: e.target.value }))}
                            placeholder="Número de factura, proveedor…" className="form-control" style={{ height: 40 }} />
                    </div>
                    <button onClick={guardarFactura}
                        style={{ padding: '11px', background: '#ffdd19', color: '#151515', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginTop: 4 }}>
                        {editFactura ? 'Actualizar' : 'Registrar Factura'}
                    </button>
                </div>
            </Modal>

            {/* ── Modal: Consumos Gas/Agua del proceso ──────────── */}
            <Modal open={!!modalConsumos} onClose={() => setModalConsumos(null)}
                title={`Consumos — Cocción #${modalConsumos?.coccion_id}`}>
                {modalConsumos && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                            {FMTn(modalConsumos.kg_producidas)} kg producidos · {modalConsumos.fecha}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#f97316', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                                    <Flame size={11} /> Gas consumido (m³)
                                </label>
                                <input type="number" step="0.001" value={cForm.consumo_gas_m3}
                                    onChange={e => setCForm(p => ({ ...p, consumo_gas_m3: e.target.value }))}
                                    placeholder="Ej: 12.5" className="form-control" style={{ height: 42 }} />
                                {indicadores?.costo_unitario_gas > 0 && cForm.consumo_gas_m3 && (
                                    <div style={{ fontSize: 12, color: '#f97316', marginTop: 4 }}>
                                        = {FMT(parseFloat(cForm.consumo_gas_m3) * indicadores.costo_unitario_gas)}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                                    <Droplets size={11} /> Agua consumida (m³)
                                </label>
                                <input type="number" step="0.001" value={cForm.consumo_agua_m3}
                                    onChange={e => setCForm(p => ({ ...p, consumo_agua_m3: e.target.value }))}
                                    placeholder="Ej: 5.0" className="form-control" style={{ height: 42 }} />
                                {indicadores?.costo_unitario_agua > 0 && cForm.consumo_agua_m3 && (
                                    <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>
                                        = {FMT(parseFloat(cForm.consumo_agua_m3) * indicadores.costo_unitario_agua)}
                                    </div>
                                )}
                            </div>
                        </div>
                        {(!indicadores?.costo_unitario_gas && !indicadores?.costo_unitario_agua) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,221,25,0.08)', border: '1px solid rgba(255,221,25,0.25)', borderRadius: 10, fontSize: 12, color: '#ffdd19' }}>
                                <AlertCircle size={14} />
                                Registra primero las facturas de gas y agua para que el costo se calcule correctamente.
                            </div>
                        )}
                        <button onClick={guardarConsumos}
                            style={{ padding: '11px', background: '#ffdd19', color: '#151515', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                            Guardar Consumos
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
}

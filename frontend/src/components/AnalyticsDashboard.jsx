import { useEffect, useState } from 'react';
import { BarChart2, Sparkles, Calendar, TrendingUp, ShoppingBag, Clock, AlertCircle } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line,
    XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import api from '../services/api';

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0);
const fmtN = (n) => new Intl.NumberFormat('es-CO').format(n ?? 0);
const pluralDia = (d) => !d ? '' : (d.endsWith('s') ? d : `${d}s`);

const CARD_BG     = 'rgba(255,255,255,0.03)';
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)';
const ACCENT      = '#ffdd19';
const ACCENT_2    = '#ffa20f';
const TXT_MUTED   = 'rgba(255,255,255,0.55)';
const TXT_LABEL   = 'rgba(255,255,255,0.35)';

function Section({ icon: Icon, title, children, right }) {
    return (
        <section style={{ marginBottom: 24 }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 12,
            }}>
                <Icon size={18} style={{ color: ACCENT }} />
                <h3 style={{
                    margin: 0,
                    fontSize: 14, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: ACCENT,
                }}>{title}</h3>
                {right && <div style={{ marginLeft: 'auto', fontSize: 12, color: TXT_MUTED }}>{right}</div>}
            </div>
            {children}
        </section>
    );
}

function Stat({ label, value, hint, color }) {
    return (
        <div style={{
            background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: '14px 16px',
        }}>
            <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: TXT_LABEL, marginBottom: 6,
            }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: color || '#fff', lineHeight: 1 }}>{value}</div>
            {hint && <div style={{ fontSize: 11, color: TXT_MUTED, marginTop: 4 }}>{hint}</div>}
        </div>
    );
}

function Banner({ dias }) {
    if (dias === null || dias === undefined) return null;
    if (dias >= 7) return null;
    const critico = dias <= 3;
    return (
        <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
            padding: '10px 14px',
            background: critico ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)',
            border: `1px solid ${critico ? 'rgba(239,68,68,0.30)' : 'rgba(245,158,11,0.30)'}`,
            borderRadius: 10, marginBottom: 18,
            color: critico ? '#fca5a5' : '#fbbf24',
            fontSize: 13, fontWeight: 600,
        }}>
            <AlertCircle size={16} />
            <span>
                Tu suscripción al módulo analítica {dias === 0 ? 'expira hoy' : `expira en ${dias} ${dias === 1 ? 'día' : 'días'}`}.
                Contacta al administrador para renovarla.
            </span>
        </div>
    );
}

export default function AnalyticsDashboard({ status }) {
    const [dashboard, setDashboard] = useState(null);
    const [dow, setDow]             = useState(null);
    const [top, setTop]             = useState(null);
    const [reco, setReco]           = useState(null);
    const [err, setErr]             = useState('');
    const [loading, setLoading]     = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.get('/portal/analytics/dashboard?dias=30'),
            api.get('/portal/analytics/ventas-por-dow?dias=90'),
            api.get('/portal/analytics/productos-top?dias=30&limit=8'),
            api.get('/portal/analytics/recomendaciones'),
        ])
            .then(([d, w, t, r]) => {
                setDashboard(d.data);
                setDow(w.data);
                setTop(t.data);
                setReco(r.data);
            })
            .catch(e => setErr(e?.response?.data?.detail || 'Error cargando analítica'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 64 }}>
                <div className="spinner" />
            </div>
        );
    }

    if (err) {
        return (
            <div style={{
                padding: 18, margin: '12px 0', borderRadius: 10,
                background: 'rgba(239,68,68,0.08)', color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.25)',
            }}>
                {err}
            </div>
        );
    }

    return (
        <div>
            <Banner dias={status?.dias_restantes} />

            {/* ── RESUMEN ─────────────────────────────────────────── */}
            <Section icon={BarChart2} title="Resumen últimos 30 días">
                <div style={{
                    display: 'grid', gap: 12,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                }}>
                    <Stat label="Pedidos"      value={fmtN(dashboard?.resumen.total_pedidos)} />
                    <Stat label="Compras"      value={fmt(dashboard?.resumen.total_ventas_cop)} color={ACCENT} />
                    <Stat label="Ticket promedio" value={fmt(dashboard?.resumen.ticket_promedio_cop)} />
                    <Stat label="Días activos" value={fmtN(dashboard?.resumen.dias_activos)} hint="días con pedidos" />
                    <Stat label="Productos"    value={fmtN(dashboard?.resumen.productos_distintos)} hint="distintos comprados" />
                </div>
            </Section>

            {/* ── TENDENCIA DIARIA ────────────────────────────────── */}
            <Section icon={TrendingUp} title="Tendencia diaria de compras">
                <div style={{
                    background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: 12,
                }}>
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={dashboard?.serie_diaria || []}>
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="dia_semana" tick={{ fill: TXT_MUTED, fontSize: 10 }} />
                            <YAxis tick={{ fill: TXT_MUTED, fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                            <Tooltip
                                contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,221,25,0.25)', borderRadius: 8 }}
                                labelStyle={{ color: ACCENT }}
                                formatter={(v) => fmt(v)}
                            />
                            <Line type="monotone" dataKey="ventas_cop" stroke={ACCENT} strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Section>

            {/* ── DÍAS DE SEMANA ──────────────────────────────────── */}
            <Section icon={Calendar} title="Por día de semana" right={dow?.periodo_dias ? `Últimos ${dow.periodo_dias} días` : ''}>
                <div style={{
                    background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: 12,
                }}>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={dow?.por_dia_semana || []}>
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="dia_corto" tick={{ fill: TXT_MUTED, fontSize: 11 }} />
                            <YAxis tick={{ fill: TXT_MUTED, fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                            <Tooltip
                                contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,221,25,0.25)', borderRadius: 8 }}
                                labelStyle={{ color: ACCENT }}
                                formatter={(v) => fmt(v)}
                            />
                            <Bar dataKey="promedio_ventas" fill={ACCENT} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                {(dow?.dia_pico || dow?.dia_bajo) && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                        {dow.dia_pico && (
                            <div style={{
                                padding: '8px 14px', borderRadius: 8,
                                background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)',
                                fontSize: 12, color: '#86efac',
                            }}>
                                📈 Día pico: <b>{dow.dia_pico.dia}</b> (promedio {fmt(dow.dia_pico.promedio_ventas)})
                            </div>
                        )}
                        {dow.dia_bajo && dow.dia_bajo.dow !== dow.dia_pico?.dow && (
                            <div style={{
                                padding: '8px 14px', borderRadius: 8,
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                                fontSize: 12, color: TXT_MUTED,
                            }}>
                                📉 Día bajo: <b>{dow.dia_bajo.dia}</b> (promedio {fmt(dow.dia_bajo.promedio_ventas)})
                            </div>
                        )}
                    </div>
                )}
            </Section>

            {/* ── TOP PRODUCTOS ───────────────────────────────────── */}
            <Section icon={ShoppingBag} title="Productos que más compras" right="Últimos 30 días">
                <div style={{
                    background: CARD_BG, border: CARD_BORDER, borderRadius: 12, overflow: 'hidden',
                }}>
                    {(top?.productos || []).length === 0 ? (
                        <div style={{ padding: 18, color: TXT_MUTED, fontSize: 13 }}>Aún no hay datos suficientes.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Producto', 'Unidades', 'Pedidos', 'Compras', '% del total'].map(h => (
                                        <th key={h} style={{
                                            textAlign: 'left', padding: '10px 14px',
                                            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                                            textTransform: 'uppercase', color: TXT_LABEL,
                                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {top.productos.map((p, i) => (
                                    <tr key={p.id} style={{ borderBottom: i === top.productos.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#fff', fontWeight: 600 }}>
                                            {p.nombre}
                                            {p.codigo && <span style={{ marginLeft: 6, fontSize: 11, color: TXT_MUTED }}>({p.codigo})</span>}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#fff' }}>{fmtN(p.unidades)}</td>
                                        <td style={{ padding: '10px 14px', fontSize: 13, color: TXT_MUTED }}>{fmtN(p.pedidos)}</td>
                                        <td style={{ padding: '10px 14px', fontSize: 13, color: ACCENT, fontWeight: 700 }}>{fmt(p.ventas_cop)}</td>
                                        <td style={{ padding: '10px 14px', fontSize: 12, color: TXT_MUTED }}>{p.pct_ventas}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Section>

            {/* ── RECOMENDACIONES ─────────────────────────────────── */}
            <Section icon={Sparkles} title={`Recomendaciones para mañana (${reco?.dia_semana || '—'})`}>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(255,221,25,0.06) 0%, rgba(255,162,15,0.04) 100%)',
                    border: '1px solid rgba(255,221,25,0.22)',
                    borderRadius: 12, padding: 14, marginBottom: 12,
                    fontSize: 12.5, color: TXT_MUTED, lineHeight: 1.5,
                }}>
                    <Clock size={13} style={{ color: ACCENT, marginRight: 6, verticalAlign: 'middle' }} />
                    {reco?.descripcion}
                </div>

                {(reco?.recomendaciones || []).length === 0 ? (
                    <div style={{
                        background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: 18,
                        color: TXT_MUTED, fontSize: 13, textAlign: 'center',
                    }}>
                        Aún no tenemos suficientes muestras de tus <b>{pluralDia(reco?.dia_semana)}</b> históricos.
                        Se necesitan al menos {reco?.min_muestras_requeridas || 2} para generar una sugerencia confiable.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        {reco.recomendaciones.map(r => {
                            const colorConf = r.confianza === 'alta' ? '#22c55e'
                                : r.confianza === 'media' ? ACCENT_2
                                : TXT_MUTED;
                            return (
                                <div key={r.producto_id} style={{
                                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                                    background: CARD_BG, border: CARD_BORDER, borderRadius: 10,
                                    padding: '12px 16px',
                                }}>
                                    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>
                                            {r.nombre}
                                            {r.codigo && <span style={{ marginLeft: 6, fontSize: 11, color: TXT_MUTED, fontWeight: 400 }}>({r.codigo})</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: TXT_MUTED, marginTop: 2 }}>
                                            Últimos {pluralDia(reco.dia_semana)}: promedio {fmtN(r.promedio)} · última compra {fmtN(r.ultima_compra)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 11, color: TXT_LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sugerido</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>{fmtN(r.sugerido)}</div>
                                    </div>
                                    <div style={{
                                        padding: '4px 10px', borderRadius: 20,
                                        fontSize: 10, fontWeight: 700,
                                        background: colorConf + '20', color: colorConf,
                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                    }}>
                                        {r.confianza} · {r.muestras} muestras
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {(reco?.productos_insuficientes || []).length > 0 && (
                    <div style={{
                        marginTop: 10, fontSize: 12, color: TXT_LABEL,
                        padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                        border: '1px dashed rgba(255,255,255,0.08)',
                    }}>
                        <b>Sin datos suficientes aún:</b>{' '}
                        {reco.productos_insuficientes.map(p => p.nombre).join(' · ')}
                    </div>
                )}
            </Section>
        </div>
    );
}

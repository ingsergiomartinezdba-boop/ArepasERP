import { useState, useEffect, useMemo } from 'react';
import { ordersService, reportsService } from '../services/api';
import { RefreshCw, Copy, Plus, Edit, X, ChevronDown, ChevronUp, MessageCircle, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { todayBogota } from '../utils/formatters';
import DateInput from '../components/DateInput';

const FMT = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

const STATUS_CFG = {
    pendiente:   { color: '#818cf8', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.35)',  label: 'Pendiente'   },
    por_cobrar:  { color: '#ffdd19', bg: 'rgba(255,221,25,0.12)',  border: 'rgba(255,221,25,0.35)',  label: 'Por Cobrar'  },
    pagado:      { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  label: 'Pagado'      },
    cancelado:   { color: '#6b7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.3)',  label: 'Cancelado'   },
};

export default function OrdersList() {
    const navigate = useNavigate();
    const [orders, setOrders]           = useState([]);
    const [loading, setLoading]         = useState(true);
    const [summary, setSummary]         = useState('');
    const [date, setDate]               = useState(todayBogota());
    const [paymentMethods, setPaymentMethods] = useState([]);

    // Status modal
    const [statusModal, setStatusModal]   = useState({ open: false, orderId: null, currentStatus: '' });
    const [selectedMethod, setSelectedMethod] = useState('');
    const [isPagadoExpanded, setIsPagadoExpanded] = useState(false);

    // WhatsApp panel
    const [showWA, setShowWA]           = useState(false);
    const [selectedOrders, setSelectedOrders]     = useState(new Set());
    const [selectedDetalles, setSelectedDetalles] = useState({});

    // Expand/collapse order items
    const [expandedOrder, setExpandedOrder] = useState(null);

    useEffect(() => {
        loadData();
        loadPaymentMethods();
    }, [date]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [ordersRes, reportRes] = await Promise.all([
                ordersService.getAll({ start_date: date, end_date: date, limit: 100 }),
                reportsService.getWhatsappSummary(date),
            ]);
            setOrders(ordersRes.data);
            setSummary(reportRes.data.text);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadPaymentMethods = async () => {
        try {
            const res = await import('../services/api').then(m => m.paymentMethodsService.getAll());
            setPaymentMethods(res.data.filter(m => m.activo !== false));
        } catch { setPaymentMethods([]); }
    };

    // Stats
    const stats = useMemo(() => {
        const activos = orders.filter(o => o.estado !== 'cancelado');
        return {
            total:      orders.length,
            activos:    activos.length,
            ventas:     activos.reduce((s, o) => s + o.total, 0),
            pendientes: orders.filter(o => o.estado === 'pendiente').length,
            porCobrar:  orders.filter(o => o.estado === 'por_cobrar').length,
            pagados:    orders.filter(o => o.estado === 'pagado').length,
        };
    }, [orders]);

    // WhatsApp
    const contactMap = {};
    orders.filter(o => selectedOrders.has(o.id)).forEach(o => {
        const detalles = o.cliente_detalles || [];
        const idx = selectedDetalles[o.id] ?? 0;
        const d = detalles[idx];
        const tel = d?.telefono || o.cliente_telefono;
        const dir = d?.direccion || o.cliente_direccion;
        const mapsUrl = d?.maps_url || o.cliente_maps_url ||
            (o.cliente_lat && o.cliente_lng ? `https://maps.google.com/?q=${o.cliente_lat},${o.cliente_lng}` : null);
        const lines = [tel ? `📞 ${tel}` : null, dir ? `📍 ${dir}` : null, mapsUrl ? `🗺️ ${mapsUrl}` : null].filter(Boolean).join('\n');
        if (lines) contactMap[o.cliente_nombre] = lines;
    });

    const buildFullReport = () => {
        if (!summary) return '';
        if (!Object.keys(contactMap).length) return summary;
        return summary.split('\n\n').map(block => {
            const m = block.split('\n')[0].match(/^\*([^*]+)\*/);
            if (m && contactMap[m[1]]) return `${block}\n${contactMap[m[1]]}`;
            return block;
        }).join('\n\n');
    };

    const copyToClipboard = () => {
        const text = buildFullReport() || summary;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => toast.success('Reporte copiado'));
        } else {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.focus(); ta.select();
            try { document.execCommand('copy'); toast.success('Reporte copiado'); }
            catch { toast.error('No se pudo copiar'); }
            document.body.removeChild(ta);
        }
    };

    const handleStatusClick = (order) => {
        setStatusModal({ open: true, orderId: order.id, currentStatus: order.estado });
        setSelectedMethod(''); setIsPagadoExpanded(false);
    };

    const confirmStatusChange = async (newStatus) => {
        if (newStatus === 'pagado' && !selectedMethod) { toast.warning('Selecciona un medio de pago'); return; }
        try {
            await ordersService.updateStatus(statusModal.orderId, {
                estado: newStatus,
                medio_pago_id: newStatus === 'pagado' ? parseInt(selectedMethod) : null,
            });
            setStatusModal({ open: false, orderId: null, currentStatus: '' });
            setIsPagadoExpanded(false);
            loadData();
        } catch { toast.error('Error al actualizar estado'); }
    };

    const toggleOrderSelect = (id) => {
        setSelectedOrders(prev => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); setSelectedDetalles(d => { const n = { ...d }; delete n[id]; return n; }); }
            else next.add(id);
            return next;
        });
    };

    return (
        <div>
            {/* ── Header ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Pedidos del Día</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DateInput value={date} onChange={setDate} height={36} />
                    <button onClick={loadData} className="btn btn-secondary" style={{ width: 36, height: 36, padding: 0 }} title="Actualizar">
                        <RefreshCw size={15} />
                    </button>
                    <button onClick={() => navigate('/orders/new')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 36, fontSize: 13, fontWeight: 700 }}>
                        <Plus size={15} /> Nuevo
                    </button>
                </div>
            </div>

            {/* ── Stats bar ──────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: '1rem' }}>
                {[
                    { label: 'Total vendido', val: FMT(stats.ventas), color: '#10b981' },
                    { label: 'Pedidos',        val: stats.activos,    color: '#818cf8' },
                    { label: 'Pendientes',     val: stats.pendientes, color: '#ffdd19' },
                    { label: 'Por cobrar',     val: stats.porCobrar,  color: '#ffdd19' },
                    { label: 'Pagados',        val: stats.pagados,    color: '#10b981' },
                ].map(({ label, val, color }) => (
                    <div key={label} className="card" style={{ marginBottom: 0, padding: '10px 12px', borderTop: `3px solid ${color}` }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color }}>{val}</div>
                    </div>
                ))}
            </div>

            {/* ── Orders list ────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Pedidos</h2>
                {!loading && orders.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 8px', color: 'var(--text-muted)' }}>{orders.length}</span>
                )}
            </div>
            {loading ? (
                <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Cargando pedidos…</div>
            ) : orders.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                    <Package size={32} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No hay pedidos para esta fecha</div>
                    <button onClick={() => navigate('/orders/new')} className="btn btn-primary" style={{ marginTop: 16, width: 'auto', padding: '8px 20px' }}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Crear pedido
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 8, marginBottom: '1rem' }}>
                    {orders.map(order => {
                        const cfg = STATUS_CFG[order.estado] || STATUS_CFG.pendiente;
                        const isExpanded = expandedOrder === order.id;
                        const isSelected = selectedOrders.has(order.id);
                        return (
                            <div key={order.id} className="card" style={{
                                marginBottom: 0, padding: 0, overflow: 'hidden',
                                borderLeft: `4px solid ${cfg.color}`,
                                background: isSelected ? 'rgba(99,102,241,0.05)' : undefined,
                                outline: isSelected ? '1px solid rgba(99,102,241,0.3)' : undefined,
                            }}>
                                {/* Main row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                                    {/* Checkbox para WhatsApp */}
                                    {showWA && (
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleOrderSelect(order.id)}
                                            style={{ width: 15, height: 15, accentColor: 'var(--brand)', cursor: 'pointer', flexShrink: 0 }} />
                                    )}

                                    {/* Client + items preview */}
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 800, fontSize: 15 }}>{order.cliente_nombre}</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>#{order.id}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {order.items.map(i => `${i.cantidad}× ${i.producto_nombre}`).join('  ·  ')}
                                        </div>
                                    </div>

                                    {/* Right: total + status + actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                        <span style={{ fontWeight: 800, fontSize: 15, color: '#10b981' }}>{FMT(order.total)}</span>

                                        <button onClick={() => handleStatusClick(order)} style={{
                                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                            background: cfg.bg, border: `1.5px solid ${cfg.border}`, color: cfg.color,
                                            cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em',
                                        }}>
                                            {cfg.label}
                                        </button>

                                        <button onClick={() => navigate(`/orders/${order.id}/edit`)}
                                            style={{ padding: '5px 8px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                                            title="Editar">
                                            <Edit size={13} />
                                        </button>

                                        <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                            style={{ padding: '5px 6px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                                            title={isExpanded ? 'Ocultar detalle' : 'Ver detalle'}>
                                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px 12px', background: 'rgba(0,0,0,0.15)' }}>
                                        {order.items.map((item, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderBottom: idx < order.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>{item.cantidad} × {item.producto_nombre}</span>
                                                <span style={{ fontWeight: 600 }}>{FMT(item.subtotal)}</span>
                                            </div>
                                        ))}
                                        {order.valor_domicilio > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 2 }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Domicilio</span>
                                                <span>{FMT(order.valor_domicilio)}</span>
                                            </div>
                                        )}
                                        {order.observaciones && (
                                            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>📝 {order.observaciones}</div>
                                        )}
                                        {showWA && isSelected && (order.cliente_detalles?.length > 1) && (
                                            <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(99,102,241,0.1)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)' }}>
                                                <label style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>📍 ¿Qué dirección incluir?</label>
                                                <select value={selectedDetalles[order.id] ?? 0} onChange={e => setSelectedDetalles(d => ({ ...d, [order.id]: Number(e.target.value) }))}
                                                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--primary)', color: 'white', width: '100%' }}>
                                                    {order.cliente_detalles.map((det, i) => (
                                                        <option key={det.id} value={i}>{det.etiqueta}{det.direccion ? ` — ${det.direccion}` : ''}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── WhatsApp panel ─────────────────────────────────────── */}
            <div className="card" style={{ marginBottom: 0 }}>
                <button onClick={() => setShowWA(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, fontWeight: 700, fontSize: 13, width: '100%', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <MessageCircle size={15} style={{ color: '#25d366' }} /> Reporte WhatsApp
                        {selectedOrders.size > 0 && <span style={{ fontSize: 11, background: 'rgba(99,102,241,0.2)', color: '#818cf8', borderRadius: 10, padding: '1px 7px' }}>{selectedOrders.size} seleccionados</span>}
                    </span>
                    {showWA ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                {showWA && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                            <button onClick={copyToClipboard} className="btn btn-primary" style={{ width: 'auto', padding: '6px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Copy size={13} /> Copiar
                            </button>
                        </div>
                        <div style={{ background: '#0b141a', border: '1px solid #1f2c34', borderRadius: 10, padding: '12px 14px' }}>
                            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem', color: '#e9edef', margin: 0, minHeight: 80 }}>
                                {buildFullReport() || summary || 'No hay datos para generar reporte.'}
                            </pre>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Status Modal ───────────────────────────────────────── */}
            {statusModal.open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '16px 16px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: 400, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
                        <button onClick={() => setStatusModal({ open: false, orderId: null, currentStatus: '' })} className="btn-close-modal"><X size={20} /></button>
                        <h3 style={{ margin: '0 0 4px' }}>Actualizar Estado</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px' }}>
                            Estado actual: <strong style={{ color: STATUS_CFG[statusModal.currentStatus]?.color }}>{STATUS_CFG[statusModal.currentStatus]?.label}</strong>
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                            {[
                                { s: 'pendiente',  label: '⏳ Pendiente',   style: {} },
                                { s: 'por_cobrar', label: '🚚 Por Cobrar',  style: { border: '1px solid #ffdd19', color: '#ffdd19', background: 'transparent' } },
                                { s: 'cancelado',  label: '❌ Anular',      style: { border: '1px solid var(--danger)', color: 'var(--danger)', background: 'transparent' } },
                            ].map(({ s, label, style }) => (
                                <button key={s} onClick={() => { if (s === 'cancelado') { if (!window.confirm('¿Anular este pedido?')) return; } confirmStatusChange(s); }}
                                    className="btn btn-secondary" disabled={statusModal.currentStatus === s}
                                    style={{ height: 48, fontSize: 13, fontWeight: 700, opacity: statusModal.currentStatus === s ? 0.4 : 1, ...style }}>
                                    {label}
                                </button>
                            ))}

                            <button onClick={() => setIsPagadoExpanded(v => !v)} className="btn"
                                style={{ height: 48, fontSize: 13, fontWeight: 700,
                                    background: isPagadoExpanded ? 'rgba(16,185,129,0.1)' : 'linear-gradient(135deg, #10b981, #059669)',
                                    color: isPagadoExpanded ? '#10b981' : '#fff',
                                    border: isPagadoExpanded ? '1px solid #10b981' : 'none' }}>
                                ✅ {isPagadoExpanded ? 'Pagando…' : 'Pagado'}
                            </button>
                        </div>

                        {isPagadoExpanded && (
                            <div style={{ marginTop: 12, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: 14 }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Medio de pago *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 7, marginBottom: 12 }}>
                                    {paymentMethods.map(m => (
                                        <button key={m.id} type="button" onClick={() => setSelectedMethod(String(m.id))}
                                            style={{ padding: '9px 6px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                                                background: selectedMethod === String(m.id) ? 'rgba(16,185,129,0.15)' : 'var(--bg-secondary)',
                                                border: selectedMethod === String(m.id) ? '2px solid #10b981' : '2px solid var(--border)',
                                                color: selectedMethod === String(m.id) ? '#10b981' : 'var(--text-secondary)' }}>
                                            {m.nombre}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => confirmStatusChange('pagado')} disabled={!selectedMethod}
                                    style={{ width: '100%', padding: 13, fontSize: 15, fontWeight: 800, borderRadius: 10, border: 'none',
                                        background: selectedMethod ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--bg-secondary)',
                                        color: selectedMethod ? '#fff' : 'var(--text-muted)', cursor: selectedMethod ? 'pointer' : 'not-allowed' }}>
                                    Confirmar Pago{selectedMethod ? ` · ${paymentMethods.find(m => String(m.id) === selectedMethod)?.nombre}` : ''}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
